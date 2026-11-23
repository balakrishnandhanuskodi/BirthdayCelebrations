import { useState } from "react";
import { Icon } from "./Icon";
import { BirthdayPlane } from "./BirthdayPlane";
import { unlockAudio } from "../lib/audio";
import { formatOpening, useSchedule } from "../lib/useSchedule";

export function FloatingDecor({ count = 18 }: { count?: number }) {
  return (
    <div className="floating-decor" aria-hidden="true">
      <span className="float-balloon b1" />
      <span className="float-balloon b2" />
      <span className="float-balloon b3" />
      {Array.from({ length: count }).map((_, i) => (
        <span className={`confetti c${i % 6}`} style={{ left: `${4 + i * (92 / count)}%`, animationDelay: `${(i % 7) * -0.9}s`, animationDuration: `${6 + (i % 4)}s` }} key={i} />
      ))}
    </div>
  );
}

export function GamePreview() {
  return (
    <section className="world-preview" aria-label="Preview of Charuta's birthday quest">
      <div className="sunburst" />
      <div className="preview-cloud p1" />
      <div className="preview-cloud p2" />
      <BirthdayPlane top="26%" duration={16} />
      <div className="preview-title">
        <small>Coming up</small>
        <strong>Charuta's Birthday Quest</strong>
      </div>
      <span className="preview-star s1">★</span>
      <span className="preview-star s2">★</span>
      <div className="preview-gift">
        <Icon name="gift" size={30} />
      </div>
      <div className="preview-character">
        <div className="char-crown">♛</div>
        <div className="char-hair" />
        <div className="char-head">•‿•</div>
        <div className="char-dress" />
        <div className="char-leg l1" />
        <div className="char-leg l2" />
      </div>
      <div className="preview-ground">
        <span className="hill h1" />
        <span className="hill h2" />
        <span className="bush" />
        <span className="platform-blocks" />
        <span className="preview-flame" />
      </div>
      <div className="preview-badge">
        <Icon name="play" size={14} /> PLAY. JUMP. UNLOCK FRIENDS.
      </div>
    </section>
  );
}

export interface JoinRequest {
  role: "guest" | "charuta" | "moderator";
  name: string;
  question?: string;
  pin?: string;
}

/** Shown to guests before the party opens. Switches to the join form by itself at the start time. */
function Countdown({ msLeft, opensAt }: { msLeft: number; opensAt: string | null }) {
  const s = Math.floor(msLeft / 1000);
  const parts = [
    { v: Math.floor(s / 86400), l: "days" },
    { v: Math.floor((s % 86400) / 3600), l: "hours" },
    { v: Math.floor((s % 3600) / 60), l: "minutes" },
    { v: s % 60, l: "seconds" },
  ].filter((p, i) => i > 0 || p.v > 0);
  return (
    <div className="name-card countdown-card">
      <div className="countdown-kicker">🎉 The party opens in</div>
      <div className="countdown">
        {parts.map((p) => (
          <div key={p.l}>
            <b>{String(p.v).padStart(2, "0")}</b>
            <small>{p.l}</small>
          </div>
        ))}
      </div>
      <p className="countdown-when">{formatOpening(opensAt)}</p>
      <p className="countdown-note">Keep this page open: the sign-in appears here automatically at the start time. 🎈</p>
    </div>
  );
}

/** The common entrance every guest uses. */
export function Welcome({ onJoin, busy, error }: { onJoin: (r: JoinRequest) => void; busy: boolean; error: string }) {
  const [name, setName] = useState(() => localStorage.getItem("party-name") ?? "");
  const [question, setQuestion] = useState("");
  const schedule = useSchedule();
  const waiting = schedule.loaded && !schedule.isOpen;
  const start = () => {
    unlockAudio();
    if (!name.trim()) return;
    localStorage.setItem("party-name", name.trim());
    onJoin({ role: "guest", name: name.trim(), question: question.trim() });
  };

  return (
    <main className="welcome-screen">
      <FloatingDecor />
      <BirthdayPlane top="3%" duration={26} delay={2} />
      <div className="welcome-cloud cloud-a" />
      <div className="welcome-cloud cloud-b" />
      <section className="welcome-copy">
        <div className="eyebrow">
          <span>✦</span> A celebration made with love <span>✦</span>
        </div>
        <h1>
          Happy Birthday,
          <br />
          <em>Charuta!</em>
        </h1>
        <p>An Adventure Full of Surprises Awaits You!</p>
        {waiting ? (
          <Countdown msLeft={schedule.msLeft} opensAt={schedule.opensAt} />
        ) : (
        <form
          className="name-card"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <div className="secret-note">🎡 Watch Charuta play live! At each Friend Station she spins a wheel of everyone's names. If it lands on you, you'll ask her a question!</div>
          <label htmlFor="participant-name">Your name</label>
          <div className="input-wrap">
            <Icon name="users" size={18} />
            <input id="participant-name" required value={name} maxLength={30} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="Enter your name to join..." />
          </div>
          <label htmlFor="question" className="second-label">
            Your question for Charuta <small>(optional, else we'll pick a fun one)</small>
          </label>
          <textarea id="question" value={question} maxLength={160} rows={2} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Masala chai or filter coffee? ☕" />
          {error && <div className="form-error">{error}</div>}
          <button className="start-button" type="submit" disabled={busy || !name.trim()}>
            <span className="button-spark">
              <Icon name="sparkle" size={18} />
            </span>
            {busy ? "Joining…" : "Start the celebration"}
            <Icon name="arrow" size={18} />
          </button>
          <button type="button" className="guest-link" disabled={busy} onClick={() => (setName("Guest"), unlockAudio(), onJoin({ role: "guest", name: "Guest", question: question.trim() }))}>
            or join as a guest <Icon name="arrow" size={14} />
          </button>
        </form>
        )}
        <p className="device-note">Allow camera & microphone when asked. Use headphones if you can.</p>
      </section>
      <GamePreview />
    </main>
  );
}

/** Charuta's own entrance (separate link, PIN protected). */
export function CharutaLogin({ onJoin, busy, error }: { onJoin: (r: JoinRequest) => void; busy: boolean; error: string }) {
  const [pin, setPin] = useState("");
  return (
    <main className="welcome-screen charuta-login">
      <FloatingDecor />
      <BirthdayPlane top="3%" duration={22} />
      <section className="welcome-copy">
        <div className="eyebrow">
          <span>👑</span> Birthday girl entrance <span>👑</span>
        </div>
        <h1>
          Welcome,
          <br />
          <em>Charuta!</em>
        </h1>
        <p>Your birthday quest is ready, and your friends are waiting inside!</p>
        <form
          className="name-card"
          onSubmit={(e) => {
            e.preventDefault();
            unlockAudio();
            onJoin({ role: "charuta", name: "Charuta", pin });
          }}
        >
          <label htmlFor="pin">Your secret PIN</label>
          <div className="input-wrap">
            <Icon name="sparkle" size={18} />
            <input id="pin" value={pin} inputMode="numeric" autoComplete="off" maxLength={12} onChange={(e) => setPin(e.target.value)} placeholder="Enter the PIN you were given" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="start-button" type="submit" disabled={busy || !pin}>
            <span className="button-spark">
              <Icon name="sparkle" size={18} />
            </span>
            {busy ? "Opening the gates…" : "Start my celebration"}
            <Icon name="arrow" size={18} />
          </button>
        </form>
        <p className="device-note">Use a laptop with a keyboard for the best game. Allow camera & microphone.</p>
      </section>
      <GamePreview />
    </main>
  );
}

/** The moderator's entrance: runs the Q&A at each Friend Station. */
export function ModeratorLogin({ onJoin, busy, error }: { onJoin: (r: JoinRequest) => void; busy: boolean; error: string }) {
  const [name, setName] = useState(() => localStorage.getItem("party-name") ?? "");
  const [pin, setPin] = useState("");
  return (
    <main className="welcome-screen charuta-login">
      <FloatingDecor />
      <section className="welcome-copy">
        <div className="eyebrow">
          <span>🎙️</span> Moderator entrance <span>🎙️</span>
        </div>
        <h1>
          Party
          <br />
          <em>Moderator</em>
        </h1>
        <p>You'll close each question round so Charuta can continue her quest.</p>
        <form
          className="name-card"
          onSubmit={(e) => {
            e.preventDefault();
            unlockAudio();
            onJoin({ role: "moderator", name: name.trim() || "Moderator", pin });
          }}
        >
          <label htmlFor="mod-name">Your name</label>
          <div className="input-wrap">
            <Icon name="users" size={18} />
            <input id="mod-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <label htmlFor="mod-pin" className="second-label">
            Moderator PIN
          </label>
          <div className="input-wrap">
            <Icon name="sparkle" size={18} />
            <input id="mod-pin" value={pin} inputMode="numeric" autoComplete="off" maxLength={12} onChange={(e) => setPin(e.target.value)} placeholder="Enter the moderator PIN" />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="start-button" type="submit" disabled={busy || !pin}>
            <span className="button-spark">
              <Icon name="sparkle" size={18} />
            </span>
            {busy ? "Joining…" : "Join as moderator"}
            <Icon name="arrow" size={18} />
          </button>
        </form>
      </section>
      <GamePreview />
    </main>
  );
}
