import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectionState, Room, RoomEvent, Track, VideoPresets, type Participant as LKParticipant, type RemoteParticipant } from "livekit-client";
import type { ModCommand, Participant, PartyMessage, Phase, Station } from "./types";
import { lookFor } from "./constants";

export interface JoinInfo {
  token: string;
  url: string;
  identity: string;
  role: "guest" | "charuta" | "moderator";
  name: string;
}

export interface ChatMessage {
  id: number;
  from: string;
  name: string;
  text: string;
}
export interface ReactionEvent {
  id: number;
  from: string;
  name: string;
  emoji: string;
  message?: string;
}
export interface Reveal {
  key: number;
  ids: string[];
  label: string;
}
export interface PartyState {
  revealed: string[];
  phase: Phase;
  started: boolean;
  station: Station | null;
  usedQ: number[];
  /** Guests whose typed question has already been asked. */
  usedAsk: string[];
  heliDone: boolean;
  /** Charuta's clock when the finale film started. */
  movieStart?: number;
  /** Guests: film position (s) when the last state arrived, and when it arrived. */
  movieAt?: number;
  movieRecv?: number;
}

const EMPTY: PartyState = { revealed: [], phase: "lobby", started: false, station: null, usedQ: [], usedAsk: [], heliDone: false };

const SAVE_KEY = "charuta-party-state";
const enc = new TextEncoder();
const dec = new TextDecoder();
let seq = 1;

function loadSaved(): PartyState {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "");
    if (Array.isArray(s.revealed)) return { ...EMPTY, revealed: s.revealed, usedQ: Array.isArray(s.usedQ) ? s.usedQ : [], usedAsk: Array.isArray(s.usedAsk) ? s.usedAsk : [], heliDone: !!s.heliDone, phase: s.phase === "finale" ? "finale" : "lobby" };
  } catch {
    /* fresh party */
  }
  return EMPTY;
}

const parseMeta = (m?: string) => {
  try {
    return JSON.parse(m || "{}") as { role?: string; question?: string };
  } catch {
    return {};
  }
};

/**
 * Connects to the LiveKit room and exposes everything the UI needs.
 * Charuta's browser is the single source of truth for who has been revealed
 * and for the game; guests mirror what she broadcasts.
 */
export function useLiveParty(join: JoinInfo) {
  const isCharuta = join.role === "charuta";
  const isModerator = join.role === "moderator";
  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: VideoPresets.h360.resolution, facingMode: "user" },
        publishDefaults: { simulcast: true, videoSimulcastLayers: [VideoPresets.h90, VideoPresets.h180], videoEncoding: VideoPresets.h360.encoding },
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }),
    [],
  );
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const [conn, setConn] = useState<"connecting" | "connected" | "reconnecting" | "failed">("connecting");
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [party, setParty] = useState<PartyState>(() => (isCharuta ? loadSaved() : EMPTY));
  const partyRef = useRef(party);
  partyRef.current = party;
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);
  const [reveals, setReveals] = useState<Reveal[]>([]);
  const [fx, setFx] = useState<{ kind: "cheer" | "song" | "party"; key: number } | null>(null);
  const gameListener = useRef<((s: unknown) => void) | null>(null);
  const cmdListener = useRef<((a: ModCommand) => void) | null>(null);

  const nameOf = useCallback(
    (identity: string, fallback?: string) => {
      // On Charuta's screen, guests stay anonymous until revealed.
      if (isCharuta && identity !== "charuta" && !identity.startsWith("mod-") && identity !== room.localParticipant.identity && !partyRef.current.revealed.includes(identity) && partyRef.current.phase !== "finale") return "A mystery guest";
      return fallback || "Someone";
    },
    [isCharuta, room],
  );

  const send = useCallback(
    (msg: PartyMessage, reliable = true) => {
      if (room.state !== ConnectionState.Connected) return;
      room.localParticipant.publishData(enc.encode(JSON.stringify(msg)), { reliable, topic: "party" }).catch(() => {});
    },
    [room],
  );

  const broadcastState = useCallback(() => {
    if (!isCharuta) return;
    const s = partyRef.current;
    const movieAt = s.phase === "movie" && s.movieStart ? (Date.now() - s.movieStart) / 1000 : undefined;
    send({ t: "state", revealed: s.revealed, phase: s.phase, started: s.started, station: s.station, usedQ: s.usedQ, usedAsk: s.usedAsk, heliDone: s.heliDone, movieAt });
  }, [isCharuta, send]);

  useEffect(() => {
    const url = join.url || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
    const refresh = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackMuted,
      RoomEvent.TrackUnmuted,
      RoomEvent.LocalTrackPublished,
      RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantMetadataChanged,
      RoomEvent.ParticipantNameChanged,
    ];
    refresh.forEach((e) => room.on(e, bump));
    room.on(RoomEvent.ParticipantConnected, () => setTimeout(broadcastState, 500));
    room.on(RoomEvent.ActiveSpeakersChanged, (ps: LKParticipant[]) => setSpeakers(ps.map((p) => p.identity)));
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => setCanPlayAudio(room.canPlaybackAudio));
    room.on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
      if (s === ConnectionState.Connected) setConn("connected");
      else if (s === ConnectionState.Reconnecting || s === ConnectionState.SignalReconnecting) setConn("reconnecting");
      bump();
    });
    room.on(RoomEvent.Disconnected, () => setConn((c) => (c === "connecting" ? "failed" : "reconnecting")));
    room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== "party" || !participant) return;
      let msg: PartyMessage;
      try {
        msg = JSON.parse(dec.decode(payload));
      } catch {
        return;
      }
      const from = participant.identity;
      const fromCharuta = from === "charuta";
      switch (msg.t) {
        case "state":
          if (!isCharuta && fromCharuta) setParty({ revealed: msg.revealed, phase: msg.phase, started: msg.started, station: msg.station ?? null, usedQ: msg.usedQ ?? [], usedAsk: msg.usedAsk ?? [], heliDone: !!msg.heliDone, movieAt: msg.movieAt, movieRecv: Date.now() });
          break;
        case "cmd":
          if (isCharuta && from.startsWith("mod-")) cmdListener.current?.(msg.action);
          break;
        case "reveal":
          if (!isCharuta && fromCharuta) {
            setParty((p) => ({ ...p, revealed: [...new Set([...p.revealed, ...msg.ids])] }));
            setReveals((r) => [...r, { key: seq++, ids: msg.ids, label: msg.label }]);
          }
          break;
        case "game":
          if (fromCharuta) gameListener.current?.(msg.s);
          break;
        case "reaction":
          setReactions((r) => [...r.slice(-30), { id: seq++, from, name: nameOf(from, participant.name), emoji: msg.emoji, message: msg.message }]);
          break;
        case "chat":
          setChat((c) => [...c.slice(-200), { id: seq++, from, name: nameOf(from, participant.name), text: String(msg.text).slice(0, 300) }]);
          setUnread((u) => u + 1);
          break;
        case "fx":
          setFx({ kind: msg.kind, key: seq++ });
          break;
        case "hello":
          broadcastState();
          break;
      }
    });

    let cancelled = false;
    room
      .connect(url, join.token, { autoSubscribe: !isCharuta })
      .then(async () => {
        if (cancelled) return;
        setConn("connected");
        setCanPlayAudio(room.canPlaybackAudio);
        bump();
        if (isCharuta) broadcastState();
        else send({ t: "hello" });
        try {
          await room.localParticipant.enableCameraAndMicrophone();
        } catch {
          try {
            await room.localParticipant.setMicrophoneEnabled(true);
            setMediaError("Camera unavailable: showing your avatar instead.");
          } catch {
            setMediaError("Camera and mic are blocked. Allow them in your browser's site settings.");
          }
        }
        bump();
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setConn("failed");
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
      room.removeAllListeners();
      room.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // Charuta: persist + broadcast the party state on every change, and regularly for late joiners.
  useEffect(() => {
    if (!isCharuta) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(party));
    } catch {
      /* private mode */
    }
    broadcastState();
  }, [party, isCharuta, broadcastState]);
  useEffect(() => {
    if (!isCharuta) return;
    const t = setInterval(broadcastState, 3000);
    return () => clearInterval(t);
  }, [isCharuta, broadcastState]);

  // Charuta only receives video/audio from guests she has discovered. Keeps the surprise
  // (and saves a lot of bandwidth with 40 people).
  useEffect(() => {
    if (!isCharuta || conn !== "connected") return;
    const all = party.phase === "finale";
    room.remoteParticipants.forEach((p) => {
      const allowed = all || p.identity === "charuta" || p.identity.startsWith("mod-") || party.revealed.includes(p.identity);
      p.trackPublications.forEach((pub) => {
        if (pub.isSubscribed !== allowed) pub.setSubscribed(allowed);
      });
    });
  }, [isCharuta, conn, party, version, room]);

  const participants: Participant[] = useMemo(() => {
    if (conn === "connecting" || conn === "failed") return [];
    const revealed = new Set(party.revealed);
    const toP = (lk: LKParticipant): Participant => {
      const isCh = lk.identity === "charuta";
      const isMod = lk.identity.startsWith("mod-");
      const meta = parseMeta(lk.metadata);
      const cam = lk.getTrackPublication(Track.Source.Camera);
      const mic = lk.getTrackPublication(Track.Source.Microphone);
      return {
        id: lk.identity,
        name: lk.name || "Guest",
        role: isCh ? "Birthday Girl" : isMod ? "Moderator" : "Guest",
        isCharuta: isCh,
        isModerator: isMod,
        isLocal: lk === room.localParticipant,
        status: isCh || isMod || revealed.has(lk.identity) || party.phase === "finale" ? "revealed" : "waiting",
        micOn: !!mic && !mic.isMuted,
        camOn: !!cam && !cam.isMuted,
        noCamera: !cam,
        joinedAt: lk.joinedAt?.getTime() ?? Date.now(),
        look: lookFor(lk.identity, isCh),
        question: meta.question,
        video: cam?.track,
        audio: mic?.track,
      };
    };
    return [room.localParticipant, ...room.remoteParticipants.values()].map(toP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, conn, party, room]);

  const local = room.localParticipant;
  const actions = useMemo(
    () => ({
      react: (emoji: string, message?: string) => {
        send({ t: "reaction", emoji, message });
        setReactions((r) => [...r.slice(-30), { id: seq++, from: local.identity, name: "You", emoji, message }]);
      },
      chat: (text: string) => {
        send({ t: "chat", text });
        setChat((c) => [...c, { id: seq++, from: local.identity, name: "You", text }]);
      },
      readChat: () => setUnread(0),
      fx: (kind: "cheer" | "song" | "party") => {
        send({ t: "fx", kind });
        setFx({ kind, key: seq++ });
      },
      ackReveal: () => setReveals((r) => r.slice(1)),
      clearReveals: () => setReveals([]),
      /** Charuta: reveal these guests to everyone. */
      reveal: (ids: string[], label: string) => {
        if (!ids.length) return;
        partyRef.current = { ...partyRef.current, revealed: [...new Set([...partyRef.current.revealed, ...ids])] };
        setParty(partyRef.current);
        send({ t: "reveal", ids, label });
        setReveals((r) => [...r, { key: seq++, ids, label }]);
      },
      setParty: (patch: Partial<PartyState>) => {
        partyRef.current = { ...partyRef.current, ...patch };
        setParty(partyRef.current);
      },
      publishGame: (s: unknown) => send({ t: "game", s }, false),
      onGame: (fn: ((s: unknown) => void) | null) => {
        gameListener.current = fn;
      },
      /** Moderator → Charuta's browser (which owns the party state). */
      command: (action: ModCommand) => send({ t: "cmd", action }),
      onCommand: (fn: ((a: ModCommand) => void) | null) => {
        cmdListener.current = fn;
      },
      setMic: async (on: boolean) => {
        if (local.isMicrophoneEnabled === on) return;
        await local.setMicrophoneEnabled(on).catch(() => {});
        bump();
      },
      toggleMic: async () => {
        await local.setMicrophoneEnabled(!local.isMicrophoneEnabled).catch(() => setMediaError("Microphone is blocked in your browser settings."));
        bump();
      },
      toggleCam: async () => {
        await local.setCameraEnabled(!local.isCameraEnabled).catch(() => setMediaError("Camera is blocked in your browser settings."));
        bump();
      },
      startAudio: () => room.startAudio().then(() => setCanPlayAudio(room.canPlaybackAudio)),
      leave: () => room.disconnect(),
    }),
    [send, local, room, bump],
  );

  return {
    room,
    conn,
    error,
    mediaError,
    canPlayAudio,
    speakers,
    party,
    participants,
    chat,
    unread,
    reactions,
    reveals,
    fx,
    isCharuta,
    isModerator,
    micOn: local.isMicrophoneEnabled,
    camOn: local.isCameraEnabled,
    actions,
  };
}

export type LiveParty = ReturnType<typeof useLiveParty>;
