import { useEffect, useRef } from "react";
import type { Track } from "livekit-client";
import type { Participant } from "../realtime/types";
import { Icon } from "./Icon";

/** Animated stand-in for a guest's camera feed. */
export function SimulatedVideo({ p, talking }: { p: Participant; talking?: boolean }) {
  const { look } = p;
  return (
    <div className={`sim-video ${talking ? "talking" : ""}`} style={{ background: look.bg }}>
      <div className="sim-room" />
      <div className={`sim-person hair-${look.hairStyle}`}>
        <span className="sim-hair" style={{ background: look.hair }} />
        <span className="sim-body" style={{ background: look.shirt }} />
        <span className="sim-neck" style={{ background: look.skin }} />
        <span className="sim-face" style={{ background: look.skin }}>
          <span className="sim-fringe" style={{ background: look.hair }} />
          <i className="sim-eye l" />
          <i className="sim-eye r" />
          <i className="sim-blush l" />
          <i className="sim-blush r" />
          <i className="sim-mouth" />
        </span>
        {p.isCharuta && <span className="sim-crown">♛</span>}
      </div>
    </div>
  );
}

function LiveVideo({ track, mirror }: { track: Track; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <video ref={ref} className={`live-video ${mirror ? "mirror" : ""}`} autoPlay muted playsInline />;
}

/** Plays one remote person's microphone. */
export function RemoteAudio({ track }: { track: Track }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);
  return <audio ref={ref} autoPlay />;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface TileProps {
  p: Participant;
  speaking?: boolean;
  /** Already had their turn in the spotlight. */
  spotlighted?: boolean;
  variant?: "hero" | "grid" | "reveal" | "finale" | "self" | "stage" | "pip";
  isNew?: boolean;
  reaction?: { emoji: string; key: number } | null;
  mysteryNumber?: number;
}

export function VideoTile({ p, speaking, variant = "grid", isNew, reaction, mysteryNumber, spotlighted }: TileProps) {
  const locked = p.status === "waiting";
  const hasLiveCam = p.camOn && p.video;

  return (
    <div data-pid={p.id} className={`tile tile-${variant} ${locked ? "tile-locked" : ""} ${speaking && !locked ? "tile-speaking" : ""} ${isNew ? "tile-new" : ""} ${p.isCharuta ? "tile-charuta" : ""}`}>
      {locked ? (
        <div className="mystery">
          <div className="mystery-silhouette">
            <span>?</span>
          </div>
          <b>Mystery guest {mysteryNumber ? `#${mysteryNumber}` : ""}</b>
          <small>Joined · waiting to be discovered</small>
        </div>
      ) : p.noCamera ? (
        <SimulatedVideo p={p} talking={speaking} />
      ) : !p.camOn ? (
        <div className="cam-off">
          <span style={{ background: p.look.shirt }}>{initials(p.name)}</span>
          <small>Camera off</small>
        </div>
      ) : hasLiveCam ? (
        <LiveVideo track={p.video!} mirror={p.isLocal} />
      ) : (
        <SimulatedVideo p={p} talking={speaking} />
      )}

      {!locked && (
        <>
          <div className="tile-shade" />
          <div className="tile-label">
            <span className="tile-name">
              {speaking && <i className="speak-dot" />}
              {p.name}
              {p.isLocal && <em> (you)</em>}
            </span>
            <span className={`tile-mic ${p.micOn ? "" : "off"}`}>
              {speaking && p.micOn ? (
                <span className="eq">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <Icon name={p.micOn ? "mic" : "micOff"} size={12} />
              )}
            </span>
          </div>
          {p.isCharuta && variant === "hero" && <div className="tile-role">{p.role}</div>}
        </>
      )}
      {locked && <span className="tile-lock-pill">Waiting</span>}
      {spotlighted && !isNew && <span className="tile-hidden-pill star">⭐</span>}
      {p.isModerator && <span className="tile-hidden-pill mod">🎙️ Moderator</span>}
      {isNew && <span className="tile-new-pill">Just revealed!</span>}
      {reaction && (
        <span className="tile-reaction" key={reaction.key}>
          {reaction.emoji}
        </span>
      )}
    </div>
  );
}
