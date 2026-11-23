import { AccessToken } from "livekit-server-sdk";

/** Shared by the local Vite server (`pnpm party`) and the Netlify Function. */

export interface PartyEnv {
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_PUBLIC_URL?: string;
  PARTY_ROOM?: string;
  CHARUTA_PIN?: string;
  MODERATOR_PIN?: string;
}

export interface ApiResult {
  status: number;
  body: unknown;
}

export const clean = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, max);

export const isModeratorPin = (env: PartyEnv, given: unknown) => !!env.MODERATOR_PIN && String(given ?? "").trim() === env.MODERATOR_PIN;

/**
 * Validates a join request and returns a LiveKit token.
 * `requirePublicUrl`: on hosted deployments there's no local video server, so LIVEKIT_PUBLIC_URL must be set.
 */
export async function issueJoinToken(env: PartyEnv, body: Record<string, unknown>, requirePublicUrl = false): Promise<ApiResult> {
  const role = body.role === "charuta" ? "charuta" : body.role === "moderator" ? "moderator" : "guest";
  if (requirePublicUrl && (!env.LIVEKIT_PUBLIC_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET)) {
    return { status: 500, body: { error: "The video server isn't set up yet. The host needs to add the LiveKit settings (LIVEKIT_PUBLIC_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)." } };
  }
  if (role === "charuta") {
    if (!env.CHARUTA_PIN) return { status: 500, body: { error: "No CHARUTA_PIN configured on the server." } };
    if (String(body.pin ?? "").trim() !== env.CHARUTA_PIN) return { status: 401, body: { error: "That PIN isn't right. Ask the party organiser." } };
  }
  if (role === "moderator") {
    if (!env.MODERATOR_PIN) return { status: 500, body: { error: "No MODERATOR_PIN configured on the server." } };
    if (!isModeratorPin(env, body.pin)) return { status: 401, body: { error: "That moderator PIN isn't right." } };
  }
  const name = role === "charuta" ? "Charuta" : clean(body.name, 30) || (role === "moderator" ? "Moderator" : "Guest");
  const id = clean(body.id, 40).replace(/[^a-zA-Z0-9_-]/g, "") || Math.random().toString(36).slice(2, 10);
  const identity = role === "charuta" ? "charuta" : role === "moderator" ? `mod-${id}` : `g-${id}`;
  const at = new AccessToken(env.LIVEKIT_API_KEY || "devkey", env.LIVEKIT_API_SECRET || "secret", {
    identity,
    name,
    ttl: "12h",
    metadata: JSON.stringify({ role, question: clean(body.question, 160) }),
  });
  at.addGrant({ roomJoin: true, room: env.PARTY_ROOM || "charuta-birthday", canPublish: true, canSubscribe: true, canPublishData: true });
  return { status: 200, body: { token: await at.toJwt(), url: env.LIVEKIT_PUBLIC_URL || "", identity } };
}

/** Accepts only direct http(s) links (an MP4/WebM file the browser can stream). */
export function cleanVideoUrl(u: unknown) {
  const s = clean(u, 1000);
  if (!s) return "";
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/* ---------------------------- opening time ---------------------------- */

/** Used until the moderator sets something else: 24 Nov 2026, 11:00 AM India time. */
export const DEFAULT_OPENS_AT = "2026-11-24T11:00:00+05:30";

/** Stored value: { opensAt: ISO string } or { opensAt: null } meaning "open now". Nothing stored → default. */
export function resolveOpensAt(stored: { opensAt: string | null } | null | undefined): string | null {
  if (stored && "opensAt" in stored) return stored.opensAt;
  return DEFAULT_OPENS_AT;
}

export function cleanOpensAt(v: unknown): string | null | undefined {
  if (v === null) return null;
  const t = Date.parse(String(v ?? ""));
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}

/** Guests can't sign in before the opening time; Charuta and the moderator always can. */
export function joinBlockedUntil(role: unknown, opensAt: string | null, now = Date.now()): ApiResult | null {
  if (role === "charuta" || role === "moderator" || !opensAt) return null;
  const at = Date.parse(opensAt);
  if (!Number.isFinite(at) || now >= at) return null;
  return { status: 403, body: { error: "The party hasn't opened yet. Please come back at the start time!", opensAt } };
}
