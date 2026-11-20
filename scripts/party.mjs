// Starts everything for the party: the LiveKit video server + the web app (HTTPS on your network).
//   node scripts/party.mjs        (or: pnpm party)
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");

function readEnv() {
  if (!fs.existsSync(envFile)) return {};
  return Object.fromEntries(
    fs.readFileSync(envFile, "utf8").split("\n").map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
  );
}

const env = readEnv();
if (!env.CHARUTA_PIN) {
  env.CHARUTA_PIN = String(crypto.randomInt(1000, 10000));
  fs.appendFileSync(envFile, `CHARUTA_PIN=${env.CHARUTA_PIN}\n`);
}
if (!env.MODERATOR_PIN) {
  do env.MODERATOR_PIN = String(crypto.randomInt(1000, 10000));
  while (env.MODERATOR_PIN === env.CHARUTA_PIN);
  fs.appendFileSync(envFile, `MODERATOR_PIN=${env.MODERATOR_PIN}\n`);
}

function lanIp() {
  const nets = os.networkInterfaces();
  const order = ["en0", "en1", ...Object.keys(nets)];
  for (const name of order) for (const n of nets[name] ?? []) if (n.family === "IPv4" && !n.internal) return n.address;
  return "127.0.0.1";
}
let ip = process.env.PARTY_IP || lanIp();
const port = 5173;
let livekit = null;
let vite = null;
let stopping = false;
const line = "─".repeat(58);

function banner(title) {
  console.log(`\n${line}\n  ${title}\n${line}`);
  console.log(`  Guests join here:     https://${ip}:${port}/`);
  console.log(`  Charuta logs in here: https://${ip}:${port}/charuta`);
  console.log(`  Charuta's PIN:        ${env.CHARUTA_PIN}`);
  console.log(`  Moderator logs in:    https://${ip}:${port}/moderator   (PIN ${env.MODERATOR_PIN})`);
  console.log(`\n  Browsers will warn "not private" (self-signed certificate):`);
  console.log(`  tap Advanced → Proceed. Everyone must be on this network.\n${line}\n`);
}

function startLiveKit() {
  if (env.LIVEKIT_PUBLIC_URL) return;
  fs.mkdirSync(path.join(root, "logs"), { recursive: true });
  const log = fs.openSync(path.join(root, "logs", "livekit.log"), "a");
  // node-ip tells browsers where to send audio/video, so it must be this Mac's current address.
  const lk = spawn("livekit-server", ["--dev", "--bind", "0.0.0.0", "--node-ip", ip], { stdio: ["ignore", log, log] });
  lk.on("exit", (code) => !stopping && lk === livekit && code && console.error(`LiveKit stopped (code ${code}). See logs/livekit.log`));
  livekit = lk;
}

if (!env.LIVEKIT_PUBLIC_URL && env.LIVEKIT_URL) env.LIVEKIT_PUBLIC_URL = env.LIVEKIT_URL;
if (!env.LIVEKIT_PUBLIC_URL) {
  try {
    execSync("command -v livekit-server", { stdio: "ignore" });
  } catch {
    console.error("\n✗ livekit-server is not installed. Run:  brew install livekit\n");
    process.exit(1);
  }
  startLiveKit();
}

vite = spawn("pnpm", ["exec", "vite", "--host", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: ["inherit", "pipe", "inherit"],
  env: { ...process.env, ...env },
});
let shown = false;
vite.stdout.on("data", (d) => {
  process.stdout.write(d);
  if (!shown && /ready in/i.test(String(d))) {
    shown = true;
    banner("🎂  Charuta's Birthday Adventure is live!");
  }
});

// If the Mac moves to another network (new Wi-Fi, hotspot), restart LiveKit with the new address.
if (!process.env.PARTY_IP) {
  setInterval(() => {
    const now = lanIp();
    if (now === ip || now === "127.0.0.1") return;
    console.log(`\n⚠️  Network changed: ${ip} → ${now}. Restarting the video server…`);
    ip = now;
    const old = livekit;
    if (old) {
      old.once("exit", () => setTimeout(startLiveKit, 500));
      old.kill("SIGTERM");
    }
    banner("🔁  New links: share these instead (old links stopped working)");
  }, 5000);
}

const stop = () => {
  stopping = true;
  livekit?.kill("SIGTERM");
  vite?.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", stop);
