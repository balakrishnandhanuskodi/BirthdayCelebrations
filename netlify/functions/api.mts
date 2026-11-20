import { getStore } from "@netlify/blobs";
import { clean, cleanVideoUrl, isModeratorPin, issueJoinToken, type PartyEnv } from "../../server/core";

/**
 * Netlify version of the party backend (same API as `pnpm party`):
 *   POST /api/join · GET|POST /api/acts · GET /api/video/info · POST|DELETE /api/video (video *link*)
 * Settings come from Netlify environment variables; challenges + video link live in Netlify Blobs.
 */
const env = (): PartyEnv => ({
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  LIVEKIT_PUBLIC_URL: process.env.LIVEKIT_PUBLIC_URL,
  PARTY_ROOM: process.env.PARTY_ROOM,
  CHARUTA_PIN: process.env.CHARUTA_PIN,
  MODERATOR_PIN: process.env.MODERATOR_PIN,
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const readJson = async (req: Request) => {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

export default async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/^\/api/, "").replace(/\/+$/, "");
  const store = getStore({ name: "party", consistency: "strong" });
  const e = env();

  if (path === "/join") {
    if (req.method !== "POST") return json(405, { error: "POST only" });
    const r = await issueJoinToken(e, await readJson(req), true);
    return json(r.status, r.body);
  }

  if (path === "/acts") {
    if (req.method === "GET") return json(200, { acts: ((await store.get("acts", { type: "json" })) as string[] | null) ?? [] });
    if (req.method !== "POST") return json(405, { error: "GET or POST" });
    const body = await readJson(req);
    if (!isModeratorPin(e, body.pin)) return json(401, { error: "Moderator PIN required" });
    const acts = (Array.isArray(body.acts) ? body.acts : []).slice(0, 5).map((a) => clean(a, 200));
    await store.setJSON("acts", acts);
    return json(200, { acts });
  }

  if (path === "/video/info" || path === "/video") {
    const video = (await store.get("video", { type: "json" })) as { url: string; name: string } | null;
    if (req.method === "GET") {
      if (path === "/video") return video?.url ? Response.redirect(video.url, 302) : json(404, { error: "No video set" });
      return json(200, video?.url ? { exists: true, mode: "link", ...video } : { exists: false, mode: "link" });
    }
    const body = await readJson(req);
    if (!isModeratorPin(e, body.pin ?? req.headers.get("x-mod-pin"))) return json(401, { error: "Moderator PIN required" });
    if (req.method === "DELETE") {
      await store.delete("video");
      return json(200, { exists: false, mode: "link" });
    }
    if (req.method === "POST") {
      const url = cleanVideoUrl(body.url);
      if (!url) return json(400, { error: "Please paste a direct https:// link to the video file." });
      const saved = { url, name: clean(body.name, 120) || url.split("/").pop() || "Team video" };
      await store.setJSON("video", saved);
      return json(200, { exists: true, mode: "link", ...saved });
    }
    return json(405, { error: "Method not allowed" });
  }

  return json(404, { error: "Not found" });
};

export const config = { path: "/api/*" };
