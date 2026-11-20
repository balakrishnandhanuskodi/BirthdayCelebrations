import type { Track } from "livekit-client";

export type GuestStatus = "waiting" | "revealed";

export interface Look {
  bg: string;
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: "long" | "short" | "bun" | "curly";
}

export interface Participant {
  id: string;
  name: string;
  role: string;
  isCharuta?: boolean;
  isModerator?: boolean;
  isLocal?: boolean;
  status: GuestStatus;
  micOn: boolean;
  camOn: boolean;
  /** No camera at all (blocked / none): show the cartoon avatar instead. */
  noCamera?: boolean;
  joinedAt: number;
  look: Look;
  /** Question this guest wants to ask Charuta when picked. */
  question?: string;
  video?: Track;
  audio?: Track;
}

export interface Milestone {
  id: string;
  kind: string;
  label: string;
  /** Milestones still left in the level after this one (used to spread out reveals). */
  remaining: number;
}

export type Phase = "lobby" | "playing" | "movie" | "finale";

/** A "Pick a Friend" stop in the game. */
export interface Station {
  n: number;
  /** pick + spotlight = Friend Station; act = one of the moderator's challenges for Charuta. */
  stage: "pick" | "spotlight" | "act";
  /** Which challenge (0-4) when stage is "act". */
  act?: number;
  guestId?: string;
  question?: string;
  options?: string[];
  answer?: string;
}

export type ModCommand = "close" | "another" | "skip" | "finale";

/** Messages exchanged over the LiveKit data channel (topic "party"). */
export type PartyMessage =
  | { t: "state"; revealed: string[]; phase: Phase; started: boolean; station: Station | null; usedQ: number[]; usedAsk: string[]; heliDone: boolean; movieAt?: number }
  | { t: "cmd"; action: ModCommand }
  | { t: "reveal"; ids: string[]; label: string }
  | { t: "game"; s: unknown }
  | { t: "reaction"; emoji: string; message?: string }
  | { t: "chat"; text: string }
  | { t: "fx"; kind: "cheer" | "song" | "party" }
  | { t: "hello" };
