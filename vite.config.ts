import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "node:path";
import { partyServer } from "./server/partyServer";

// Simplified from the Figma Make config (original kept in figma-original/).
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env } as Record<string, string>;
  const livekitTarget = env.LIVEKIT_INTERNAL_URL || "http://127.0.0.1:7880";
  // LiveKit's signalling is proxied through this HTTPS server, so guests only need one link.
  const proxy = { "/rtc": { target: livekitTarget, ws: true, changeOrigin: true } };
  return {
    plugins: [react(), tailwindcss(), ...(env.PARTY_NO_SSL ? [] : [basicSsl({ name: "charuta-party" })]), partyServer(env)],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    server: { port: 5173, host: true, proxy, watch: { ignored: ["**/data/**", "**/logs/**", "**/figma-original/**"] } },
    preview: { port: 5173, host: true, proxy },
  };
});
