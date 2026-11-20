import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Screen = "welcome" | "room" | "finale";
type IconName =
  | "arrow"
  | "balloon"
  | "camera"
  | "cameraOff"
  | "chat"
  | "chevron"
  | "close"
  | "fullscreen"
  | "gift"
  | "heart"
  | "home"
  | "mic"
  | "micOff"
  | "party"
  | "play"
  | "send"
  | "sparkle"
  | "users";

const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="m9 18 6-6-6-6" /></>,
    balloon: <><path d="M16 8c0 4-1.8 7-4 7s-4-3-4-7 1.8-5 4-5 4 1 4 5Z" /><path d="m10 15 2 2 2-2M12 17c-2 2 2 3 0 5" /></>,
    camera: <><path d="m16 9 5-3v12l-5-3Z" /><rect x="3" y="5" width="13" height="14" rx="3" /></>,
    cameraOff: <><path d="m3 3 18 18M10.5 5H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h10M16 8l5-2v10M16 13V8a3 3 0 0 0-3-3h-1" /></>,
    chat: <><path d="M21 14a4 4 0 0 1-4 4H9l-6 3v-7a4 4 0 0 1-1-2.6V7a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4Z" /><path d="M7 10h.01M12 10h.01M17 10h.01" /></>,
    chevron: <><path d="m6 9 6 6 6-6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    fullscreen: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></>,
    gift: <><path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7H7.5a2.5 2.5 0 1 1 2.1-3.85L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.1-3.85L12 7Z" /></>,
    heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></>,
    home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" /></>,
    mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></>,
    micOff: <><path d="m3 3 18 18M9 9v2a3 3 0 0 0 4.8 2.4M15 9V5a3 3 0 0 0-5.1-2.1M5 10a7 7 0 0 0 11.8 5.1M19 10a7 7 0 0 1-.5 2.6M12 17v5M8 22h8" /></>,
    party: <><path d="m4 20 4-12 8 8-12 4Z" /><path d="m9 15 3-3M14 3v2M20 9h2M18.5 4.5 17 6M20 14l-2-1M10 2l1 2" /></>,
    play: <><path d="m8 5 11 7-11 7Z" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    sparkle: <><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3ZM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15ZM5 14l.7 2.3L8 17l-2.3.7L5 20l-.7-2.3L2 17l2.3-.7L5 14Z" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

const guests = [
  { name: "Rohan", role: "College bestie", initials: "RS", color: "#5d5fda", skin: "#d59d7a", shirt: "#ff745f" },
  { name: "Neha", role: "Sister", initials: "NK", color: "#ef6aa5", skin: "#b96f4d", shirt: "#ffc63f" },
  { name: "Aarav", role: "Work friend", initials: "AM", color: "#21a6a1", skin: "#9a5c3c", shirt: "#5f7bea" },
  { name: "Meera", role: "School friend", initials: "MP", color: "#f0813c", skin: "#e3aa83", shirt: "#9f67d9" },
  { name: "Kabir", role: "Cousin", initials: "KS", color: "#7658d6", skin: "#bd7959", shirt: "#43b784" },
];

const unlockEvents = [
  "You leapt over the birthday bush!",
  "You collected a golden wish!",
  "You crossed the cloud bridge!",
  "You made it past the candle flame!",
  "You opened the final surprise!",
];

const cheerMessages = [
  "Come on Charuta! You can do it!",
  "One more surprise awaits!",
  "Your friends are cheering for you!",
  "Keep going, Birthday Girl!",
];

function Avatar({ index, large = false }: { index: number; large?: boolean }) {
  const person = guests[index] ?? { color: "#ff7c72", skin: "#b87350", shirt: "#6456d9" };
  return (
    <div className={`avatar-art ${large ? "avatar-large" : ""}`} style={{ background: `linear-gradient(145deg, ${person.color}, #20184f)` }}>
      <div className="avatar-glow" />
      <div className="avatar-hair" />
      <div className="avatar-face" style={{ background: person.skin }}>
        <span className="eye eye-left" /><span className="eye eye-right" /><span className="smile" />
      </div>
      <div className="avatar-body" style={{ background: person.shirt }} />
    </div>
  );
}

function FloatingDecor() {
  return (
    <div className="floating-decor" aria-hidden="true">
      <span className="float-balloon b1" /><span className="float-balloon b2" /><span className="float-balloon b3" />
      {Array.from({ length: 18 }).map((_, i) => <span className={`confetti c${i % 6}`} style={{ left: `${4 + i * 5.4}%`, animationDelay: `${(i % 7) * -.45}s` }} key={i} />)}
    </div>
  );
}

function Welcome({ onStart }: { onStart: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <main className="welcome-screen">
      <FloatingDecor />
      <div className="welcome-cloud cloud-a" /><div className="welcome-cloud cloud-b" />
      <section className="welcome-copy">
        <div className="eyebrow"><span>✦</span> A celebration made with love <span>✦</span></div>
        <h1>Happy Birthday,<br /><em>Charuta!</em></h1>
        <p>An adventure full of surprises awaits you.</p>
        <div className="name-card">
          <label htmlFor="participant-name">Your name</label>
          <div className="input-wrap">
            <Icon name="users" size={18} />
            <input id="participant-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name to join..." onKeyDown={(e) => e.key === "Enter" && onStart(name || "Guest")} />
          </div>
          <button className="start-button" onClick={() => onStart(name || "Guest")}>
            <span className="button-spark"><Icon name="sparkle" size={18} /></span>
            Start the celebration
            <Icon name="arrow" size={18} />
          </button>
          <button className="guest-link" onClick={() => onStart("Guest")}>or join as a guest <Icon name="arrow" size={14} /></button>
        </div>
        <div className="guest-preview">
          <div className="mini-avatars">{guests.slice(0, 4).map((g, i) => <span key={g.name} style={{ background: g.color }}>{g.initials}</span>)}</div>
          <div><strong>5 friends are waiting</strong><small>Your party room is ready!</small></div>
        </div>
      </section>
      <section className="world-preview" aria-label="Preview of Charuta's birthday quest">
        <div className="sunburst" /><div className="preview-cloud p1" /><div className="preview-cloud p2" />
        <div className="preview-title"><small>Coming up</small><strong>Charuta's Birthday Quest</strong></div>
        <span className="preview-star s1">★</span><span className="preview-star s2">★</span>
        <div className="preview-gift"><Icon name="gift" size={30} /></div>
        <div className="preview-character"><div className="char-hair" /><div className="char-head">•‿•</div><div className="char-dress" /><div className="char-leg l1" /><div className="char-leg l2" /></div>
        <div className="preview-ground"><span className="hill h1" /><span className="hill h2" /><span className="bush" /><span className="platform-blocks" /></div>
        <div className="preview-badge"><Icon name="play" size={14} /> PLAY. JUMP. UNLOCK FRIENDS.</div>
      </section>
    </main>
  );
}

function ParticipantTile({ index, locked, active }: { index: number; locked: boolean; active?: boolean }) {
  const guest = guests[index];
  return (
    <div className={`participant-tile ${locked ? "locked" : ""} ${active ? "active-speaker" : ""}`}>
      {locked ? (
        <div className="waiting-avatar"><span>?</span><small>Waiting to be<br />discovered</small></div>
      ) : <Avatar index={index} />}
      <div className="tile-gradient" />
      <div className="tile-status">
        <span className="name-dot">{active && <i />} {locked ? "Mystery guest" : guest.name}</span>
        <span className="tiny-mic"><Icon name={locked ? "micOff" : "mic"} size={12} /></span>
      </div>
      {locked && <span className="lock-pill">Waiting</span>}
    </div>
  );
}

function Charuta({ jumping }: { jumping: boolean }) {
  return (
    <div className={`game-char ${jumping ? "jumping" : ""}`}>
      <span className="char-shadow" /><span className="char-ponytail" /><span className="char-face">•ᴗ•</span>
      <span className="char-crown">♛</span><span className="char-body" /><span className="char-arm a1" /><span className="char-arm a2" />
      <span className="char-shoe sh1" /><span className="char-shoe sh2" />
    </div>
  );
}

function GameWorld({ x, jumping, unlocked }: { x: number; jumping: boolean; unlocked: number }) {
  const shift = Math.min(Math.max(x - 35, 0), 48);
  return (
    <div className="game-world">
      <div className="sky-cloud gc1" /><div className="sky-cloud gc2" /><div className="sky-cloud gc3" />
      <div className="far-hill fh1" /><div className="far-hill fh2" /><div className="far-hill fh3" />
      <div className="world-scroll" style={{ transform: `translateX(-${shift}%)` }}>
        <div className="game-title-card"><small>Welcome to</small><strong>Wishful Meadows</strong></div>
        <div className="collect-star st1">★</div><div className="collect-star st2">★</div>
        <div className="game-bush bush1"><i /><i /><i /></div>
        <div className="brick-platform bp1">{Array.from({ length: 5 }).map((_, i) => <i key={i} />)}</div>
        <div className="floating-platform fp1" /><div className="floating-platform fp2" />
        <div className="candle-fire"><span /><i /></div>
        <div className="surprise-box"><Icon name="gift" size={28} /></div>
        <div className="castle"><div className="castle-tower t1" /><div className="castle-tower t2" /><div className="castle-center"><span>♥</span></div></div>
        {[15, 30, 47, 64, 81].map((left, i) => <div key={left} className={`checkpoint ${unlocked > i ? "done" : ""}`} style={{ left: `${left}%` }}><span>{unlocked > i ? "✓" : i + 1}</span></div>)}
      </div>
      <div className="grass-strip" /><div className="dirt-strip" />
      <div className="char-position" style={{ left: `${Math.min(x, 48)}%` }}><Charuta jumping={jumping} /></div>
      <div className="quest-hint"><span><b>← →</b> Move</span><span><b>SPACE</b> Jump</span></div>
    </div>
  );
}

function UnlockModal({ index, onClose }: { index: number; onClose: () => void }) {
  const guest = guests[index];
  return (
    <div className="unlock-overlay">
      <div className="unlock-rays" />
      <div className="unlock-card">
        <button className="modal-close" onClick={onClose} aria-label="Close surprise"><Icon name="close" size={18} /></button>
        <div className="surprise-tag"><Icon name="sparkle" size={14} /> Guest unlocked!</div>
        <div className="unlock-avatar"><Avatar index={index} large /><span className="avatar-ring ring1" /><span className="avatar-ring ring2" /></div>
        <h2>Surprise!</h2>
        <h3>{guest.name} is here to celebrate with you!</h3>
        <p>“Happy birthday, Charuta! Keep going — there are more surprises waiting!”</p>
        <div className="unlock-event"><span>✓</span>{unlockEvents[index]}</div>
        <button className="continue-button" onClick={onClose}>Keep adventuring <Icon name="arrow" size={17} /></button>
      </div>
      {Array.from({ length: 24 }).map((_, i) => <i key={i} className={`unlock-confetti uc${i % 5}`} style={{ left: `${i * 4.2}%`, animationDelay: `${(i % 8) * -.12}s` }} />)}
    </div>
  );
}

function Finale({ onReplay }: { onReplay: () => void }) {
  const [singing, setSinging] = useState(false);
  const [cheering, setCheering] = useState(false);
  const downloadKeepsake = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 700;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1200, 700);
    gradient.addColorStop(0, "#4b36b8"); gradient.addColorStop(1, "#f05c9c");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1200, 700);
    ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.font = "700 34px Arial"; ctx.fillText("CHARUTA'S BIRTHDAY ADVENTURE", 600, 90);
    ctx.fillStyle = "#ffd655"; ctx.font = "900 80px Arial"; ctx.fillText("HAPPY BIRTHDAY!", 600, 205);
    ctx.fillStyle = "#fff"; ctx.font = "700 54px Arial"; ctx.fillText("CHARUTA", 600, 275);
    guests.forEach((g, i) => { ctx.beginPath(); ctx.fillStyle = g.color; ctx.arc(220 + i * 190, 420, 68, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "700 26px Arial"; ctx.fillText(g.initials, 220 + i * 190, 430); ctx.font = "600 20px Arial"; ctx.fillText(g.name, 220 + i * 190, 520); });
    ctx.font = "24px Arial"; ctx.fillText("Together is the best gift of all.", 600, 625);
    const link = document.createElement("a"); link.download = "charuta-birthday-keepsake.png"; link.href = canvas.toDataURL(); link.click();
  };
  return (
    <main className={`finale-screen ${cheering ? "cheering" : ""}`}>
      <FloatingDecor />
      <div className="firework fw1" /><div className="firework fw2" /><div className="firework fw3" />
      <div className="finale-content">
        <div className="finale-kicker"><Icon name="sparkle" size={16} /> Quest complete <Icon name="sparkle" size={16} /></div>
        <h1>Happy Birthday<br /><em>Charuta!</em></h1>
        <p>Your greatest gift is having all these wonderful people<br />together to celebrate <strong>you!</strong></p>
        <div className="finale-gallery">
          {guests.map((g, i) => <div className="final-person" key={g.name}><Avatar index={i} /><span>{g.name}</span></div>)}
          <div className="final-person charuta-final"><div className="final-char">♛<span>•ᴗ•</span></div><span>Charuta</span><i>Birthday star</i></div>
        </div>
        <div className="cake"><span className="flame">◆</span><i className="candle" /><div className="cake-top">HAPPY BIRTHDAY</div><div className="cake-base"><b>CHARUTA</b></div></div>
        {singing && <div className="song-bubble">♪ Happy birthday to you, happy birthday dear Charuta... ♪</div>}
        <div className="final-actions">
          <button className="cheer-all" onClick={() => { setCheering(true); setTimeout(() => setCheering(false), 2200); }}><Icon name="party" size={19} /> Everyone cheer together</button>
          <button onClick={() => setSinging(!singing)}><span>♪</span> Birthday song</button>
          <button onClick={downloadKeepsake}><Icon name="camera" size={18} /> Take group keepsake</button>
          <button onClick={onReplay}><span>↻</span> Replay adventure</button>
        </div>
      </div>
    </main>
  );
}

function CelebrationRoom({ onLeave, onFinish }: { onLeave: () => void; onFinish: () => void }) {
  const [started, setStarted] = useState(false);
  const [x, setX] = useState(3);
  const [jumping, setJumping] = useState(false);
  const [unlocked, setUnlocked] = useState(0);
  const [modalGuest, setModalGuest] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [reaction, setReaction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(["Neha: You’ve got this!", "Rohan: Look out for the stars!"]);
  const [showHint, setShowHint] = useState(true);
  const gameRef = useRef<HTMLDivElement>(null);
  const jumpingRef = useRef(false);

  const playChime = useCallback(() => {
    try {
      const audio = new AudioContext(); const osc = audio.createOscillator(); const gain = audio.createGain();
      osc.connect(gain); gain.connect(audio.destination); osc.frequency.setValueAtTime(523, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(880, audio.currentTime + .18);
      gain.gain.setValueAtTime(.08, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .35); osc.start(); osc.stop(audio.currentTime + .35);
    } catch { /* Audio is an enhancement; gameplay continues without it. */ }
  }, []);

  const jump = useCallback(() => {
    if (jumpingRef.current || !started || modalGuest !== null) return;
    jumpingRef.current = true; setJumping(true);
    setTimeout(() => { jumpingRef.current = false; setJumping(false); }, 650);
  }, [started, modalGuest]);

  const move = useCallback((amount: number) => {
    if (!started || modalGuest !== null) return;
    setShowHint(false);
    setX((current) => Math.max(2, Math.min(96, current + amount)));
  }, [started, modalGuest]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code === "ArrowRight") { event.preventDefault(); move(2.4); }
      if (event.code === "ArrowLeft") { event.preventDefault(); move(-2.4); }
      if (event.code === "Space") { event.preventDefault(); jump(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, jump]);

  useEffect(() => {
    const thresholds = [14, 32, 50, 68, 86];
    const next = thresholds.findIndex((threshold, i) => i >= unlocked && x >= threshold);
    if (next >= 0) {
      setUnlocked(next + 1); setModalGuest(next); playChime();
    }
    if (x >= 94 && unlocked >= 5) setTimeout(onFinish, 450);
  }, [x, unlocked, onFinish, playChime]);

  const react = (symbol: string) => {
    setReaction(symbol);
    setTimeout(() => setReaction(null), 1600);
  };
  const sendMessage = () => {
    if (!message.trim()) return;
    setMessages((old) => [...old, `You: ${message.trim()}`]); setMessage("");
  };
  const progress = Math.round((unlocked / guests.length) * 100);

  return (
    <main className="room-screen">
      <header className="topbar">
        <div className="brand-mark"><span><Icon name="balloon" size={22} /></span><div><strong>Charuta's Birthday Quest</strong><small>Live celebration room</small></div></div>
        <div className="quest-progress"><div><span>Adventure progress</span><b>{progress}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div>
        <div className="top-meta"><span className="live-pill"><i /> LIVE</span><span><Icon name="users" size={17} /> 6 celebrating</span><button aria-label="Open menu"><Icon name="chevron" size={17} /></button></div>
      </header>

      <div className="room-layout">
        <section className="game-panel" ref={gameRef}>
          <div className="game-panel-label"><div><span>World 1</span><b>Wishful Meadows</b></div><div className="score-items"><span>★ {unlocked * 120}</span><span><Icon name="gift" size={14} /> {unlocked}/5</span></div></div>
          <GameWorld x={x} jumping={jumping} unlocked={unlocked} />
          {!started && <div className="game-start-overlay"><div className="quest-emblem"><span>★</span></div><div className="quest-label">Charuta's</div><h2>Birthday Quest</h2><p>Run, jump, and discover the people<br />who came to celebrate you.</p><button onClick={() => { setStarted(true); setShowHint(true); }}>Begin the adventure <Icon name="play" size={17} /></button><small>Use arrow keys + spacebar to play</small></div>}
          {reaction && <div className="game-reaction">{reaction}<span>{cheerMessages[Math.floor(Math.random() * cheerMessages.length)]}</span></div>}
          {showHint && started && <div className="start-hint">Head toward your first surprise! <Icon name="arrow" size={16} /></div>}
          <div className="mobile-controls">
            <button onPointerDown={() => move(-3)} aria-label="Move left">‹</button><button onPointerDown={() => move(3)} aria-label="Move right">›</button><button className="jump-control" onPointerDown={jump}>Jump ↑</button>
          </div>
        </section>

        <aside className="guest-panel">
          <div className="guest-panel-head"><div><h2>Celebration room</h2><p><span /> Everyone's cheering for you!</p></div><button onClick={() => setChatOpen(!chatOpen)} className={chatOpen ? "active" : ""}><Icon name="chat" size={18} /><i>2</i></button></div>
          <div className="charuta-tile">
            <div className="charuta-video"><div className="video-charuta"><span className="v-hair" /><span className="v-face">•‿•</span><span className="v-shirt" /></div><span className="hero-crown">♛</span></div>
            <div className="charuta-name"><b>Charuta</b><span>Birthday Girl</span></div><div className="speaking-bars"><i /><i /><i /></div>
          </div>
          <div className="gallery-title"><span>Surprise guests</span><small>{unlocked} of {guests.length} revealed</small></div>
          <div className="guest-grid">{guests.map((guest, i) => <ParticipantTile key={guest.name} index={i} locked={i >= unlocked} active={unlocked > 0 && i === unlocked - 1} />)}</div>
          <div className="waiting-note"><span><Icon name="sparkle" size={14} /></span><p><b>{guests.length - unlocked} surprises still hidden</b><small>Keep playing to reveal everyone!</small></p></div>
          {chatOpen && <div className="chat-drawer"><div className="chat-head"><b>Party chat</b><button onClick={() => setChatOpen(false)}><Icon name="close" size={16} /></button></div><div className="messages">{messages.map((msg, i) => <p key={i}>{msg}</p>)}</div><div className="chat-input"><input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Send some love..." /><button onClick={sendMessage}><Icon name="send" size={15} /></button></div></div>}
        </aside>
      </div>

      <footer className="controlbar">
        <div className="control-cluster">
          <button className={muted ? "control-off" : ""} onClick={() => setMuted(!muted)}><span><Icon name={muted ? "micOff" : "mic"} size={20} /></span><small>{muted ? "Unmute" : "Mute"}</small></button>
          <button className={!camera ? "control-off" : ""} onClick={() => setCamera(!camera)}><span><Icon name={camera ? "camera" : "cameraOff"} size={20} /></span><small>{camera ? "Stop video" : "Start video"}</small></button>
        </div>
        <div className="reaction-controls">
          <span>Send some love</span>
          <button onClick={() => react("♥")} aria-label="Send heart">♥</button><button onClick={() => react("👏")} aria-label="Clap">👏</button><button onClick={() => react("🎂")} aria-label="Send cake">🎂</button><button onClick={() => react("🎈")} aria-label="Send balloon">🎈</button>
          <button className="celebrate-button" onClick={() => react("🎉")}><Icon name="party" size={18} /> Celebrate!</button>
        </div>
        <div className="control-cluster end-controls">
          <button onClick={() => gameRef.current?.requestFullscreen?.()}><span><Icon name="fullscreen" size={20} /></span><small>Full screen</small></button>
          <button className="leave-button" onClick={onLeave}><span><Icon name="close" size={20} /></span><small>Leave</small></button>
        </div>
      </footer>
      {modalGuest !== null && <UnlockModal index={modalGuest} onClose={() => setModalGuest(null)} />}
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [, setParticipantName] = useState("");
  const roomKey = useMemo(() => screen, [screen]);
  if (screen === "welcome") return <Welcome onStart={(name) => { setParticipantName(name); setScreen("room"); }} />;
  if (screen === "finale") return <Finale onReplay={() => setScreen("room")} />;
  return <CelebrationRoom key={roomKey} onLeave={() => setScreen("welcome")} onFinish={() => setScreen("finale")} />;
}
