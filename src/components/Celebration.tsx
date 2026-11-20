import { useCallback, useEffect, useRef, useState } from "react";
import { CHEER_LINES } from "../realtime/constants";
import { DEFAULT_ACTS, QUESTIONS } from "../realtime/questions";
import type { Milestone, ModCommand, Station } from "../realtime/types";
import { useLiveParty, type JoinInfo, type LiveParty } from "../realtime/useLiveParty";
import { isSfxMuted, setSfxMuted, sfx, unlockAudio } from "../lib/audio";
import { GameCanvas, type GameHandle } from "../game/GameCanvas";
import type { GameSnapshot, GameStats, StationKind } from "../game/engine";
import { Icon } from "./Icon";
import { RemoteAudio, VideoTile } from "./VideoTile";
import { Finale } from "./Finale";
import { StationOverlay } from "./StationOverlay";
import { MoviePlayer } from "./MoviePlayer";
import { ModeratorSetup } from "./ModeratorSetup";

const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

const REACTIONS: { emoji: string; label: string; message?: string }[] = [
  { emoji: "👏", label: "Clap" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "🎂", label: "Birthday cake" },
  { emoji: "🎈", label: "Balloons" },
  { emoji: "🎊", label: "Confetti burst" },
  { emoji: "📣", label: "Cheer" },
  { emoji: "🎁", label: "Send a virtual gift", message: "sent you a gift! Catch it! 🎁" },
];

interface FeedItem {
  id: number;
  name: string;
  emoji: string;
  text?: string;
}

export function Celebration({ join, onLeave }: { join: JoinInfo; onLeave: () => void }) {
  const live = useLiveParty(join);
  const { participants, party, isCharuta, isModerator, actions } = live;
  const gameRef = useRef<GameHandle>(null);
  const shellRef = useRef<HTMLElement>(null);
  const partyRef = useRef(party);
  partyRef.current = party;

  const [stats, setStats] = useState<GameStats>({ score: 0, stars: 0, totalStars: 17, gifts: 0, progress: 0 });
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [tileReactions, setTileReactions] = useState<Record<string, { emoji: string; key: number }>>({});
  const [newIds, setNewIds] = useState<Record<string, number>>({});
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [castleGuests, setCastleGuests] = useState<string[]>([]);
  const [soundOn, setSoundOn] = useState(!isSfxMuted());
  const [mutedForQA, setMutedForQA] = useState(false);

  const me = participants.find((p) => p.isLocal);
  const charuta = participants.find((p) => p.isCharuta);
  const moderators = participants.filter((p) => p.isModerator);
  const hasModerator = moderators.length > 0;
  const guests = participants.filter((p) => !p.isCharuta && !p.isModerator);
  const otherGuests = guests.filter((p) => !p.isLocal);
  const revealedGuests = guests.filter((p) => p.status === "revealed");
  const waitingGuests = guests.filter((p) => p.status === "waiting").sort((a, b) => a.joinedAt - b.joinedAt);
  const speaking = new Set(live.speakers);
  const station = party.phase !== "finale" ? party.station : null;
  const friend = station?.guestId ? participants.find((p) => p.id === station.guestId) : undefined;
  const isPickedMe = station?.stage === "spotlight" && !!me && station.guestId === me.id;
  const canControl = isModerator || (isCharuta && !hasModerator);
  const paused = !isCharuta || !party.started || !!station || party.phase === "movie";

  const guestsRef = useRef(guests);
  guestsRef.current = guests;

  const showToast = useCallback((text: string) => setToast({ text, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (party.phase === "finale") actions.clearReveals();
  }, [party.phase, actions]);

  /* ---------------------------- game sync ---------------------------- */

  useEffect(() => {
    if (!isCharuta || !party.started || party.phase === "finale") return;
    const t = setInterval(() => {
      const s = gameRef.current?.snapshot();
      if (s) actions.publishGame(s);
    }, 70);
    return () => clearInterval(t);
  }, [isCharuta, party.started, party.phase, actions]);

  useEffect(() => {
    if (isCharuta) return;
    actions.onGame((s) => gameRef.current?.applySnapshot(s as GameSnapshot));
    return () => actions.onGame(null);
  }, [isCharuta, actions]);

  /* ---------------------------- reactions ---------------------------- */

  const seenReactions = useRef(0);
  useEffect(() => {
    const fresh = live.reactions.filter((r) => r.id > seenReactions.current);
    if (!fresh.length) return;
    seenReactions.current = fresh[fresh.length - 1].id;
    fresh.forEach((r) => {
      setTileReactions((m) => ({ ...m, [r.from]: { emoji: r.emoji, key: r.id } }));
      setFeed((f) => [...f.slice(-3), { id: r.id, name: r.name, emoji: r.emoji, text: r.message }]);
      if (party.phase === "finale") return;
      if (r.emoji === "🎁") {
        if (isCharuta) gameRef.current?.spawnGift("gift");
        else gameRef.current?.burst("🎁");
      } else if (r.emoji === "🎂") {
        gameRef.current?.burst(r.emoji);
        if (isCharuta && Math.random() < 0.5) gameRef.current?.spawnGift("cake");
      } else gameRef.current?.burst(r.emoji === "📣" ? "🙌" : r.emoji);
    });
  }, [live.reactions, party.phase, isCharuta]);

  useEffect(() => {
    if (!feed.length) return;
    const t = setTimeout(() => setFeed((f) => f.slice(1)), 4200);
    return () => clearTimeout(t);
  }, [feed]);

  /* ------------------------- friend stations ------------------------- */

  /** Charuta reached a stop: a Friend Station (pick a card) or one of the moderator's challenges. */
  const openStation = useCallback(
    async (n: number, kind: StationKind) => {
      if (!isCharuta) return;
      if (kind === "act") {
        const idx = Math.floor(n / 2);
        let acts: string[] = [];
        try {
          acts = (await (await fetch("/api/acts")).json()).acts ?? [];
        } catch {
          /* fall back to the defaults */
        }
        const text = acts[idx]?.trim() || DEFAULT_ACTS[idx];
        if (!text) return;
        actions.setParty({ station: { n, stage: "act", act: idx, question: text } });
        return;
      }
      if (!guestsRef.current.some((p) => p.status === "waiting")) {
        showToast("Everyone's already found! Run to the Party Castle 🏰");
        return;
      }
      actions.setParty({ station: { n, stage: "pick" } });
    },
    [isCharuta, actions, showToast],
  );

  /** Charuta clicked a card: pick a random hidden friend and a question. */
  const pickFriend = () => {
    const s = partyRef.current;
    if (!isCharuta || !s.station) return;
    const waiting = guestsRef.current.filter((p) => p.status === "waiting");
    if (!waiting.length) return;
    const g = pick(waiting);
    let question: string;
    let options: string[] = [];
    let usedQ = s.usedQ;
    let usedAsk = s.usedAsk;
    // Questions come from everyone: the picked friend's own first, then other guests', then the bank.
    const pooled = guestsRef.current.find((p) => p.id !== g.id && p.question?.trim() && !usedAsk.includes(p.id));
    if (g.question?.trim() && !usedAsk.includes(g.id)) {
      question = g.question.trim();
      usedAsk = [...usedAsk, g.id];
    } else if (pooled) {
      question = `${pooled.question!.trim()}  (from ${pooled.name})`;
      usedAsk = [...usedAsk, pooled.id];
    } else {
      const all = QUESTIONS.map((_, i) => i);
      const avail = all.filter((i) => !usedQ.includes(i));
      const qi = pick(avail.length ? avail : all);
      question = QUESTIONS[qi].q;
      options = QUESTIONS[qi].options;
      usedQ = avail.length ? [...usedQ, qi] : [qi];
    }
    actions.setParty({
      station: { n: s.station.n, stage: "spotlight", guestId: g.id, question, options },
      revealed: [...new Set([...s.revealed, g.id])],
      usedQ,
      usedAsk,
    });
  };

  /** Everyone not yet found joins in, and the shared finale starts. */
  const goToFinale = useCallback(() => {
    if (!isCharuta) return;
    const waiting = guestsRef.current.filter((p) => p.status === "waiting");
    setCastleGuests(waiting.map((g) => g.name));
    if (waiting.length)
      actions.reveal(
        waiting.map((p) => p.id),
        "Waiting for you at the Party Castle!",
      );
    actions.clearReveals();
    actions.setParty({ phase: "finale", station: null });
  }, [isCharuta, actions]);

  /** Charuta reached the Party Castle: play the team's film first (if uploaded), then the finale. */
  const goToCastle = useCallback(async () => {
    if (!isCharuta || partyRef.current.phase === "movie" || partyRef.current.phase === "finale") return;
    let hasVideo = false;
    try {
      hasVideo = !!(await (await fetch("/api/video/info")).json()).exists;
    } catch {
      /* no film */
    }
    if (hasVideo) actions.setParty({ phase: "movie", station: null, movieStart: Date.now() });
    else goToFinale();
  }, [isCharuta, actions, goToFinale]);

  /** Q&A controls. Charuta's browser applies them (from the moderator, or herself). */
  const runCommand = useCallback(
    (a: ModCommand) => {
      const s = partyRef.current;
      const st: Station | null = s.station;
      if (a === "finale") return s.phase === "movie" ? goToFinale() : goToCastle();
      if (!st) return;
      const waitingLeft = guestsRef.current.filter((p) => p.status === "waiting" && p.id !== st.guestId).length;
      if (a === "close") actions.setParty({ station: null, heliDone: s.heliDone || st.stage === "spotlight" });
      if (a === "another") actions.setParty({ station: waitingLeft > 0 ? { n: st.n, stage: "pick" } : null, heliDone: true });
      if (a === "skip" && st.guestId) {
        // Put them back in the deck and pick again.
        actions.setParty({ revealed: s.revealed.filter((id) => id !== st.guestId), station: { n: st.n, stage: "pick" } });
      }
    },
    [actions, goToFinale, goToCastle],
  );

  useEffect(() => {
    if (!isCharuta) return;
    actions.onCommand(runCommand);
    return () => actions.onCommand(null);
  }, [isCharuta, actions, runCommand]);

  const control = (a: ModCommand) => (isCharuta ? runCommand(a) : actions.command(a));

  // Spotlight starts: fanfare + highlight the friend's tile.
  useEffect(() => {
    if (station?.stage !== "spotlight" || !station.guestId) return;
    sfx.reveal();
    const id = station.guestId;
    setNewIds((m) => ({ ...m, [id]: Date.now() }));
    const t = setTimeout(
      () =>
        setNewIds((m) => {
          const copy = { ...m };
          delete copy[id];
          return copy;
        }),
      20000,
    );
    return () => clearTimeout(t);
  }, [station?.stage, station?.guestId]);

  // Charuta's answer lands: confetti for everyone.
  useEffect(() => {
    if (station?.answer) {
      sfx.cheer();
      gameRef.current?.burst("🎉");
    }
  }, [station?.answer]);

  // Everyone except Charuta, the picked friend and moderators is muted during the Q&A.
  const mutedByQA = useRef(false);
  useEffect(() => {
    if (!me) return;
    const inFilm = party.phase === "movie";
    const shouldMute = inFilm
      ? !isModerator
      : (station?.stage === "spotlight" && !isCharuta && !isModerator && station.guestId !== me.id) || (station?.stage === "act" && !isCharuta && !isModerator);
    if (shouldMute && !mutedByQA.current && live.micOn) {
      mutedByQA.current = true;
      setMutedForQA(true);
      actions.setMic(false);
    } else if (!shouldMute && mutedByQA.current) {
      mutedByQA.current = false;
      setMutedForQA(false);
      actions.setMic(true);
    }
  }, [station?.stage, station?.guestId, party.phase, isCharuta, isModerator, me, live.micOn, actions]);

  // The flower helicopter comes once, after the first Q&A ends.
  const prevStation = useRef<Station | null>(null);
  const heliShown = useRef(false);
  useEffect(() => {
    const was = prevStation.current;
    prevStation.current = station;
    if (was?.stage === "spotlight" && !station && party.heliDone && !heliShown.current) {
      heliShown.current = true;
      gameRef.current?.callHelicopter();
    }
  }, [station, party.heliDone]);

  const onMilestone = useCallback(
    (m: Milestone) => {
      if (!isCharuta) return;
      showToast(`✨ ${m.label}`);
      gameRef.current?.burst("✨");
    },
    [isCharuta, showToast],
  );

  // Space / Enter on the start screen begins the quest (Charuta only).
  useEffect(() => {
    if (!isCharuta || party.started || party.phase === "finale") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.code !== "Space" && e.code !== "Enter")) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      e.preventDefault();
      actions.setParty({ started: true, phase: "playing" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCharuta, party.started, party.phase, actions]);

  const react = (emoji: string, message?: string) => {
    if (emoji === "📣") sfx.cheer();
    else sfx.pop();
    actions.react(emoji, message);
  };

  const restart = () => {
    actions.clearReveals();
    actions.setParty({ revealed: [], phase: "lobby", started: false, station: null, usedQ: [], usedAsk: [], heliDone: false, movieStart: undefined });
    gameRef.current?.reset();
    heliShown.current = false;
    setCastleGuests([]);
    setNewIds({});
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else shellRef.current?.requestFullscreen?.().catch(() => {});
  };

  const leave = () => {
    actions.leave();
    onLeave();
  };

  const audioEls = participants.filter((p) => !p.isLocal && p.audio).map((p) => <RemoteAudio key={p.id} track={p.audio!} />);
  const soundBanner = !live.canPlayAudio && (
    <button
      className="sound-banner"
      onClick={() => {
        unlockAudio();
        actions.startAudio();
      }}
    >
      🔊 Tap here to turn on sound
    </button>
  );

  /* ------------------------- connection states ------------------------- */

  if (live.conn === "connecting" || live.conn === "failed" || !me) {
    return (
      <main className="connect-screen">
        <div className="connect-card">
          {live.conn === "failed" ? (
            <>
              <h2>Couldn't reach the party room 😢</h2>
              <p>{live.error || "The video server isn't responding."}</p>
              <p className="small">Make sure you're on the same Wi-Fi as the host and the party server is running.</p>
              <div className="row">
                <button onClick={() => location.reload()}>Try again</button>
                <button className="ghost" onClick={leave}>
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="spinner">🎈</div>
              <h2>Entering the party room…</h2>
              <p>Allow your camera and microphone when your browser asks.</p>
            </>
          )}
        </div>
      </main>
    );
  }

  if (party.phase === "finale") {
    return (
      <>
        {audioEls}
        {soundBanner}
        <Finale
          participants={participants}
          speaking={speaking}
          castleGuests={castleGuests}
          isCharuta={isCharuta}
          fx={live.fx}
          onFx={actions.fx}
          micOn={live.micOn}
          camOn={live.camOn}
          onToggleMic={actions.toggleMic}
          onToggleCam={actions.toggleCam}
          onCheer={() => actions.react("🙌", "Happy birthday!!")}
          onReplay={restart}
          onLeave={leave}
          stats={stats}
          tileReactions={tileReactions}
        />
      </>
    );
  }

  const totalGuests = guests.length;
  const revealPct = totalGuests ? Math.round((revealedGuests.length / totalGuests) * 100) : 0;

  return (
    <main className="room-screen" ref={shellRef}>
      {audioEls}
      {soundBanner}
      {live.conn === "reconnecting" && <div className="reconnect-banner">Reconnecting to the party…</div>}
      <header className="topbar">
        <div className="brand-mark">
          <span>
            <Icon name="balloon" size={22} />
          </span>
          <div>
            <strong>Charuta's Birthday Quest</strong>
            <small>{isCharuta ? "Your birthday room 👑" : isModerator ? "Moderator view 🎙️" : "Live celebration room"}</small>
          </div>
        </div>
        <div className="quest-progress">
          <div>
            <span>Friends discovered</span>
            <b>
              {revealedGuests.length} / {totalGuests}
            </b>
          </div>
          <div className="progress-track">
            <i style={{ width: `${revealPct}%` }} />
          </div>
          <div className="level-track" title="Distance to the Party Castle">
            <i style={{ left: `${stats.progress * 100}%` }}>♛</i>
            <span>🏰</span>
          </div>
        </div>
        <div className="top-meta">
          <span className="live-pill">
            <i /> LIVE
          </span>
          <span className="count-pill" title="People in the room">
            <Icon name="users" size={17} /> {participants.length} in the room
          </span>
          <div className="menu-wrap">
            <button aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name="chevron" size={17} />
            </button>
            {menuOpen && (
              <div className="demo-menu" onMouseLeave={() => setMenuOpen(false)} onClick={() => setMenuOpen(false)}>
                <b>{isCharuta ? "Party controls" : isModerator ? "Moderator controls" : "Settings"}</b>
                {isCharuta && (
                  <>
                    <button onClick={goToCastle}>🏰 Go to the castle (film + finale)</button>
                    <button onClick={restart}>↻ Restart the quest (hide everyone again)</button>
                  </>
                )}
                {isModerator && <button onClick={() => control("finale")}>🏰 Send Charuta to the castle (film + finale)</button>}
                <button
                  onClick={() => {
                    setSfxMuted(soundOn);
                    setSoundOn(!soundOn);
                  }}
                >
                  {soundOn ? "🔇 Mute game sounds" : "🔊 Unmute game sounds"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="room-layout">
        <section className="game-panel">
          <GameCanvas ref={gameRef} paused={paused} spectator={!isCharuta} onMilestone={onMilestone} onStats={setStats} onFinish={goToCastle} onToast={showToast} onStation={(n, k) => void openStation(n, k)} />

          {charuta && !station && party.started && (
            <div className="charuta-pip">
              <VideoTile p={charuta} variant="pip" speaking={speaking.has(charuta.id)} reaction={tileReactions[charuta.id]} />
            </div>
          )}

          <div className="game-hud">
            <div className="hud-scores">
              <span className="hud-world-chip">{isCharuta ? "🌼 Wishful Meadows" : "🔴 Watching live"}</span>
              <span title="Wish stars">
                ⭐ {stats.stars}/{stats.totalStars}
              </span>
              <span title="Gifts">🎁 {stats.gifts}</span>
            </div>
          </div>

          <div className="cheer-feed" aria-live="polite">
            {feed.map((f) => (
              <div className="cheer-item" key={f.id}>
                <span>{f.emoji}</span>
                <p>
                  <b>{f.name}</b> {f.text ?? "is cheering for you!"}
                </p>
              </div>
            ))}
          </div>

          {toast && (
            <div className="game-toast" key={toast.key}>
              {toast.text}
            </div>
          )}

          {isCharuta && party.started && stats.progress < 0.03 && !station && (
            <div className="start-hint">
              <span className="kbd-only">
                <b>← →</b> move
              </span>
              <span className="kbd-only">
                <b>SPACE</b> jump
              </span>
              <span className="touch-only">
                <b>◀ ▶</b> move · <b>JUMP</b> to jump
              </span>
              <span>Run to the 🎁 Friend Station to meet your first friend!</span>
            </div>
          )}

          {isCharuta && !party.started && (
            <div className="game-start-overlay">
              <div className="quest-emblem">
                <span>★</span>
              </div>
              <div className="quest-label">Charuta's</div>
              <h2>Birthday Quest</h2>
              <p>
                {waitingGuests.length > 0 ? (
                  <>
                    <b>{waitingGuests.length}</b> {waitingGuests.length === 1 ? "friend is" : "friends are"} hiding somewhere in this room…
                    <br />
                    Stop at each 🎁 Friend Station, pick a card and meet a friend!
                  </>
                ) : (
                  <>
                    Run, jump and discover the people
                    <br />
                    who came to celebrate you.
                  </>
                )}
              </p>
              <ul className="quest-legend">
                <li>🌳 Jump bushes</li>
                <li>⭐ Grab stars</li>
                <li>🎁 Friend Stations</li>
                <li>🔥 Dodge flames</li>
                <li>🏰 Reach the castle</li>
              </ul>
              <button onClick={() => actions.setParty({ started: true, phase: "playing" })}>
                Begin the adventure <Icon name="play" size={17} />
              </button>
              <small className="kbd-only">Press SPACE to start · arrow keys + spacebar to play</small>
              <small className="touch-only">Use the ◀ ▶ and JUMP buttons to play</small>
            </div>
          )}

          {!isCharuta && !party.started && (
            <div className="game-start-overlay spectator-wait">
              <div className="quest-emblem">
                <span>{charuta ? "👑" : "🤫"}</span>
              </div>
              <h2>{charuta ? "Charuta is here!" : "Shh… Charuta hasn't arrived yet"}</h2>
              <p>
                {isModerator
                  ? "You're the moderator. When Charuta stops at a Friend Station and picks a friend, you'll end each Q&A so she can continue."
                  : charuta
                    ? "She's about to start her quest. Keep quiet: she can't see or hear you until she picks your card!"
                    : "When she joins and starts her quest, you'll watch her play live right here. At each Friend Station she picks a card, and it might be you!"}
              </p>
              <ul className="quest-legend">
                <li>👀 Watch her play</li>
                <li>🎴 Get picked</li>
                <li>❓ Ask her a question</li>
              </ul>
              <small>
                {otherGuests.length} other {otherGuests.length === 1 ? "guest is" : "guests are"} hiding
              </small>
            </div>
          )}

          {party.phase === "movie" && (
            <MoviePlayer
              party={party}
              isCharuta={isCharuta}
              canControl={canControl}
              charuta={charuta}
              speaking={speaking}
              onEnded={goToFinale}
              onSkip={() => control("finale")}
            />
          )}

          {station && (
            <StationOverlay
              station={station}
              charuta={charuta}
              friend={friend}
              waitingCount={waitingGuests.length}
              isCharuta={isCharuta}
              isModerator={isModerator}
              isPickedMe={isPickedMe}
              canControl={canControl}
              hasModerator={hasModerator}
              speaking={speaking}
              micOn={live.micOn}
              mutedForQA={mutedForQA}
              onPick={pickFriend}
              onAnswer={(o) => isCharuta && station && actions.setParty({ station: { ...station, answer: o } })}
              onCommand={control}
              onUnmute={() => actions.setMic(true)}
            />
          )}
        </section>

        <aside className="guest-panel">
          <div className="guest-panel-head">
            <div>
              <h2>Celebration room</h2>
              <p>
                <span /> {participants.length} {participants.length === 1 ? "person" : "people"} · everyone's cheering!
              </p>
            </div>
            <button
              onClick={() => {
                setChatOpen(!chatOpen);
                actions.readChat();
              }}
              className={chatOpen ? "active" : ""}
              aria-label="Party chat"
            >
              <Icon name="chat" size={18} />
              {live.unread > 0 && !chatOpen && <i>{live.unread > 99 ? "99+" : live.unread}</i>}
            </button>
          </div>

          {!isCharuta && (
            <div className={`status-pill ${me.status === "revealed" && !isModerator ? "found" : ""}`}>
              {isModerator
                ? "🎙️ You're the moderator. Charuta can see and hear you."
                : me.status === "revealed"
                  ? "🎉 Charuta found you! She can see and hear you now."
                  : "🤫 You're hidden. Charuta can't see or hear you until she picks your card."}
            </div>
          )}

          {charuta ? (
            <VideoTile p={charuta} variant="hero" speaking={speaking.has(charuta.id)} reaction={tileReactions[charuta.id]} />
          ) : (
            <div className="hero-placeholder">
              <span>👑</span>
              <b>Charuta hasn't joined yet</b>
              <small>Her tile will light up here when she arrives</small>
            </div>
          )}

          {!isCharuta && (
            <div className="self-row">
              <VideoTile p={{ ...me, status: "revealed" }} variant="self" speaking={speaking.has(me.id)} reaction={tileReactions[me.id]} />
              <p>{live.mediaError || (isModerator ? "You're live as the moderator 🎙️" : "You're live! Send Charuta some cheers 🎉")}</p>
            </div>
          )}
          {isCharuta && live.mediaError && <p className="media-error">{live.mediaError}</p>}
          {isModerator && <ModeratorSetup />}

          {moderators.filter((m) => !m.isLocal).length > 0 && (
            <>
              <div className="gallery-title">
                <span>Moderator</span>
              </div>
              <div className="guest-grid">
                {moderators
                  .filter((m) => !m.isLocal)
                  .map((m) => (
                    <VideoTile key={m.id} p={m} speaking={speaking.has(m.id)} reaction={tileReactions[m.id]} />
                  ))}
              </div>
            </>
          )}

          {isCharuta ? (
            <>
              <div className="gallery-title">
                <span>Friends you found</span>
                <small>
                  {revealedGuests.length} of {totalGuests}
                </small>
              </div>
              {revealedGuests.length === 0 && <p className="empty-note">No one yet. Run to a 🎁 Friend Station!</p>}
              <div className="guest-grid">
                {revealedGuests
                  .slice()
                  .sort((a, b) => (newIds[b.id] ?? 0) - (newIds[a.id] ?? 0))
                  .map((g) => (
                    <VideoTile key={g.id} p={g} speaking={speaking.has(g.id)} isNew={!!newIds[g.id]} reaction={tileReactions[g.id]} />
                  ))}
              </div>
              {waitingGuests.length > 0 && (
                <div className="mystery-crowd">
                  <div className="gallery-title">
                    <span>Hiding in the room</span>
                    <small>{waitingGuests.length} mystery guests</small>
                  </div>
                  <div className="mystery-bubbles">
                    {waitingGuests.slice(0, 60).map((g) => (
                      <i key={g.id} className={tileReactions[g.id] ? "cheering" : ""}>
                        ?
                      </i>
                    ))}
                  </div>
                  <small>Each 🎁 Friend Station lets you pick one of them!</small>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="gallery-title">
                <span>Everyone here</span>
                <small>
                  {revealedGuests.length} of {totalGuests} found
                </small>
              </div>
              {otherGuests.length === 0 && <p className="empty-note">No other guests yet. Others will appear as they join.</p>}
              <div className="guest-grid">
                {otherGuests
                  .slice()
                  .sort((a, b) => (a.status === b.status ? a.joinedAt - b.joinedAt : a.status === "revealed" ? -1 : 1))
                  .map((g) => (
                    <VideoTile key={g.id} p={{ ...g, status: "revealed" }} hiddenFromCharuta={g.status === "waiting"} speaking={speaking.has(g.id)} isNew={!!newIds[g.id]} reaction={tileReactions[g.id]} />
                  ))}
              </div>
            </>
          )}

          {chatOpen && <ChatDrawer live={live} meId={me.id} onClose={() => setChatOpen(false)} />}
        </aside>
      </div>

      <footer className="controlbar">
        <div className="control-cluster">
          <button className={!live.micOn ? "control-off" : ""} onClick={actions.toggleMic} aria-pressed={!live.micOn}>
            <span>
              <Icon name={live.micOn ? "mic" : "micOff"} size={20} />
            </span>
            <small>{live.micOn ? "Mute" : "Unmute"}</small>
          </button>
          <button className={!live.camOn ? "control-off" : ""} onClick={actions.toggleCam} aria-pressed={!live.camOn}>
            <span>
              <Icon name={live.camOn ? "camera" : "cameraOff"} size={20} />
            </span>
            <small>{live.camOn ? "Stop video" : "Start video"}</small>
          </button>
        </div>
        <div className="reaction-controls">
          <span>Send some love</span>
          {REACTIONS.map((r) => (
            <button key={r.emoji} onClick={() => react(r.emoji, r.message ?? (r.emoji === "📣" ? pick(CHEER_LINES) : undefined))} aria-label={r.label} title={r.label}>
              {r.emoji}
            </button>
          ))}
          <button className="celebrate-button" onClick={() => react("🎉", pick(CHEER_LINES))}>
            <Icon name="party" size={18} /> Celebrate!
          </button>
        </div>
        <div className="control-cluster end-controls">
          <button onClick={toggleFullscreen}>
            <span>
              <Icon name="fullscreen" size={20} />
            </span>
            <small>Full screen</small>
          </button>
          <button className="leave-button" onClick={leave}>
            <span>
              <Icon name="close" size={20} />
            </span>
            <small>Leave</small>
          </button>
        </div>
      </footer>
    </main>
  );
}

function ChatDrawer({ live, meId, onClose }: { live: LiveParty; meId: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const { actions } = live;
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    actions.readChat();
  }, [live.chat.length, actions]);
  const send = () => {
    if (!text.trim()) return;
    actions.chat(text.trim());
    setText("");
  };
  return (
    <div className="chat-drawer">
      <div className="chat-head">
        <b>Party chat</b>
        <button onClick={onClose} aria-label="Close chat">
          <Icon name="close" size={16} />
        </button>
      </div>
      <div className="messages" ref={listRef}>
        {live.chat.length === 0 && <p className="chat-empty">Say hi to everyone! 👋</p>}
        {live.chat.map((m) => (
          <p key={m.id} className={m.from === meId ? "mine" : ""}>
            <b>{m.from === meId ? "You" : m.name}</b>
            {m.text}
          </p>
        ))}
      </div>
      <div className="chat-input">
        <input autoFocus value={text} maxLength={300} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Send some love..." />
        <button onClick={send} aria-label="Send message">
          <Icon name="send" size={15} />
        </button>
      </div>
    </div>
  );
}
