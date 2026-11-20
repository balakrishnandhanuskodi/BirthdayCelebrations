import { useEffect, useRef, useState } from "react";
import type { Participant } from "../realtime/types";
import type { GameStats } from "../game/engine";
import { playBirthdaySong, sfx } from "../lib/audio";
import { Icon } from "./Icon";
import { VideoTile, initials } from "./VideoTile";
import { FloatingDecor } from "./Welcome";
import { BirthdayPlane } from "./BirthdayPlane";

const LYRICS = ["Happy birthday to you", "Happy birthday to you", "Happy birthday dear Charuta", "Happy birthday to you"];
const COLORS = ["#ff5f8f", "#ffd84d", "#5ec8e5", "#7c5ce0", "#6cd27f", "#ff9a52"];

interface Props {
  participants: Participant[];
  speaking: Set<string>;
  castleGuests: string[];
  isCharuta: boolean;
  /** Shared effects: whoever presses a button, everyone sees/hears it. */
  fx: { kind: "cheer" | "song" | "party"; key: number } | null;
  onFx: (kind: "cheer" | "song" | "party") => void;
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onCheer: () => void;
  onReplay: () => void;
  onLeave: () => void;
  stats: GameStats;
  tileReactions: Record<string, { emoji: string; key: number }>;
}

export function Finale(props: Props) {
  const { participants, speaking, castleGuests, stats, fx, onFx } = props;
  const [line, setLine] = useState<number | null>(null);
  const [cheering, setCheering] = useState(false);
  const [party, setParty] = useState(false);
  const [flash, setFlash] = useState(false);
  const stopSong = useRef<(() => void) | null>(null);
  const fireworks = useRef<Fireworks | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  const charuta = participants.find((p) => p.isCharuta);
  const others = participants.filter((p) => !p.isCharuta);
  // Charuta in the centre of the group.
  const ordered = [...others.slice(0, Math.ceil(others.length / 2)), ...(charuta ? [charuta] : []), ...others.slice(Math.ceil(others.length / 2))];

  useEffect(() => {
    const fw = new Fireworks(canvasRef.current!);
    fireworks.current = fw;
    sfx.fanfare();
    return () => {
      fw.destroy();
      stopSong.current?.();
    };
  }, []);

  // Run whichever effect someone in the room triggered.
  const lastFx = useRef(fx?.key ?? 0);
  useEffect(() => {
    if (!fx || fx.key === lastFx.current) return;
    lastFx.current = fx.key;
    if (fx.kind === "cheer") cheer();
    if (fx.kind === "song") song();
    if (fx.kind === "party") groupCelebration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fx]);

  const cheer = () => {
    sfx.cheer();
    setCheering(false);
    requestAnimationFrame(() => setCheering(true));
    setTimeout(() => setCheering(false), 2400);
    fireworks.current?.salvo(6);
  };

  const song = () => {
    stopSong.current?.();
    setLine(0);
    stopSong.current = playBirthdaySong(
      (l) => {
        setLine(l);
        fireworks.current?.salvo(2);
      },
      () => {
        setLine(null);
        fireworks.current?.salvo(8);
      },
    );
  };

  const groupCelebration = () => {
    setParty(true);
    sfx.cheer();
    fireworks.current?.salvo(10);
    setTimeout(() => setParty(false), 5200);
  };

  const screenshot = async () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 450);
    const videos = new Map<string, HTMLVideoElement>();
    galleryRef.current?.querySelectorAll<HTMLElement>("[data-pid]").forEach((el) => {
      const v = el.querySelector("video");
      if (v && el.dataset.pid) videos.set(el.dataset.pid, v);
    });
    const url = renderGroupPhoto(ordered, videos, stats);
    const a = document.createElement("a");
    a.download = "charuta-birthday-group-photo.png";
    a.href = url;
    a.click();
  };

  return (
    <main className={`finale-screen ${cheering ? "cheering" : ""} ${party ? "party" : ""} ${others.length > 24 ? "crowd-xl" : others.length > 12 ? "crowd-l" : ""}`}>
      <canvas ref={canvasRef} className="fireworks-canvas" aria-hidden="true" />
      <FloatingDecor count={24} />
      <BirthdayPlane top="4%" duration={20} />
      <BirthdayPlane top="62%" duration={28} delay={9} reverse />
      {flash && <div className="camera-flash" />}
      {party && (
        <div className="balloon-release" aria-hidden="true">
          {Array.from({ length: 22 }).map((_, i) => (
            <span key={i} style={{ left: `${(i * 4.7) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 7) * 0.18}s` }} />
          ))}
        </div>
      )}
      <div className="finale-content">
        <div className="finale-kicker">
          <Icon name="sparkle" size={16} /> Quest complete · {participants.length} people celebrating <Icon name="sparkle" size={16} />
        </div>
        <h1>
          HAPPY BIRTHDAY
          <br />
          <em>CHARUTA!</em>
        </h1>
        <p>
          Your greatest gift is having all these wonderful people{" "}
          <br />
          together to celebrate <strong>you!</strong>
        </p>
        {castleGuests.length > 0 && (
          <div className="castle-note">🏰 Waiting inside the castle: {castleGuests.join(", ")}!</div>
        )}

        <div className="finale-stage">
          <div className="finale-gallery" ref={galleryRef}>
            {charuta && (
              <div className="final-hero-row">
                <div className="final-person is-charuta">
                  <i className="star-badge">👑 Birthday star</i>
                  <VideoTile p={charuta} variant="finale" speaking={speaking.has(charuta.id)} reaction={props.tileReactions[charuta.id]} />
                </div>
              </div>
            )}
            {others.map((p, i) => (
              <div className="final-person" key={p.id} style={{ animationDelay: `${0.2 + i * 0.09}s` }}>
                <VideoTile p={{ ...p, status: "revealed" }} variant="finale" speaking={speaking.has(p.id)} reaction={props.tileReactions[p.id]} />
              </div>
            ))}
          </div>
          <div className="cake">
            <div className="candles">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i}>
                  <b className="flame" />
                </span>
              ))}
            </div>
            <div className="cake-top">HAPPY BIRTHDAY</div>
            <div className="cake-mid" />
            <div className="cake-base">
              <b>CHARUTA</b>
            </div>
          </div>
        </div>

        <div className={`song-bubble ${line === null ? "hidden" : ""}`} aria-live="polite">
          {LYRICS.map((l, i) => (
            <span key={i} className={i === line ? "on" : line !== null && i < line ? "done" : ""}>
              ♪ {l}
            </span>
          ))}
        </div>

        <div className="final-actions">
          <button
            className="cheer-all"
            onClick={() => {
              props.onCheer();
              onFx("cheer");
            }}
          >
            <Icon name="party" size={19} /> Everyone cheer together
          </button>
          <button onClick={() => (line !== null ? (stopSong.current?.(), setLine(null)) : onFx("song"))} className={line !== null ? "active" : ""}>
            <span>♪</span> {line !== null ? "Stop the song" : "Birthday song"}
          </button>
          <button onClick={() => onFx("party")}>
            <span>🎈</span> Group celebration
          </button>
          <button onClick={screenshot}>
            <Icon name="camera" size={18} /> Take group screenshot
          </button>
          {props.isCharuta && (
            <button onClick={props.onReplay}>
              <span>↻</span> Replay adventure
            </button>
          )}
        </div>
        <div className="finale-media">
          <button className={props.micOn ? "" : "off"} onClick={props.onToggleMic} aria-label={props.micOn ? "Mute microphone" : "Unmute microphone"}>
            <Icon name={props.micOn ? "mic" : "micOff"} size={18} />
          </button>
          <button className={props.camOn ? "" : "off"} onClick={props.onToggleCam} aria-label={props.camOn ? "Stop camera" : "Start camera"}>
            <Icon name={props.camOn ? "camera" : "cameraOff"} size={18} />
          </button>
          <span>
            {participants.length} people celebrating · sing along! Your mic is {props.micOn ? "on" : "muted"}.
          </span>
          <button className="leave" onClick={props.onLeave}>
            Leave
          </button>
        </div>
      </div>
    </main>
  );
}

/* --------------------------- fireworks --------------------------- */

class Fireworks {
  private ctx: CanvasRenderingContext2D;
  private parts: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  private raf = 0;
  private lastBoom = 0;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.loop();
  }
  destroy() {
    cancelAnimationFrame(this.raf);
  }
  salvo(n: number) {
    for (let i = 0; i < n; i++) setTimeout(() => this.boom(), i * 140);
  }
  private tick() {
    const now = performance.now();
    if (now - this.lastBoom > 900) {
      this.lastBoom = now;
      this.boom();
    }
  }
  private boom() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const x = w * (0.1 + Math.random() * 0.8);
    const y = h * (0.08 + Math.random() * 0.35);
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const s = 2 + Math.random() * 2.6;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c });
    }
  }
  private loop = () => {
    this.tick();
    if (this.parts.length > 2500) this.parts.splice(0, this.parts.length - 2500);
    const c = this.ctx;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(w * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    for (const p of this.parts) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.035;
      p.vx *= 0.985;
      p.life -= 0.012;
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.c;
      c.beginPath();
      c.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.life > 0);
    this.raf = requestAnimationFrame(this.loop);
  };
}

/* ------------------------ group screenshot ------------------------ */

function firstColor(bg: string) {
  return bg.match(/#[0-9a-f]{3,8}/gi) ?? ["#6a50db", "#2a1c5e"];
}

function renderGroupPhoto(people: Participant[], videos: Map<string, HTMLVideoElement>, stats: GameStats) {
  const W = 1600;
  const H = 1000;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(W / 2, H * 0.4, 50, W / 2, H * 0.4, W * 0.7);
  g.addColorStop(0, "#6f58d8");
  g.addColorStop(0.5, "#3b297f");
  g.addColorStop(1, "#251858");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    c.fillStyle = COLORS[i % COLORS.length];
    c.save();
    c.translate((i * 197) % W, (i * 83) % H);
    c.rotate(i);
    c.fillRect(-4, -8, 8, 16);
    c.restore();
  }
  c.textAlign = "center";
  c.fillStyle = "#ffdc4e";
  c.font = "700 92px Fredoka, Arial, sans-serif";
  c.fillText("HAPPY BIRTHDAY CHARUTA!", W / 2, 140);
  c.fillStyle = "#e9e3ff";
  c.font = "500 30px 'DM Sans', Arial, sans-serif";
  c.fillText("Your greatest gift is having all these wonderful people together to celebrate you!", W / 2, 195);

  const cols = Math.min(9, Math.max(3, Math.ceil(Math.sqrt(people.length * 1.6))));
  const rows = Math.ceil(people.length / cols);
  const gap = people.length > 20 ? 12 : 24;
  const tw = Math.min(270, (W - 120 - (cols - 1) * gap) / cols, ((640 - (rows - 1) * gap) / rows) * (4 / 3));
  const th = tw * 0.76;
  const gridH = rows * th + (rows - 1) * gap;
  const top = 250 + (640 - gridH) / 2;
  people.forEach((p, i) => {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, people.length - r * cols);
    const col = i % cols;
    const x = W / 2 - (inRow * tw + (inRow - 1) * gap) / 2 + col * (tw + gap);
    const y = top + r * (th + gap);
    c.save();
    c.beginPath();
    c.roundRect(x, y, tw, th, tw * 0.08);
    c.clip();
    const [c1, c2] = firstColor(p.look.bg);
    const lg = c.createLinearGradient(x, y, x + tw, y + th);
    lg.addColorStop(0, c1);
    lg.addColorStop(1, c2 ?? c1);
    c.fillStyle = lg;
    c.fillRect(x, y, tw, th);
    const video = videos.get(p.id);
    if (video && video.videoWidth && p.camOn) {
      const s = Math.max(tw / video.videoWidth, th / video.videoHeight);
      const vw = video.videoWidth * s;
      const vh = video.videoHeight * s;
      c.save();
      c.translate(x + tw / 2, y + th / 2);
      if (p.isLocal) c.scale(-1, 1);
      c.drawImage(video, -vw / 2, -vh / 2, vw, vh);
      c.restore();
    } else if (p.camOn) {
      // Avatar drawn at a 270px reference size, scaled to the tile.
      const k = tw / 270;
      c.save();
      c.translate(x, y);
      c.scale(k, k);
      const cx = 135;
      const y0 = 0;
      const th0 = th / k;
      c.fillStyle = p.look.shirt;
      c.beginPath();
      c.ellipse(cx, y0 + th0 + 10, 75, 70, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.look.hair;
      c.beginPath();
      c.ellipse(cx, y0 + 92, 58, 62, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.look.skin;
      c.beginPath();
      c.arc(cx, y0 + 100, 46, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#2d1b34";
      c.beginPath();
      c.arc(cx - 16, y0 + 98, 5, 0, Math.PI * 2);
      c.arc(cx + 16, y0 + 98, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#5e2a37";
      c.lineWidth = 4;
      c.beginPath();
      c.arc(cx, y0 + 110, 13, 0.2, Math.PI - 0.2);
      c.stroke();
      if (p.isCharuta) {
        c.fillStyle = "#ffd84d";
        c.font = "54px serif";
        c.fillText("♛", cx, y0 + 52);
      }
      c.restore();
    } else {
      c.fillStyle = p.look.shirt;
      c.beginPath();
      c.arc(x + tw / 2, y + th / 2 - tw * 0.04, tw * 0.18, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#fff";
      c.font = `700 ${Math.round(tw * 0.13)}px Fredoka, Arial`;
      c.fillText(initials(p.name), x + tw / 2, y + th / 2 + tw * 0.01);
    }
    const shade = c.createLinearGradient(0, y + th - 70, 0, y + th);
    shade.addColorStop(0, "rgba(20,12,50,0)");
    shade.addColorStop(1, "rgba(20,12,50,.75)");
    c.fillStyle = shade;
    c.fillRect(x, y + th - 70, tw, 70);
    c.fillStyle = "#fff";
    c.font = `700 ${Math.round(Math.max(13, tw / 10.5))}px 'DM Sans', Arial`;
    c.textAlign = "left";
    c.fillText(p.name, x + tw * 0.06, y + th - tw * 0.065);
    c.textAlign = "center";
    c.restore();
    c.strokeStyle = p.isCharuta ? "#ffd84d" : "rgba(255,255,255,.6)";
    c.lineWidth = p.isCharuta ? 7 : 3;
    c.beginPath();
    c.roundRect(x, y, tw, th, 22);
    c.stroke();
  });
  c.fillStyle = "#cfc5f5";
  c.font = "500 24px 'DM Sans', Arial";
  const date = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  c.fillText(`Charuta's Birthday Quest · ${date} · ${people.length} people`, W / 2, H - 40);
  return cv.toDataURL("image/png");
}
