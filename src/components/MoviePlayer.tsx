import { useEffect, useRef, useState } from "react";
import type { Participant } from "../realtime/types";
import type { PartyState } from "../realtime/useLiveParty";
import { VideoTile } from "./VideoTile";

interface Props {
  party: PartyState;
  isCharuta: boolean;
  canControl: boolean;
  charuta?: Participant;
  speaking: Set<string>;
  /** Charuta's browser: the film finished (or failed), move on to the finale. */
  onEnded: () => void;
  onSkip: () => void;
}

/** The team's film, played for everyone at the same moment, with Charuta's reaction in the corner. */
export function MoviePlayer({ party, isCharuta, canControl, charuta, speaking, onEnded, onSkip }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);
  const partyRef = useRef(party);
  partyRef.current = party;

  // Where everyone should be in the film right now.
  const target = () => {
    const s = partyRef.current;
    if (isCharuta) return s.movieStart ? (Date.now() - s.movieStart) / 1000 : 0;
    return (s.movieAt ?? 0) + (s.movieRecv ? (Date.now() - s.movieRecv) / 1000 : 0);
  };

  const play = () => {
    const v = ref.current;
    if (!v) return;
    v.play()
      .then(() => setNeedsTap(false))
      .catch(() => setNeedsTap(true));
  };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onMeta = () => {
      const t = target();
      if (t > 0.5 && t < v.duration) v.currentTime = t;
      play();
    };
    v.addEventListener("loadedmetadata", onMeta);
    // Gently keep everyone in sync.
    const sync = setInterval(() => {
      if (!v.duration || v.paused) return;
      const t = target();
      if (t < v.duration && Math.abs(v.currentTime - t) > 2.5) v.currentTime = t;
    }, 2000);
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      clearInterval(sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="movie-screen" role="dialog" aria-label="A film for Charuta">
      <div className="movie-title">🎬 A special film for Charuta, from her team ❤️</div>
      <div className="movie-frame">
        {!failed ? (
          <video
            ref={ref}
            src="/api/video"
            playsInline
            preload="auto"
            onEnded={() => {
              setDone(true);
              if (isCharuta) onEnded();
            }}
            onError={() => {
              setFailed(true);
              if (isCharuta) setTimeout(onEnded, 1500);
            }}
          />
        ) : (
          <div className="movie-failed">The film couldn't load on this device. The celebration starts in a moment…</div>
        )}
        {needsTap && !failed && (
          <button className="movie-tap" onClick={play}>
            ▶ Tap to play the film with sound
          </button>
        )}
        {done && <div className="movie-failed">🎉 Get ready to celebrate…</div>}
      </div>
      {charuta && (
        <div className="movie-pip">
          <VideoTile p={charuta} variant="pip" speaking={speaking.has(charuta.id)} />
        </div>
      )}
      <div className="movie-foot">
        <span>🔇 Mics are muted during the film so everyone hears it clearly.</span>
        {canControl && (
          <button onClick={onSkip}>
            ⏭ Skip to the celebration
          </button>
        )}
      </div>
    </div>
  );
}
