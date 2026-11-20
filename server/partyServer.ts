import type { Connect, Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { issueJoinToken } from "./core";
import fs from "node:fs";
import path from "node:path";

/**
 * Tiny backend living inside the Vite server:
 *   POST   /api/join        { role, name, id, pin?, question? } -> { token, url }
 *   GET    /api/acts        -> { acts: string[] }          (Charuta's 5 challenges)
 *   POST   /api/acts        { pin, acts }                  (moderator only)
 *   GET    /api/video/info  -> { exists, name, size, version }
 *   PUT    /api/video       raw file body, header x-mod-pin (moderator only)
 *   DELETE /api/video       header x-mod-pin              (moderator only)
 *   GET    /api/video       the team's finale film (supports seeking)
 * Files are kept in ./data so they survive a restart.
 */
export function partyServer(env: Record<string, string>): Plugin {
  const apiKey = env.LIVEKIT_API_KEY || "devkey";
  const apiSecret = env.LIVEKIT_API_SECRET || "secret";
  const roomName = env.PARTY_ROOM || "charuta-birthday";
  const pin = env.CHARUTA_PIN || process.env.CHARUTA_PIN || "";
  const modPin = env.MODERATOR_PIN || process.env.MODERATOR_PIN || "";
  const publicUrl = env.LIVEKIT_PUBLIC_URL || "";
  const dataDir = path.resolve(env.PARTY_DATA_DIR || "data");
  const actsFile = path.join(dataDir, "challenges.json");
  const videoFile = path.join(dataDir, "finale-video");
  const videoMeta = path.join(dataDir, "finale-video.json");
  const MAX_VIDEO = 2 * 1024 * 1024 * 1024;

  const clean = (s: unknown, max: number) => String(s ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);
  const readJson = <T,>(f: string, fallback: T): T => {
    try {
      return JSON.parse(fs.readFileSync(f, "utf8")) as T;
    } catch {
      return fallback;
    }
  };

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  };
  const readBody = (req: IncomingMessage, limit = 100_000) =>
    new Promise<string>((resolve, reject) => {
      let raw = "";
      req.on("data", (c) => {
        raw += c;
        if (raw.length > limit) reject(new Error("too large"));
      });
      req.on("end", () => resolve(raw));
      req.on("error", reject);
    });
  const isMod = (given: unknown) => !!modPin && String(given ?? "").trim() === modPin;

  async function join(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "POST") return send(res, 405, { error: "POST only" });
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      const r = await issueJoinToken({ LIVEKIT_API_KEY: apiKey, LIVEKIT_API_SECRET: apiSecret, LIVEKIT_PUBLIC_URL: publicUrl, PARTY_ROOM: roomName, CHARUTA_PIN: pin, MODERATOR_PIN: modPin }, body);
      send(res, r.status, r.body);
    } catch {
      send(res, 400, { error: "Bad request" });
    }
  }

  async function acts(req: IncomingMessage, res: ServerResponse) {
    if (req.method === "GET") return send(res, 200, { acts: readJson<string[]>(actsFile, []) });
    if (req.method !== "POST") return send(res, 405, { error: "GET or POST" });
    try {
      const body = JSON.parse((await readBody(req)) || "{}");
      if (!isMod(body.pin)) return send(res, 401, { error: "Moderator PIN required" });
      const list = (Array.isArray(body.acts) ? body.acts : []).slice(0, 5).map((a: unknown) => clean(a, 200));
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(actsFile, JSON.stringify(list, null, 2));
      send(res, 200, { acts: list });
    } catch {
      send(res, 400, { error: "Bad request" });
    }
  }

  function video(req: IncomingMessage, res: ServerResponse, sub: string) {
    const meta = readJson<{ name: string; type: string; size: number; version: number } | null>(videoMeta, null);
    const exists = !!meta && fs.existsSync(videoFile);
    if (sub === "/info") return send(res, 200, exists ? { exists, mode: "upload", ...meta } : { exists: false, mode: "upload" });

    if (req.method === "PUT") {
      if (!isMod(req.headers["x-mod-pin"])) return send(res, 401, { error: "Moderator PIN required" });
      const type = String(req.headers["content-type"] || "");
      if (!type.startsWith("video/")) return send(res, 415, { error: "Please upload a video file (MP4 works best)." });
      const size = Number(req.headers["content-length"] || 0);
      if (size > MAX_VIDEO) return send(res, 413, { error: "Video is larger than 2 GB. Please compress it." });
      fs.mkdirSync(dataDir, { recursive: true });
      const tmp = videoFile + ".uploading";
      const out = fs.createWriteStream(tmp);
      let written = 0;
      req.on("data", (c: Buffer) => {
        written += c.length;
        if (written > MAX_VIDEO) {
          req.destroy();
          out.destroy();
          fs.rmSync(tmp, { force: true });
        }
      });
      req.pipe(out);
      out.on("finish", () => {
        fs.renameSync(tmp, videoFile);
        const name = clean(decodeURIComponent(String(req.headers["x-file-name"] || "video")), 120);
        const m = { name, type, size: written, version: Date.now() };
        fs.writeFileSync(videoMeta, JSON.stringify(m));
        send(res, 200, { exists: true, ...m });
      });
      out.on("error", () => send(res, 500, { error: "Could not save the video" }));
      return;
    }
    if (req.method === "DELETE") {
      if (!isMod(req.headers["x-mod-pin"])) return send(res, 401, { error: "Moderator PIN required" });
      fs.rmSync(videoFile, { force: true });
      fs.rmSync(videoMeta, { force: true });
      return send(res, 200, { exists: false });
    }
    if (!exists || !meta) return send(res, 404, { error: "No video uploaded" });
    // Stream with byte-range support so browsers can seek and start quickly.
    const total = fs.statSync(videoFile).size;
    const range = /bytes=(\d*)-(\d*)/.exec(String(req.headers.range || ""));
    res.setHeader("Content-Type", meta.type);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "no-cache");
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
      if (start >= total) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${total}`);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", String(end - start + 1));
      fs.createReadStream(videoFile, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", String(total));
      fs.createReadStream(videoFile).pipe(res);
    }
  }

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url || "").split("?")[0];
    if (url === "/api/join") return void join(req, res);
    if (url === "/api/acts") return void acts(req, res);
    if (url === "/api/video" || url === "/api/video/info") return video(req, res, url.slice("/api/video".length));
    next();
  };

  return {
    name: "party-server",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
