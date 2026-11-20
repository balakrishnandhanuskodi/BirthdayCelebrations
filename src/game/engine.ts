import type { Milestone } from "../realtime/types";
import { sfx } from "../lib/audio";

/* ------------------------------------------------------------------ */
/*  Charuta's Birthday Quest: a small canvas platformer.               */
/*  World units: the level is 540 tall; the canvas scales to fit.      */
/* ------------------------------------------------------------------ */

const H = 540;
const GROUND_Y = 450;
const LEVEL_W = 5600;
const FINISH_X = 5030;
const PW = 32;
const PH = 60;
const GRAVITY = 2300;
const JUMP_V = 860;
const RUN = 285;
const STEP = 1 / 120;

type Rect = { x: number; y: number; w: number; h: number };
type Block = Rect & { kind: "brick" | "hidden" | "gift"; used: boolean; bounce: number };
type Platform = Rect & { kind: "cloud" | "mover"; baseX: number; baseY: number; range: number; speed: number; phase: number; dx: number; dy: number };
type Star = { x: number; y: number; taken: boolean; phase: number };
type Fire = { x: number; w: number };
type Item = { x: number; y: number; vy: number; kind: "gift" | "cake"; life: number; landed: boolean; popped: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; spin: number; rot: number; shape: "rect" | "star" | "text" | "circle" | "petal"; text?: string; gravity: number; screen?: boolean; sway?: number };

export interface GameStats {
  score: number;
  stars: number;
  totalStars: number;
  gifts: number;
  progress: number;
}

/** Compact game state Charuta's browser broadcasts so guests can watch live. */
export interface GameSnapshot {
  x: number; y: number; vx: number; vy: number; f: number; g: number; a: number; inv: number;
  t: number; st: string; bl: string; sv?: string; it: [number, number, number, number][]; fin: number; ft: number;
  sc: GameStats;
}

export type StationKind = "friend" | "act";

export interface EngineCallbacks {
  onMilestone: (m: Milestone) => void;
  onStats: (s: GameStats) => void;
  onFinish: () => void;
  onToast: (text: string) => void;
  /** Charuta reached a "Pick a Friend" station (index). */
  onStation: (n: number, kind: StationKind) => void;
}

const MILESTONES: Record<string, string> = {
  bush: "Leapt over the birthday bush!",
  star: "Collected a golden wish star!",
  gap: "Jumped the first gap!",
  hidden: "Found a hidden birthday gift!",
  stars6: "Collected 6 wish stars!",
  cloud: "Crossed the cloud bridge!",
  fire: "Made it past the candle flames!",
  giftbox: "Opened the surprise gift box!",
  moving: "Rode the party platform!",
  stars12: "Collected 12 wish stars!",
};

const CONFETTI = ["#ff5f8f", "#ffd84d", "#5ec8e5", "#7c5ce0", "#6cd27f", "#ff9a52"];

function buildLevel() {
  const ground: Rect[] = [
    [0, 1480],
    [1620, 2560],
    [2880, 3880],
    [4180, LEVEL_W],
  ].map(([a, b]) => ({ x: a, y: GROUND_Y, w: b - a, h: 200 }));

  const bushes: Rect[] = [
    { x: 560, y: GROUND_Y - 50, w: 84, h: 50 },
    { x: 2240, y: GROUND_Y - 44, w: 70, h: 44 },
    { x: 4420, y: GROUND_Y - 40, w: 64, h: 40 },
  ];

  const blocks: Block[] = [
    { x: 1860, kind: "brick" },
    { x: 1900, kind: "hidden" },
    { x: 1940, kind: "brick" },
    { x: 1980, kind: "brick" },
    { x: 3620, kind: "brick" },
    { x: 3660, kind: "gift" },
    { x: 3700, kind: "brick" },
  ].map((b) => ({ ...b, y: 320, w: 40, h: 40, used: false, bounce: 0 }) as Block);

  const platforms: Platform[] = [
    { kind: "cloud", x: 2588, y: 398, w: 100, h: 18, range: 7, speed: 1.6, phase: 0 },
    { kind: "cloud", x: 2716, y: 356, w: 100, h: 18, range: 9, speed: 1.3, phase: 1.7 },
    { kind: "mover", x: 3890, y: 408, w: 112, h: 18, range: 85, speed: 0.9, phase: 0 },
  ].map((p) => ({ ...p, baseX: p.x, baseY: p.y, dx: 0, dy: 0 }) as Platform);

  const stars: Star[] = [
    [790, 362], [870, 330], [950, 362], [1550, 340], [1920, 270], [2120, 360],
    [2638, 340], [2766, 298], [3020, 360], [3172, 320], [3472, 320], [3780, 360],
    [3946, 340], [4320, 360], [4560, 340], [4640, 360], [4720, 340],
  ].map(([x, y], i) => ({ x, y, taken: false, phase: i * 0.7 }));

  const fires: Fire[] = [{ x: 3150, w: 46 }, { x: 3450, w: 46 }];

  // 11 stops on safe flat ground: Friend, Challenge, Friend, … , Friend (6 friends + 5 challenges).
  const stations = [700, 1100, 1700, 2100, 2400, 2960, 3270, 3790, 4260, 4560, 4780].map((x, i) => ({ x, used: false, kind: (i % 2 === 0 ? "friend" : "act") as StationKind }));

  const signs = [
    { x: 150, text: "Wishful Meadows →" },
    { x: 440, text: "Jump the bush! ⤴" },
    { x: 1760, text: "Bump bricks from below" },
    { x: 2470, text: "Cloud bridge ahead ☁" },
    { x: 3050, text: "Hot candles! 🔥" },
    { x: 3560, text: "A surprise box! 🎁" },
    { x: 4880, text: "Party Castle 🏰" },
  ];

  // Decorative scenery (not solid).
  const trees = Array.from({ length: 26 }, (_, i) => ({ x: 120 + i * 215 + ((i * 97) % 80), s: 0.75 + ((i * 37) % 10) / 22, hue: i % 3 }));
  const balloons = Array.from({ length: 14 }, (_, i) => ({ x: 200 + i * 420, y: 120 + ((i * 53) % 110), c: CONFETTI[i % CONFETTI.length], ph: i }));
  return { ground, bushes, blocks, platforms, stars, fires, signs, trees, balloons, stations };
}

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  private level = buildLevel();
  private p = { x: 80, y: GROUND_Y - PH, vx: 0, vy: 0, onGround: true, facing: 1, anim: 0, coyote: 0, buffer: 0, invuln: 0, jumpCut: false, on: null as Platform | null, safeX: 80 };
  private keys = { left: false, right: false, jump: false };
  private particles: Particle[] = [];
  private items: Item[] = [];
  private fired = new Set<string>();
  private stats: GameStats;
  private camX = 0;
  private t = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private paused = true;
  private finished = false;
  private finishTimer = 0;
  private cssW = 800;
  private cssH = 450;
  private dpr = 1;
  private scale = 1;
  private offY = 0;
  private statsDirty = true;

  private target: GameSnapshot | null = null;

  constructor(private canvas: HTMLCanvasElement, private cb: EngineCallbacks, private spectator = false) {
    this.ctx = canvas.getContext("2d")!;
    this.stats = { score: 0, stars: 0, totalStars: this.level.stars.length, gifts: 0, progress: 0 };
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(200, r.width);
    this.cssH = Math.max(150, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    // Fit the 540-unit-tall world; on narrow (portrait) screens keep ~440 units visible.
    this.scale = Math.min(this.cssH / H, this.cssW / (this.cssW < 600 ? 390 : 640));
    this.offY = this.cssH / this.scale - H;
  }

  setPaused(v: boolean) {
    this.paused = v;
    if (v) this.keys = { left: false, right: false, jump: false };
  }

  setKey(k: "left" | "right" | "jump", down: boolean) {
    if (k === "jump" && down && !this.keys.jump) this.p.buffer = 0.12;
    if (k === "jump" && !down) this.p.jumpCut = true;
    this.keys[k] = down;
  }

  reset() {
    this.level = buildLevel();
    Object.assign(this.p, { x: 80, y: GROUND_Y - PH, vx: 0, vy: 0, onGround: true, facing: 1, invuln: 0, on: null, safeX: 80 });
    this.fired.clear();
    this.particles = [];
    this.items = [];
    this.finished = false;
    this.finishTimer = 0;
    this.camX = 0;
    this.stats = { score: 0, stars: 0, totalStars: this.level.stars.length, gifts: 0, progress: 0 };
    this.statsDirty = true;
  }

  /** Where Charuta is on screen (CSS pixels), for DOM overlays. */
  playerScreen() {
    return { x: (this.p.x + PW / 2 - this.camX) * this.scale, y: (this.p.y + this.offY) * this.scale };
  }

  /** A cheer from the room: emojis burst around Charuta. */
  private heliStart = -100;

  /** Send the flower helicopter over Charuta right now (e.g. after a friend is revealed). */
  callHelicopter() {
    if (this.heliPhase() < 0) this.heliStart = this.t;
  }

  /** Seconds into the current helicopter visit, or -1 when it isn't around. */
  private heliPhase() {
    const own = this.t - this.heliStart;
    return own >= 0 && own < HELI_VISIT ? own : -1;
  }

  /** Helicopter position in world space: flies in from the right, hovers over Charuta, leaves left. */
  private heliPos() {
    const ph = this.heliPhase();
    if (ph < 0) return null;
    const viewW = this.cssW / this.scale;
    const hoverX = this.p.x + PW / 2 + 10;
    const hoverY = Math.max(80, this.p.y - 190);
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
    let x: number;
    let y = hoverY + Math.sin(this.t * 2.2) * 6;
    let tilt = 0;
    if (ph < 2.5) {
      const k = ease(ph / 2.5);
      x = this.camX + viewW + 160 + (hoverX - (this.camX + viewW + 160)) * k;
      y -= (1 - k) * 60;
      tilt = -0.18 * (1 - k);
    } else if (ph < 7) {
      x = hoverX;
    } else {
      const k = (ph - 7) / (HELI_VISIT - 7);
      x = hoverX - k * k * (viewW + 400);
      y -= k * 80;
      tilt = -0.2 * Math.min(1, k * 3);
    }
    return { x, y, tilt, showering: ph > 2.2 && ph < 7.3 };
  }

  private spawnFlowers(dt: number) {
    const h = this.heliPos();
    if (!h?.showering) return;
    const n = Math.random() < dt * 34 ? 1 : 0;
    for (let i = 0; i < n + (Math.random() < dt * 20 ? 1 : 0); i++) {
      const emoji = Math.random() < 0.35;
      this.particles.push({
        x: h.x + (Math.random() - 0.5) * 50,
        y: h.y + 52,
        vx: (Math.random() - 0.5) * 130,
        vy: 30 + Math.random() * 40,
        life: 3.2,
        max: 3.2,
        color: FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)],
        size: emoji ? 18 + Math.random() * 6 : 5 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 6,
        rot: Math.random() * 6,
        shape: emoji ? "text" : "petal",
        text: emoji ? FLOWERS[Math.floor(Math.random() * FLOWERS.length)] : undefined,
        gravity: 40,
        sway: Math.random() * 6,
      });
    }
  }

  burst(emoji: string) {
    const cx = this.p.x + PW / 2;
    const cy = this.p.y + 10;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.particles.push({ x: cx + Math.cos(a) * 20, y: cy + Math.sin(a) * 14, vx: Math.cos(a) * 90, vy: -120 - Math.random() * 90, life: 1.6, max: 1.6, color: "#fff", size: 22 + Math.random() * 8, spin: 0, rot: 0, shape: "text", text: emoji, gravity: 60 });
    }
    if (emoji === "🎉" || emoji === "🎊" || emoji === "🥳") this.confetti(cx, cy, 40);
    if (emoji === "🎈") {
      for (let i = 0; i < 5; i++) this.particles.push({ x: cx - 60 + i * 30, y: cy + 60, vx: (Math.random() - 0.5) * 20, vy: -110 - Math.random() * 40, life: 3, max: 3, color: "#fff", size: 30, spin: 0, rot: 0, shape: "text", text: "🎈", gravity: -10 });
    }
  }

  /** A virtual gift from a guest drops from the sky in front of Charuta. */
  spawnGift(kind: "gift" | "cake" = "gift") {
    const x = Math.min(this.p.x + 110 + Math.random() * 80, FINISH_X - 60);
    this.items.push({ x, y: -20, vy: 0, kind, life: 14, landed: false, popped: false });
  }

  private frame = (now: number) => {
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.t += dt;
    if (this.spectator) {
      this.followSnapshot(dt);
    } else if (!this.paused) {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.update(STEP);
        this.acc -= STEP;
      }
    } else {
      this.acc = 0;
    }
    this.spawnFlowers(dt);
    this.updateParticles(dt);
    this.render();
    if (this.statsDirty) {
      this.statsDirty = false;
      this.cb.onStats({ ...this.stats });
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  /* --------------------------- simulation --------------------------- */

  private solids(): Rect[] {
    return [...this.level.ground, ...this.level.bushes, ...this.level.blocks];
  }

  private update(dt: number) {
    const p = this.p;
    const L = this.level;

    // Moving platforms first, so riders are carried with them.
    this.movePlatforms();
    if (p.on) {
      p.x += p.on.dx;
      p.y = p.on.y - PH;
    }

    // Input.
    let dir = 0;
    if (!this.finished) dir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    else dir = p.x < FINISH_X + 70 ? 1 : 0;
    const target = dir * RUN;
    const accel = p.onGround ? 2600 : 1700;
    if (p.vx < target) p.vx = Math.min(target, p.vx + accel * dt);
    else if (p.vx > target) p.vx = Math.max(target, p.vx - accel * dt);
    if (dir) p.facing = dir;

    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0 && !this.finished) {
      p.vy = -JUMP_V;
      p.onGround = false;
      p.on = null;
      p.coyote = 0;
      p.buffer = 0;
      p.jumpCut = false;
      sfx.jump();
    }
    // Variable jump height: release early for a short hop.
    if (p.jumpCut && p.vy < -380) p.vy = -380;
    if (p.vy >= 0) p.jumpCut = false;

    p.vy = Math.min(1100, p.vy + GRAVITY * dt);

    // Horizontal move + collisions.
    p.x += p.vx * dt;
    p.x = Math.max(0, Math.min(LEVEL_W - PW, p.x));
    for (const s of this.solids()) {
      if (overlap(p.x, p.y, PW, PH, s)) {
        if (p.vx > 0 || (p.vx === 0 && p.x + PW / 2 < s.x + s.w / 2)) p.x = s.x - PW;
        else p.x = s.x + s.w;
        p.vx = 0;
      }
    }

    // Vertical move + collisions.
    const prevBottom = p.y + PH;
    p.y += p.vy * dt;
    const wasOnGround = p.onGround;
    p.onGround = false;
    p.on = null;
    for (const s of this.solids()) {
      if (!overlap(p.x, p.y, PW, PH, s)) continue;
      if (p.vy >= 0) {
        p.y = s.y - PH;
        p.vy = 0;
        p.onGround = true;
      } else {
        p.y = s.y + s.h;
        p.vy = 60;
        if ("kind" in s) this.hitBlock(s as Block);
      }
    }
    for (const pl of L.platforms) {
      const top = pl.y;
      const withinX = p.x + PW > pl.x + 4 && p.x < pl.x + pl.w - 4;
      if (withinX && p.vy >= 0 && prevBottom <= top + Math.max(2, pl.dy + 2) + 6 && p.y + PH >= top) {
        p.y = top - PH;
        p.vy = 0;
        p.onGround = true;
        p.on = pl;
      }
    }
    if (p.onGround && !wasOnGround) this.dust(p.x + PW / 2, p.y + PH);
    if (p.onGround && !p.on && L.ground.some((g) => p.x >= g.x && p.x + PW <= g.x + g.w)) p.safeX = p.x;

    if (Math.abs(p.vx) > 5 && p.onGround) p.anim += Math.abs(p.vx) * dt * 0.045;
    p.invuln = Math.max(0, p.invuln - dt);

    // Fell into a gap: float back up, no game over on a birthday.
    if (p.y > H + 80) {
      Object.assign(p, { x: Math.max(20, p.safeX - 30), y: GROUND_Y - PH - 140, vx: 0, vy: 0, invuln: 1.2 });
      sfx.hurt();
      this.cb.onToast("Whoops! A friendly cloud carried you back ☁");
    }

    // Fire hazards.
    for (const f of L.fires) {
      const hit = { x: f.x + 8, y: GROUND_Y - 58, w: f.w - 16, h: 58 };
      if (p.invuln <= 0 && overlap(p.x, p.y, PW, PH, hit)) {
        p.vx = p.x + PW / 2 < f.x + f.w / 2 ? -330 : 330;
        p.vy = -520;
        p.onGround = false;
        p.invuln = 1.3;
        sfx.hurt();
        this.cb.onToast("Ouch! Hot candle! Jump over the flames 🔥");
        for (let i = 0; i < 10; i++) this.particles.push({ x: p.x + PW / 2, y: p.y + PH / 2, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 200, life: 0.6, max: 0.6, color: "#ffb347", size: 5, spin: 0, rot: 0, shape: "circle", gravity: 300 });
      }
    }

    // Stars.
    for (const s of L.stars) {
      if (s.taken) continue;
      const sy = s.y + Math.sin(this.t * 3 + s.phase) * 5;
      if (Math.abs(p.x + PW / 2 - s.x) < PW / 2 + 14 && sy > p.y - 14 && sy < p.y + PH + 14) {
        s.taken = true;
        this.stats.stars++;
        this.addScore(100, s.x, sy);
        sfx.star();
        this.sparkle(s.x, sy, "#ffd84d");
      }
    }

    // Falling items (virtual gifts from guests + pop-ups from boxes).
    for (const it of this.items) {
      if (it.popped) continue;
      it.life -= dt;
      if (!it.landed) {
        it.vy = Math.min(600, it.vy + 900 * dt);
        it.y += it.vy * dt;
        const g = L.ground.find((r) => it.x > r.x && it.x < r.x + r.w);
        if (g && it.y >= g.y - 30) {
          it.y = g.y - 30;
          it.landed = true;
          this.dust(it.x, g.y);
        }
      }
      if (it.y > H + 40 || it.life <= 0) it.popped = true;
      if (!it.popped && Math.abs(p.x + PW / 2 - it.x) < 34 && it.y + 30 > p.y && it.y < p.y + PH) {
        it.popped = true;
        this.stats.gifts++;
        this.addScore(250, it.x, it.y);
        sfx.pop();
        this.confetti(it.x, it.y, 24);
        this.cb.onToast(it.kind === "cake" ? "Yum! A slice of cake from a friend 🍰" : "You caught a gift from a friend! 🎁");
      }
    }
    this.items = this.items.filter((i) => !i.popped);

    for (const b of L.blocks) b.bounce = Math.max(0, b.bounce - dt * 6);

    // Milestones.
    const at = (id: string, cond: boolean) => cond && this.fire(id);
    const gx = p.x;
    at("bush", gx > 650);
    at("star", this.stats.stars >= 1);
    at("gap", p.onGround && gx > 1630);
    at("stars6", this.stats.stars >= 6);
    at("cloud", p.onGround && !p.on && gx > 2890);
    at("fire", p.onGround && gx > 3205);
    at("moving", p.onGround && !p.on && gx > 4190);
    at("stars12", this.stats.stars >= 12);

    // Friend stations: stop Charuta and let the room take over.
    if (!this.spectator && p.onGround && !this.finished) {
      const st = L.stations.find((s) => !s.used && p.x + PW / 2 > s.x);
      if (st) {
        st.used = true;
        p.vx = 0;
        this.keys = { left: false, right: false, jump: false };
        this.confetti(st.x, GROUND_Y - 110, 30);
        this.cb.onStation(L.stations.indexOf(st), st.kind);
      }
    }

    const prog = Math.min(1, p.x / FINISH_X);
    if (Math.abs(prog - this.stats.progress) > 0.004) {
      this.stats.progress = prog;
      this.statsDirty = true;
    }

    // Reached the Party Castle.
    if (!this.finished && p.x > FINISH_X) {
      this.finished = true;
      this.finishTimer = 0;
      sfx.fanfare();
    }
    if (this.finished) {
      this.finishTimer += dt;
      if (Math.floor(this.finishTimer * 3) !== Math.floor((this.finishTimer - dt) * 3)) {
        this.firework(5150 + (Math.random() - 0.5) * 420, 80 + Math.random() * 140);
        if (p.onGround) {
          p.vy = -520;
          p.onGround = false;
        }
      }
      if (this.finishTimer > 2.6 && this.finishTimer - dt <= 2.6) this.cb.onFinish();
    }

    this.moveCamera(dt);
  }

  private movePlatforms() {
    for (const pl of this.level.platforms) {
      const ox = pl.x;
      const oy = pl.y;
      if (pl.kind === "mover") pl.x = pl.baseX + (Math.sin(this.t * pl.speed + pl.phase) * 0.5 + 0.5) * pl.range * 2;
      else pl.y = pl.baseY + Math.sin(this.t * pl.speed + pl.phase) * pl.range;
      pl.dx = pl.x - ox;
      pl.dy = pl.y - oy;
    }
  }

  private moveCamera(dt: number) {
    const viewW = this.cssW / this.scale;
    const targetCam = Math.max(0, Math.min(LEVEL_W - viewW, this.p.x - viewW * 0.36));
    this.camX += (targetCam - this.camX) * Math.min(1, dt * 8);
  }

  /* ------------------------- live sync (guests) ------------------------- */

  snapshot(): GameSnapshot {
    const p = this.p;
    const r = (n: number) => Math.round(n * 10) / 10;
    return {
      x: r(p.x), y: r(p.y), vx: r(p.vx), vy: r(p.vy), f: p.facing, g: p.onGround ? 1 : 0, a: r(p.anim), inv: r(p.invuln),
      t: r(this.t), st: this.level.stars.map((s) => (s.taken ? 1 : 0)).join(""), bl: this.level.blocks.map((b) => (b.used ? 1 : 0)).join(""), sv: this.level.stations.map((st) => (st.used ? 1 : 0)).join(""),
      it: this.items.map((i) => [Math.round(i.x), Math.round(i.y), i.kind === "cake" ? 1 : 0, i.landed ? 1 : 0]), fin: this.finished ? 1 : 0, ft: r(this.finishTimer), sc: this.stats,
    };
  }

  applySnapshot(s: GameSnapshot) {
    if (!s || typeof s.x !== "number") return;
    const L = this.level;
    // Effects for things that just happened on Charuta's screen.
    s.st.split("").forEach((c, i) => {
      const star = L.stars[i];
      if (!star) return;
      if (c === "1" && !star.taken) this.sparkle(star.x, star.y, "#ffd84d");
      star.taken = c === "1";
    });
    s.bl.split("").forEach((c, i) => {
      const b = L.blocks[i];
      if (!b) return;
      if (c === "1" && !b.used) {
        b.bounce = 1;
        this.confetti(b.x + b.w / 2, b.y - 10, 40);
      }
      b.used = c === "1";
    });
    (s.sv ?? "").split("").forEach((c, i) => {
      const st = L.stations[i];
      if (st) st.used = c === "1";
    });
    this.items = s.it.map(([x, y, k, landed]) => ({ x, y, vy: 0, kind: k ? "cake" : "gift", life: 10, landed: !!landed, popped: false }));
    if (s.fin && !this.finished) sfx.fanfare();
    this.finished = !!s.fin;
    this.finishTimer = s.ft;
    if (Math.abs(this.t - s.t) > 0.4) this.t = s.t;
    if (!this.target || Math.abs(this.target.x - s.x) > 300 || !this.target) Object.assign(this.p, { x: s.x, y: s.y });
    this.target = s;
    this.stats = s.sc;
    this.statsDirty = true;
  }

  private followSnapshot(dt: number) {
    const s = this.target;
    this.movePlatforms();
    for (const b of this.level.blocks) b.bounce = Math.max(0, b.bounce - dt * 6);
    if (s) {
      const p = this.p;
      // Extrapolate a little from the last known velocity, then ease toward it.
      s.x += s.vx * dt;
      const k = Math.min(1, dt * 14);
      p.x += (s.x - p.x) * k;
      p.y += (s.y - p.y) * k;
      p.vx = s.vx;
      p.vy = s.vy;
      p.facing = s.f;
      p.onGround = !!s.g;
      p.anim = s.a;
      p.invuln = s.inv;
      if (this.finished && Math.floor(this.t * 3) !== Math.floor((this.t - dt) * 3)) this.firework(5150 + (Math.random() - 0.5) * 420, 80 + Math.random() * 140);
    }
    this.moveCamera(dt);
  }

  private fire(id: string) {
    if (this.fired.has(id) || this.spectator) return;
    this.fired.add(id);
    const remaining = Object.keys(MILESTONES).filter((k) => !this.fired.has(k)).length;
    this.cb.onMilestone({ id, kind: id, label: MILESTONES[id], remaining });
  }

  private hitBlock(b: Block) {
    b.bounce = 1;
    if (b.used || b.kind === "brick") {
      sfx.bump();
      return;
    }
    b.used = true;
    sfx.pop();
    this.addScore(500, b.x + b.w / 2, b.y - 20);
    this.stats.gifts++;
    this.confetti(b.x + b.w / 2, b.y - 10, 50);
    // A gift rises out of the box.
    for (let i = 0; i < 1; i++) this.particles.push({ x: b.x + b.w / 2, y: b.y - 18, vx: 0, vy: -140, life: 1.2, max: 1.2, color: "#fff", size: 34, spin: 0, rot: 0, shape: "text", text: "🎁", gravity: 120 });
    this.fire(b.kind === "hidden" ? "hidden" : "giftbox");
  }

  private addScore(n: number, x: number, y: number) {
    this.stats.score += n;
    this.statsDirty = true;
    void x;
    void y; // Points are tracked internally only; nothing is shown.
  }

  /* ---------------------------- particles --------------------------- */

  private confetti(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 260;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, life: 1.6 + Math.random(), max: 2.6, color: CONFETTI[i % CONFETTI.length], size: 4 + Math.random() * 4, spin: (Math.random() - 0.5) * 14, rot: Math.random() * 6, shape: "rect", gravity: 420 });
    }
  }

  private sparkle(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, life: 0.5, max: 0.5, color, size: 6, spin: 4, rot: 0, shape: "star", gravity: 0 });
    }
  }

  private dust(x: number, y: number) {
    for (let i = 0; i < 6; i++) this.particles.push({ x: x + (Math.random() - 0.5) * 20, y: y - 2, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 40, life: 0.4, max: 0.4, color: "rgba(255,255,255,.8)", size: 4 + Math.random() * 3, spin: 0, rot: 0, shape: "circle", gravity: 0 });
  }

  private firework(x: number, y: number) {
    const c = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const sp = 160 + Math.random() * 60;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.2, max: 1.2, color: c, size: 3.5, spin: 0, rot: 0, shape: "circle", gravity: 90 });
    }
  }

  private updateParticles(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.vy += q.gravity * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.spin * dt;
      q.vx *= 1 - dt * 0.8;
      if (q.sway !== undefined) q.x += Math.sin(q.life * 3 + q.sway) * 28 * dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  /* ----------------------------- drawing ---------------------------- */

  private render() {
    const c = this.ctx;
    const k = this.scale * this.dpr;
    const viewW = this.cssW / this.scale;
    const viewH = this.cssH / this.scale;
    c.setTransform(k, 0, 0, k, 0, 0);

    // Sky.
    const sky = c.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, "#56c6f2");
    sky.addColorStop(0.75, "#b4ecfc");
    sky.addColorStop(1, "#e2f8f0");
    c.fillStyle = sky;
    c.fillRect(0, 0, viewW, viewH);

    c.save();
    c.translate(0, this.offY);

    // Sun.
    const sx = viewW - 110;
    const glow = c.createRadialGradient(sx, 70, 10, sx, 70, 120);
    glow.addColorStop(0, "rgba(255,247,190,.95)");
    glow.addColorStop(1, "rgba(255,247,190,0)");
    c.fillStyle = glow;
    c.fillRect(sx - 130, -60, 260, 260);
    c.fillStyle = "#fff3a6";
    circle(c, sx, 70, 38);

    this.drawParallax(viewW);

    // World layer.
    c.save();
    c.translate(-this.camX, 0);
    const L = this.level;
    const inView = (x: number, w: number) => x + w > this.camX - 60 && x < this.camX + viewW + 60;

    for (const s of L.signs) if (inView(s.x, 160)) drawSign(c, s.x, s.text);
    const nextStation = L.stations.find((st) => !st.used);
    for (const st of L.stations) if (inView(st.x - 60, 120)) drawStation(c, st.x, st.used, st === nextStation, this.t, st.kind);
    this.drawCastle();
    for (const g of L.ground) if (inView(g.x, g.w)) drawGround(c, g);
    for (const b of L.bushes) if (inView(b.x, b.w)) drawBush(c, b);
    for (const f of L.fires) if (inView(f.x, f.w)) drawFire(c, f, this.t);
    for (const pl of L.platforms) if (inView(pl.x, pl.w)) pl.kind === "cloud" ? drawCloudPlatform(c, pl) : drawMover(c, pl, this.t);
    for (const b of L.blocks) if (inView(b.x, b.w)) drawBlock(c, b, this.t);
    for (const s of L.stars) if (!s.taken && inView(s.x - 20, 40)) drawStar(c, s.x, s.y + Math.sin(this.t * 3 + s.phase) * 5, 14, this.t * 1.5 + s.phase);
    for (const it of this.items) drawItem(c, it, this.t);

    // Flower helicopter.
    const heli = this.heliPos();
    if (heli) drawHelicopter(c, heli.x, heli.y, heli.tilt, this.t);

    // Charuta.
    const p = this.p;
    if (!(p.invuln > 0 && Math.floor(this.t * 16) % 2 === 0)) drawCharuta(c, p.x + PW / 2, p.y + PH, p.facing, p.onGround, p.anim, p.vy, this.t, this.finished);

    // Particles in world space.
    for (const q of this.particles) drawParticle(c, q);
    c.restore();
    c.restore();
  }

  private drawParallax(viewW: number) {
    const c = this.ctx;
    const cam = this.camX;
    // Far hills.
    c.fillStyle = "#8fd9a0";
    for (let i = -1; i < viewW / 320 + 2; i++) {
      const x = i * 320 - ((cam * 0.15) % 320);
      ellipse(c, x + 160, GROUND_Y + 10, 220, 120);
    }
    // Drifting clouds.
    c.fillStyle = "rgba(255,255,255,.92)";
    for (let i = 0; i < 9; i++) {
      const span = 2600;
      const x = ((i * 430 + this.t * (8 + i * 2) - cam * 0.3) % span + span) % span - 200;
      const y = 50 + ((i * 71) % 150);
      puff(c, x, y, 0.6 + ((i * 13) % 7) / 10);
    }
    // Balloons drifting in the distance.
    for (const b of this.level.balloons) {
      const x = b.x - cam * 0.4;
      if (x < -60 || x > viewW + 60) continue;
      const y = b.y + Math.sin(this.t * 1.2 + b.ph) * 10;
      c.strokeStyle = "rgba(90,80,120,.45)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, y + 18);
      c.quadraticCurveTo(x + 6, y + 40, x - 2, y + 60);
      c.stroke();
      c.fillStyle = b.c;
      ellipse(c, x, y, 13, 17);
      c.fillStyle = "rgba(255,255,255,.45)";
      ellipse(c, x - 4, y - 6, 3.5, 5);
    }
    // Near hills + trees.
    c.fillStyle = "#5cc47d";
    for (let i = -1; i < viewW / 460 + 2; i++) {
      const x = i * 460 - ((cam * 0.45) % 460);
      ellipse(c, x + 200, GROUND_Y + 30, 260, 110);
    }
    for (const tr of this.level.trees) {
      const x = tr.x - cam * 0.7;
      if (x < -80 || x > viewW + 80) continue;
      drawTree(c, x, GROUND_Y + 4, tr.s, tr.hue);
    }
    // Bunting strings near the top.
    for (let i = -1; i < viewW / 360 + 2; i++) {
      const x = i * 360 - ((cam * 0.85) % 360);
      drawBunting(c, x, 18, 300, i);
    }
    // A little aeroplane tows a waving banner back and forth across the whole sky.
    // It lives in a slow parallax layer, so it no longer scrolls along with Charuta.
    const P = 0.3;
    const minX = -500;
    const maxX = (LEVEL_W - viewW) * P + viewW + 500;
    const legTime = (maxX - minX) / 75;
    // Start so the plane enters the screen a couple of seconds into the game.
    const tt = this.t + (maxX - (viewW + 160)) / 75;
    const leg = Math.floor(tt / legTime);
    const k = (tt % legTime) / legTime;
    const heading = leg % 2 === 0 ? -1 : 1; // -1 = flying left, +1 = flying right
    const px = heading < 0 ? maxX - k * (maxX - minX) : minX + k * (maxX - minX);
    drawPlane(c, px - cam * P, 175 + Math.sin(this.t * 0.9) * 14, this.t, heading);
  }

  private drawCastle() {
    const c = this.ctx;
    const x = 4980;
    const base = GROUND_Y;
    // Towers.
    const tower = (tx: number, h: number) => {
      c.fillStyle = "#f2a9d4";
      c.strokeStyle = "#a758aa";
      c.lineWidth = 5;
      roundRect(c, tx, base - h, 64, h, 4);
      c.fill();
      c.stroke();
      c.fillStyle = "#7651c8";
      c.beginPath();
      c.moveTo(tx - 10, base - h + 2);
      c.lineTo(tx + 32, base - h - 62);
      c.lineTo(tx + 74, base - h + 2);
      c.closePath();
      c.fill();
      // Flag.
      c.strokeStyle = "#5a3f8d";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(tx + 32, base - h - 60);
      c.lineTo(tx + 32, base - h - 92);
      c.stroke();
      c.fillStyle = "#ffd84d";
      c.beginPath();
      const wave = Math.sin(this.t * 5 + tx) * 4;
      c.moveTo(tx + 32, base - h - 92);
      c.lineTo(tx + 60, base - h - 85 + wave);
      c.lineTo(tx + 32, base - h - 78);
      c.fill();
      c.fillStyle = "#fff";
      roundRect(c, tx + 22, base - h + 30, 20, 28, 10);
      c.fill();
    };
    tower(x, 230);
    tower(x + 236, 230);
    c.fillStyle = "#f7bde0";
    c.strokeStyle = "#a758aa";
    c.lineWidth = 5;
    roundRect(c, x + 60, base - 180, 180, 180, 4);
    c.fill();
    c.stroke();
    // Crenellations.
    c.fillStyle = "#f7bde0";
    for (let i = 0; i < 5; i++) {
      roundRect(c, x + 62 + i * 37, base - 202, 24, 24, 3);
      c.fill();
      c.stroke();
    }
    // Door.
    c.fillStyle = "#6b3d8f";
    c.beginPath();
    c.moveTo(x + 115, base);
    c.lineTo(x + 115, base - 70);
    c.arc(x + 150, base - 70, 35, Math.PI, 0);
    c.lineTo(x + 185, base);
    c.fill();
    c.fillStyle = "#ffd84d";
    circle(c, x + 175, base - 40, 4);
    // Banner.
    c.fillStyle = "#ef5b9b";
    roundRect(c, x + 72, base - 160, 156, 34, 8);
    c.fill();
    c.fillStyle = "#fff";
    c.font = "700 15px Fredoka, sans-serif";
    c.textAlign = "center";
    c.fillText("HAPPY BIRTHDAY", x + 150, base - 137);
    c.font = "26px serif";
    c.fillText("♥", x + 150, base - 92);

    // Giant cake beside the castle.
    const cx = x + 420;
    const tiers: [number, number, string, string][] = [[200, 60, "#f279a4", "#cb4f7d"], [150, 52, "#fff2d7", "#f6a8bf"], [100, 44, "#8e6cf0", "#6247c4"]];
    let y = base;
    tiers.forEach(([w, h, fill, edge]) => {
      c.fillStyle = edge;
      roundRect(c, cx - w / 2, y - h, w, h, 10);
      c.fill();
      c.fillStyle = fill;
      roundRect(c, cx - w / 2, y - h, w, h - 7, 10);
      c.fill();
      // Icing drips.
      c.fillStyle = "#fffaf1";
      for (let i = 0; i < w / 20; i++) ellipse(c, cx - w / 2 + 10 + i * 20, y - h + 4, 8, 7 + (i % 2) * 4);
      y -= h;
    });
    for (let i = 0; i < 5; i++) {
      const kx = cx - 36 + i * 18;
      c.fillStyle = i % 2 ? "#5ec8e5" : "#ffd84d";
      c.fillRect(kx - 3, y - 26, 6, 26);
      const f = Math.sin(this.t * 12 + i) * 1.5;
      c.fillStyle = "#ffb03a";
      ellipse(c, kx, y - 33 + f * 0.3, 5, 8 + f);
      c.fillStyle = "#fff6b5";
      ellipse(c, kx, y - 31, 2.4, 4);
    }
  }
}

/* --------------------------- draw helpers --------------------------- */

function overlap(x: number, y: number, w: number, h: number, r: Rect) {
  return x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y;
}

function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

function puff(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  circle(c, x, y, 22 * s);
  circle(c, x + 26 * s, y - 12 * s, 28 * s);
  circle(c, x + 56 * s, y, 22 * s);
  roundRect(c, x - 10 * s, y - 4 * s, 80 * s, 26 * s, 13 * s);
  c.fill();
}

function drawGround(c: CanvasRenderingContext2D, g: Rect) {
  c.fillStyle = "#a66a37";
  c.fillRect(g.x, g.y + 16, g.w, 200);
  c.save();
  c.beginPath();
  c.rect(g.x, g.y + 16, g.w, 200);
  c.clip();
  c.fillStyle = "#b97a42";
  for (let x = g.x - (g.x % 36); x < g.x + g.w; x += 36) for (let y = g.y + 16; y < g.y + 200; y += 36) if (((x + y) / 36) % 2 === 0) c.fillRect(x, y, 36, 36);
  c.fillStyle = "rgba(255,255,255,.12)";
  for (let x = g.x + 20; x < g.x + g.w; x += 90) circle(c, x, g.y + 60 + ((x * 7) % 40), 5);
  c.restore();
  c.fillStyle = "#4fbf5c";
  roundRect(c, g.x, g.y, g.w, 22, 6);
  c.fill();
  c.fillStyle = "#7de374";
  roundRect(c, g.x, g.y, g.w, 8, 4);
  c.fill();
  // Little flowers.
  for (let x = g.x + 30; x < g.x + g.w - 20; x += 140) {
    c.fillStyle = ["#ff7eb0", "#ffd84d", "#ffffff"][Math.floor(x / 140) % 3];
    circle(c, x, g.y - 4, 4);
    c.fillStyle = "#3e9d4b";
    c.fillRect(x - 1, g.y - 2, 2, 5);
  }
}

function drawBush(c: CanvasRenderingContext2D, b: Rect) {
  const r = b.h * 0.62;
  c.fillStyle = "#168347";
  circle(c, b.x + r * 0.9, b.y + b.h - r * 0.7 + 3, r + 3);
  circle(c, b.x + b.w - r * 0.9, b.y + b.h - r * 0.7 + 3, r + 3);
  circle(c, b.x + b.w / 2, b.y + r * 0.8 + 3, r + 3);
  c.fillStyle = "#22a95c";
  circle(c, b.x + r * 0.9, b.y + b.h - r * 0.7, r);
  circle(c, b.x + b.w - r * 0.9, b.y + b.h - r * 0.7, r);
  circle(c, b.x + b.w / 2, b.y + r * 0.8, r);
  c.fillStyle = "rgba(255,255,255,.25)";
  circle(c, b.x + b.w / 2 - r * 0.35, b.y + r * 0.5, r * 0.28);
  // Party berries.
  c.fillStyle = "#ff5f8f";
  circle(c, b.x + b.w * 0.3, b.y + b.h * 0.55, 3.5);
  c.fillStyle = "#ffd84d";
  circle(c, b.x + b.w * 0.7, b.y + b.h * 0.45, 3.5);
}

function drawTree(c: CanvasRenderingContext2D, x: number, base: number, s: number, hue: number) {
  c.fillStyle = "#8a5a35";
  roundRect(c, x - 7 * s, base - 70 * s, 14 * s, 70 * s, 4);
  c.fill();
  c.fillStyle = ["#3fae62", "#2f9f58", "#52bb6b"][hue];
  circle(c, x, base - 92 * s, 40 * s);
  circle(c, x - 28 * s, base - 72 * s, 28 * s);
  circle(c, x + 28 * s, base - 72 * s, 28 * s);
  c.fillStyle = "rgba(255,255,255,.18)";
  circle(c, x - 12 * s, base - 106 * s, 12 * s);
}

function drawBunting(c: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number) {
  c.strokeStyle = "rgba(80,60,120,.45)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + w / 2, y + 40, x + w, y);
  c.stroke();
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const px = x + w * t;
    const py = y + 2 * (1 - t) * t * 40;
    c.fillStyle = CONFETTI[(i + seed + 60) % CONFETTI.length];
    c.beginPath();
    c.moveTo(px - 9, py);
    c.lineTo(px + 9, py);
    c.lineTo(px, py + 18);
    c.fill();
  }
}

function drawSign(c: CanvasRenderingContext2D, x: number, text: string) {
  c.font = "600 14px Fredoka, sans-serif";
  const w = c.measureText(text).width + 24;
  c.fillStyle = "#8a5a35";
  c.fillRect(x + w / 2 - 3, GROUND_Y - 60, 6, 60);
  c.fillStyle = "#fff8e8";
  c.strokeStyle = "#c58b4c";
  c.lineWidth = 3;
  roundRect(c, x, GROUND_Y - 92, w, 34, 8);
  c.fill();
  c.stroke();
  c.fillStyle = "#5b3f2a";
  c.textAlign = "left";
  c.fillText(text, x + 12, GROUND_Y - 70);
}

function drawFire(c: CanvasRenderingContext2D, f: Fire, t: number) {
  const base = GROUND_Y;
  // Giant birthday candle stub.
  c.fillStyle = "#ef6d8f";
  roundRect(c, f.x, base - 24, f.w, 24, 4);
  c.fill();
  c.fillStyle = "#fff";
  for (let i = 0; i < 3; i++) c.fillRect(f.x + 6 + i * 14, base - 24, 6, 24);
  const cx = f.x + f.w / 2;
  const flick = Math.sin(t * 14) * 3 + Math.sin(t * 23) * 2;
  const g = c.createRadialGradient(cx, base - 50, 4, cx, base - 50, 48);
  g.addColorStop(0, "rgba(255,190,60,.55)");
  g.addColorStop(1, "rgba(255,190,60,0)");
  c.fillStyle = g;
  circle(c, cx, base - 50, 48);
  const flame = (h: number, w: number, col: string) => {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(cx - w, base - 24);
    c.quadraticCurveTo(cx - w * 1.1, base - 24 - h * 0.55, cx + flick * 0.4, base - 24 - h);
    c.quadraticCurveTo(cx + w * 1.1, base - 24 - h * 0.55, cx + w, base - 24);
    c.closePath();
    c.fill();
  };
  flame(46 + flick, 20, "#ff6a2a");
  flame(34 + flick * 0.7, 13, "#ffb02e");
  flame(20 + flick * 0.4, 7, "#fff1a0");
}

function drawCloudPlatform(c: CanvasRenderingContext2D, p: Platform) {
  c.fillStyle = "rgba(120,160,200,.25)";
  roundRect(c, p.x + 4, p.y + 10, p.w - 8, 14, 7);
  c.fill();
  c.fillStyle = "#ffffff";
  circle(c, p.x + 22, p.y + 4, 16);
  circle(c, p.x + 50, p.y - 4, 22);
  circle(c, p.x + 78, p.y + 4, 16);
  roundRect(c, p.x, p.y, p.w, 18, 9);
  c.fill();
  c.fillStyle = "#3d5a80";
  circle(c, p.x + 42, p.y + 2, 2);
  circle(c, p.x + 58, p.y + 2, 2);
  c.strokeStyle = "#3d5a80";
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(p.x + 50, p.y + 4, 4, 0.2, Math.PI - 0.2);
  c.stroke();
}

function drawMover(c: CanvasRenderingContext2D, p: Platform, t: number) {
  c.fillStyle = "#c37133";
  roundRect(c, p.x, p.y + 4, p.w, p.h, 6);
  c.fill();
  c.fillStyle = "#f5a84c";
  roundRect(c, p.x, p.y, p.w, p.h - 2, 6);
  c.fill();
  c.fillStyle = "#ffe573";
  roundRect(c, p.x, p.y, p.w, 6, 3);
  c.fill();
  // Balloons lifting it.
  [0.2, 0.8].forEach((f, i) => {
    const bx = p.x + p.w * f;
    const by = p.y - 56 + Math.sin(t * 2 + i) * 3;
    c.strokeStyle = "rgba(80,60,120,.5)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(bx, p.y);
    c.lineTo(bx, by + 16);
    c.stroke();
    c.fillStyle = i ? "#7c5ce0" : "#ff5f8f";
    ellipse(c, bx, by, 12, 16);
  });
}

function drawBlock(c: CanvasRenderingContext2D, b: Block, t: number) {
  const y = b.y - Math.sin(b.bounce * Math.PI) * 8;
  if (b.kind === "gift" && !b.used) {
    c.fillStyle = "#ae3864";
    roundRect(c, b.x, y + 4, b.w, b.h, 6);
    c.fill();
    c.fillStyle = "#ee5d95";
    roundRect(c, b.x, y, b.w, b.h - 2, 6);
    c.fill();
    c.fillStyle = "#ffd84d";
    c.fillRect(b.x + b.w / 2 - 4, y, 8, b.h - 2);
    c.fillRect(b.x, y + b.h / 2 - 5, b.w, 8);
    c.fillStyle = "#fff";
    c.font = "700 18px Fredoka, sans-serif";
    c.textAlign = "center";
    c.globalAlpha = 0.6 + Math.sin(t * 5) * 0.4;
    c.fillText("?", b.x + b.w / 2, y - 6);
    c.globalAlpha = 1;
    return;
  }
  const used = b.used;
  c.fillStyle = used ? "#b9a48a" : "#d88e30";
  roundRect(c, b.x, y, b.w, b.h, 4);
  c.fill();
  c.fillStyle = used ? "#d8c7ae" : "#ffc849";
  roundRect(c, b.x + 2, y + 2, b.w - 4, b.h - 6, 3);
  c.fill();
  c.strokeStyle = used ? "#b9a48a" : "#d88e30";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(b.x + 2, y + b.h / 2);
  c.lineTo(b.x + b.w - 2, y + b.h / 2);
  c.moveTo(b.x + b.w / 2, y + 2);
  c.lineTo(b.x + b.w / 2, y + b.h / 2);
  c.moveTo(b.x + b.w / 4, y + b.h / 2);
  c.lineTo(b.x + b.w / 4, y + b.h - 4);
  c.moveTo(b.x + (b.w * 3) / 4, y + b.h / 2);
  c.lineTo(b.x + (b.w * 3) / 4, y + b.h - 4);
  c.stroke();
  // The hidden one twinkles very faintly: a clue for sharp eyes.
  if (b.kind === "hidden" && !used && Math.sin(t * 2.3) > 0.85) {
    c.fillStyle = "#fff";
    drawStarShape(c, b.x + b.w - 8, y + 8, 4, 0);
  }
}

function drawStarShape(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

function drawStar(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const sx = Math.abs(Math.cos(t));
  c.save();
  c.translate(x, y);
  c.scale(0.35 + sx * 0.65, 1);
  c.fillStyle = "#d69e24";
  drawStarShape(c, 0, 3, r, 0);
  c.fillStyle = "#ffdc43";
  drawStarShape(c, 0, 0, r, 0);
  c.fillStyle = "rgba(255,255,255,.6)";
  drawStarShape(c, -3, -3, r * 0.3, 0);
  c.restore();
}

function drawItem(c: CanvasRenderingContext2D, it: Item, t: number) {
  const y = it.y + (it.landed ? Math.sin(t * 4) * 3 : 0);
  if (it.landed && it.life < 3 && Math.floor(t * 8) % 2) return;
  c.font = "34px serif";
  c.textAlign = "center";
  c.fillText(it.kind === "cake" ? "🍰" : "🎁", it.x, y + 28);
  if (!it.landed) {
    // Tiny parachute balloon.
    c.fillStyle = "#ff5f8f";
    ellipse(c, it.x, y - 22, 12, 15);
    c.strokeStyle = "rgba(80,60,120,.5)";
    c.beginPath();
    c.moveTo(it.x, y - 7);
    c.lineTo(it.x, y);
    c.stroke();
  }
}

function drawParticle(c: CanvasRenderingContext2D, q: Particle) {
  const a = Math.max(0, Math.min(1, q.life / (q.max * 0.4)));
  c.globalAlpha = a;
  if (q.shape === "text") {
    c.font = q.text?.startsWith("+") ? `800 ${q.size}px Fredoka, sans-serif` : `${q.size}px serif`;
    c.textAlign = "center";
    if (q.text?.startsWith("+")) {
      c.fillStyle = "#5a3fc0";
      c.fillText(q.text, q.x + 1.5, q.y + 1.5);
      c.fillStyle = "#fff";
    }
    c.fillText(q.text ?? "", q.x, q.y);
  } else if (q.shape === "rect") {
    c.save();
    c.translate(q.x, q.y);
    c.rotate(q.rot);
    c.fillStyle = q.color;
    c.fillRect(-q.size / 2, -q.size, q.size, q.size * 2);
    c.restore();
  } else if (q.shape === "star") {
    c.fillStyle = q.color;
    drawStarShape(c, q.x, q.y, q.size, q.rot);
  } else if (q.shape === "petal") {
    c.save();
    c.translate(q.x, q.y);
    c.rotate(q.rot);
    c.scale(1, Math.abs(Math.cos(q.rot * 1.7)) * 0.7 + 0.3);
    c.fillStyle = q.color;
    c.beginPath();
    c.ellipse(0, 0, q.size, q.size * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  } else {
    c.fillStyle = q.color;
    circle(c, q.x, q.y, q.size);
  }
  c.globalAlpha = 1;
}

/** A balloon arch with a sign: where Charuta stops to pick a friend. */
function drawStation(c: CanvasRenderingContext2D, x: number, used: boolean, next: boolean, t: number, kind: StationKind) {
  const act = kind === "act";
  const base = GROUND_Y;
  const glow = next ? 0.55 + Math.sin(t * 4) * 0.25 : 0;
  if (next) {
    const g = c.createRadialGradient(x, base - 70, 10, x, base - 70, 90);
    g.addColorStop(0, `rgba(255,220,90,${glow})`);
    g.addColorStop(1, "rgba(255,220,90,0)");
    c.fillStyle = g;
    c.fillRect(x - 90, base - 160, 180, 160);
  }
  // Posts.
  c.fillStyle = used ? "#b9a8d8" : "#8e6cf0";
  c.fillRect(x - 44, base - 96, 6, 96);
  c.fillRect(x + 38, base - 96, 6, 96);
  // Balloon arch.
  const cols = used ? ["#d9d2e6", "#ece7f3"] : act ? ["#ffd84d", "#ff9a52", "#ffe9a0"] : ["#ff6fa5", "#ffd84d", "#5ec8e5", "#7c5ce0", "#6cd27f"];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    const bx = x + Math.cos(a) * 46;
    const by = base - 96 + Math.sin(a) * 40 + (next ? Math.sin(t * 3 + i) * 1.5 : 0);
    c.fillStyle = cols[i % cols.length];
    c.beginPath();
    c.arc(bx, by, 9, 0, Math.PI * 2);
    c.fill();
  }
  // Sign.
  c.fillStyle = used ? "#f3eff8" : "#fff8e8";
  c.strokeStyle = used ? "#cbbfdc" : "#e8a317";
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(x - 40, base - 80, 80, 34, 9);
  c.fill();
  c.stroke();
  c.textAlign = "center";
  c.fillStyle = used ? "#9a8fae" : "#6b3fa0";
  c.font = "700 12px Fredoka, sans-serif";
  if (act) {
    c.fillText(used ? "✓ Done!" : "🎭 Charuta's", x, base - 66);
    if (!used) c.fillText("Challenge", x, base - 53);
  } else {
    c.fillText(used ? "✓ Friend found" : "🎁 Pick a", x, base - 66);
    if (!used) c.fillText("Friend!", x, base - 53);
  }
  if (next) {
    c.font = `${22 + Math.sin(t * 5) * 2}px serif`;
    c.fillText(act ? "🎤" : "❓", x, base - 150 + Math.sin(t * 3) * 4);
  }
}

const BANNER = "HAPPY BIRTHDAY CHARUTA! 🎂";
const HELI_VISIT = 9.5;
const FLOWERS = ["🌸", "🌼", "🌺", "🌷", "💮"];
const FLOWER_COLORS = ["#ff9cc2", "#ffd1e3", "#ffffff", "#ffe066", "#ff7aa8", "#f9b4ff"];

/** Cute flower-delivery helicopter (nose left) with a basket of blooms underneath. */
function drawHelicopter(c: CanvasRenderingContext2D, x: number, y: number, tilt: number, t: number) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);
  c.scale(1.5, 1.5);

  // Basket on ropes, swaying gently.
  const sway = Math.sin(t * 2.4) * 0.12;
  c.save();
  c.translate(0, 18);
  c.rotate(sway);
  c.strokeStyle = "rgba(90,70,60,.7)";
  c.lineWidth = 1.3;
  c.beginPath();
  c.moveTo(-6, 0);
  c.lineTo(-12, 22);
  c.moveTo(6, 0);
  c.lineTo(12, 22);
  c.stroke();
  c.fillStyle = "#c98a4b";
  c.beginPath();
  c.moveTo(-16, 22);
  c.lineTo(16, 22);
  c.lineTo(12, 36);
  c.quadraticCurveTo(0, 39, -12, 36);
  c.closePath();
  c.fill();
  c.strokeStyle = "#a36a33";
  c.lineWidth = 1;
  for (let i = -10; i <= 10; i += 5) {
    c.beginPath();
    c.moveTo(i, 23);
    c.lineTo(i * 0.8, 36);
    c.stroke();
  }
  ["#ff7aa8", "#ffe066", "#ffffff", "#ff9cc2", "#f9b4ff"].forEach((col, i) => {
    c.fillStyle = col;
    c.beginPath();
    c.arc(-11 + i * 5.5, 20 - (i % 2) * 3, 4, 0, Math.PI * 2);
    c.fill();
  });
  c.restore();

  // Tail boom + tail rotor.
  c.fillStyle = "#7c5ce0";
  c.beginPath();
  c.moveTo(18, -6);
  c.lineTo(62, -9);
  c.lineTo(62, -3);
  c.lineTo(18, 4);
  c.closePath();
  c.fill();
  c.fillStyle = "#ff7aa8";
  c.beginPath();
  c.moveTo(56, -9);
  c.lineTo(66, -22);
  c.lineTo(70, -20);
  c.lineTo(64, -4);
  c.closePath();
  c.fill();
  c.fillStyle = "rgba(80,70,110,.25)";
  c.beginPath();
  c.arc(66, -12, 9, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "rgba(70,60,100,.8)";
  c.lineWidth = 2;
  const ta = t * 30;
  c.beginPath();
  c.moveTo(66 + Math.cos(ta) * 9, -12 + Math.sin(ta) * 9);
  c.lineTo(66 - Math.cos(ta) * 9, -12 - Math.sin(ta) * 9);
  c.stroke();

  // Skids.
  c.strokeStyle = "#5a4b7d";
  c.lineWidth = 2.2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-26, 20);
  c.lineTo(20, 20);
  c.quadraticCurveTo(26, 20, 27, 15);
  c.moveTo(-14, 12);
  c.lineTo(-16, 20);
  c.moveTo(10, 12);
  c.lineTo(12, 20);
  c.stroke();
  c.lineCap = "butt";

  // Cabin.
  const body = c.createLinearGradient(0, -22, 0, 16);
  body.addColorStop(0, "#a58bff");
  body.addColorStop(1, "#6247c4");
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(-30, 2);
  c.bezierCurveTo(-30, -16, -14, -22, 2, -22);
  c.bezierCurveTo(16, -22, 24, -12, 24, 0);
  c.bezierCurveTo(24, 10, 14, 14, -6, 14);
  c.bezierCurveTo(-22, 14, -30, 10, -30, 2);
  c.closePath();
  c.fill();
  // Bubble windscreen + pilot.
  const glass = c.createLinearGradient(0, -20, 0, 4);
  glass.addColorStop(0, "rgba(190,240,255,.95)");
  glass.addColorStop(1, "rgba(80,175,215,.85)");
  c.fillStyle = glass;
  c.beginPath();
  c.moveTo(-28, 1);
  c.bezierCurveTo(-27, -13, -16, -19, -4, -19);
  c.lineTo(-2, 1);
  c.closePath();
  c.fill();
  c.fillStyle = "#382444";
  c.beginPath();
  c.arc(-10, -7, 4.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#ffd84d";
  c.fillRect(-14, -9, 8, 1.6);
  c.strokeStyle = "rgba(255,255,255,.85)";
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-24, -4);
  c.quadraticCurveTo(-21, -14, -12, -16);
  c.stroke();
  // Side flower decal + stripe.
  c.fillStyle = "#ffd84d";
  c.fillRect(-2, 5, 24, 2.5);
  c.font = "11px serif";
  c.textAlign = "center";
  c.fillText("🌸", 10, 0);

  // Main rotor: mast, blur disc, fast blade.
  c.fillStyle = "#5a4b7d";
  c.fillRect(-1.5, -28, 3, 7);
  c.fillStyle = "rgba(80,70,110,.18)";
  c.beginPath();
  c.ellipse(0, -29, 46, 3.2, 0, 0, Math.PI * 2);
  c.fill();
  const bl = Math.cos(t * 26) * 46;
  c.fillStyle = "rgba(60,50,90,.85)";
  c.beginPath();
  c.roundRect(Math.min(-bl, bl), -30.2, Math.abs(bl * 2) + 0.5, 2.4, 1.2);
  c.fill();
  c.restore();
}

/** Aeroplane towing a waving banner. heading -1 flies left (banner trails right), +1 flies right. */
function drawPlane(c: CanvasRenderingContext2D, x: number, y: number, t: number, heading = -1) {
  c.font = "700 17px Fredoka, sans-serif";
  const chars = [...BANNER];
  const widths = chars.map((ch) => c.measureText(ch).width + 1);
  const bw = widths.reduce((a, b) => a + b, 0) + 30;
  const attach = x - heading * 142; // where the rope meets the banner
  const left = heading < 0 ? attach : attach - bw;
  const dist = (px: number) => Math.abs(px - attach);
  const wave = (d: number) => Math.sin(t * 5 - d * 0.035) * 6 * Math.min(1, d / 60);
  // Tow rope.
  c.strokeStyle = "rgba(70,60,100,.6)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(x - heading * 112, y);
  c.quadraticCurveTo(x - heading * 126, y + 5 + wave(10), attach, y + wave(40));
  c.stroke();
  // Cloth, drawn in vertical strips so it ripples away from the rope.
  const strips = 40;
  for (let i = 0; i < strips; i++) {
    const sx = left + (bw / strips) * i;
    const off = wave(dist(sx) + 40);
    const farEnd = heading < 0 ? i === strips - 1 : i === 0;
    c.fillStyle = farEnd ? "#d9437f" : "#ff6fa5";
    c.fillRect(sx, y - 16 + off, bw / strips + 0.7, 32);
    c.fillStyle = "#ffd84d";
    c.fillRect(sx, y - 16 + off, bw / strips + 0.7, 3);
    c.fillRect(sx, y + 13 + off, bw / strips + 0.7, 3);
  }
  // Swallow-tail at the far end.
  const endOff = wave(bw + 40);
  const ex = heading < 0 ? left + bw : left;
  const d = heading < 0 ? 1 : -1;
  c.fillStyle = "#ff6fa5";
  c.beginPath();
  c.moveTo(ex, y - 16 + endOff);
  c.lineTo(ex + d * 18, y - 16 + endOff);
  c.lineTo(ex + d * 8, y + endOff);
  c.lineTo(ex + d * 18, y + 16 + endOff);
  c.lineTo(ex, y + 16 + endOff);
  c.fill();
  // Letters always read left to right and ride the wave.
  c.fillStyle = "#fff";
  c.textAlign = "left";
  let lx = left + 15;
  chars.forEach((ch, i) => {
    c.fillText(ch, lx, y + 6 + wave(dist(lx) + 40));
    lx += widths[i];
  });

  // The plane itself (artwork faces left; mirrored when heading right).
  c.save();
  c.translate(x, y);
  c.rotate(Math.sin(t * 0.9 + 1) * 0.04 * -heading);
  c.scale(1.3 * -heading, 1.3);
  drawPlaneBody(c, t);
  c.restore();
}

/** Shared plane artwork: also mirrored as SVG in BirthdayPlane.tsx. */
function drawPlaneBody(c: CanvasRenderingContext2D, t: number) {
  const path = (pts: [number, number][]) => {
    c.beginPath();
    pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
    c.closePath();
  };
  const fuselage = () => {
    c.beginPath();
    c.moveTo(-14, 0);
    c.bezierCurveTo(-14, -9, -4, -12, 10, -12);
    c.lineTo(58, -9);
    c.bezierCurveTo(72, -8, 82, -6, 88, -3);
    c.lineTo(88, 1);
    c.bezierCurveTo(78, 5, 66, 8, 52, 9);
    c.lineTo(8, 10);
    c.bezierCurveTo(-6, 10, -14, 7, -14, 0);
    c.closePath();
  };

  // Far-side wing and tailplane peek out behind the body, in shadow.
  c.fillStyle = "#c7cfe0";
  path([[20, -8], [34, -15], [42, -15], [40, -8]]);
  c.fill();
  c.fillStyle = "#e9455f";
  path([[34, -15], [42, -15], [41.2, -13], [33, -13]]);
  c.fill();
  c.fillStyle = "#c7cfe0";
  path([[72, -5], [80, -10], [85, -10], [84, -4]]);
  c.fill();

  // Swept tail fin with a little heart.
  const fin = c.createLinearGradient(70, -26, 86, -4);
  fin.addColorStop(0, "#ff6b85");
  fin.addColorStop(1, "#d83a59");
  c.fillStyle = fin;
  c.beginPath();
  c.moveTo(64, -7);
  c.lineTo(76, -23);
  c.quadraticCurveTo(81, -28, 85, -23);
  c.lineTo(87, -4);
  c.closePath();
  c.fill();
  c.fillStyle = "#fff";
  c.font = "8px serif";
  c.textAlign = "center";
  c.fillText("♥", 80, -12);

  // Fuselage with soft shading.
  const body = c.createLinearGradient(0, -12, 0, 10);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.55, "#f2f5fb");
  body.addColorStop(1, "#c3cde2");
  c.fillStyle = body;
  fuselage();
  c.fill();
  c.strokeStyle = "rgba(60,50,100,.22)";
  c.lineWidth = 0.8;
  c.stroke();

  // Cheat-line stripes, clipped to the body.
  c.save();
  fuselage();
  c.clip();
  c.fillStyle = "#e9455f";
  c.beginPath();
  c.moveTo(-16, 0);
  c.bezierCurveTo(20, -2, 60, -1, 92, -4);
  c.lineTo(92, -1);
  c.bezierCurveTo(60, 2, 20, 1.5, -16, 3);
  c.fill();
  c.fillStyle = "#ffd84d";
  c.beginPath();
  c.moveTo(-16, 3);
  c.bezierCurveTo(20, 1.5, 60, 2, 92, -1);
  c.lineTo(92, 0.6);
  c.bezierCurveTo(60, 3.6, 20, 3.2, -16, 4.6);
  c.fill();
  c.restore();

  // Passenger windows.
  for (let i = 0; i < 5; i++) {
    const wx = 22 + i * 8;
    c.fillStyle = "#6fc6e8";
    c.beginPath();
    c.roundRect(wx, -7.5, 4.6, 4, 1.6);
    c.fill();
    c.fillStyle = "rgba(255,255,255,.8)";
    c.fillRect(wx + 0.8, -7, 1.2, 1.4);
  }

  // Pilot's scarf flutters out behind the cockpit.
  const flap = Math.sin(t * 9) * 2.2;
  c.fillStyle = "#ff8fb8";
  c.beginPath();
  c.moveTo(6, -14);
  c.quadraticCurveTo(13, -17 + flap, 20, -15 - flap);
  c.lineTo(19, -12.5 - flap * 0.6);
  c.quadraticCurveTo(13, -13.5 + flap * 0.5, 7, -12);
  c.fill();
  // Tiny pilot + glass canopy.
  c.fillStyle = "#382444";
  c.beginPath();
  c.arc(4, -12.5, 3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#ffd84d";
  c.fillRect(1.5, -13.6, 5, 1.1);
  const glass = c.createLinearGradient(0, -19, 0, -10);
  glass.addColorStop(0, "rgba(170,232,250,.85)");
  glass.addColorStop(1, "rgba(60,160,205,.75)");
  c.fillStyle = glass;
  c.beginPath();
  c.moveTo(-5, -10.5);
  c.quadraticCurveTo(-2, -19, 7, -18.5);
  c.quadraticCurveTo(12, -18, 13, -11.5);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(255,255,255,.85)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-1.5, -12.5);
  c.quadraticCurveTo(0, -16.5, 5, -17);
  c.stroke();

  // Near wing: slim, swept, body-coloured with a red tip.
  const wing = c.createLinearGradient(0, 2, 0, 15);
  wing.addColorStop(0, "#ffffff");
  wing.addColorStop(1, "#cfd7e8");
  c.fillStyle = wing;
  c.beginPath();
  c.moveTo(18, 3);
  c.lineTo(42, 3);
  c.lineTo(37, 13);
  c.quadraticCurveTo(35, 15.5, 31, 15);
  c.lineTo(24, 14);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(60,50,100,.25)";
  c.lineWidth = 0.8;
  c.stroke();
  c.fillStyle = "#e9455f";
  c.beginPath();
  c.moveTo(25.5, 12);
  c.lineTo(37.8, 11.4);
  c.lineTo(37, 13);
  c.quadraticCurveTo(35, 15.5, 31, 15);
  c.lineTo(24, 14);
  c.closePath();
  c.fill();
  // Near tailplane.
  c.fillStyle = "#e3e8f2";
  path([[72, 1], [86, 0], [84, 6], [77, 6]]);
  c.fill();

  // Nose cone.
  const nose = c.createRadialGradient(-17, -2, 1, -16, 0, 7);
  nose.addColorStop(0, "#fff3b0");
  nose.addColorStop(1, "#f0b429");
  c.fillStyle = nose;
  c.beginPath();
  c.moveTo(-13, -5.5);
  c.quadraticCurveTo(-24, 0, -13, 5.5);
  c.closePath();
  c.fill();

  // Propeller: a soft blur disc plus one fast blade.
  c.fillStyle = "rgba(90,80,130,.16)";
  c.beginPath();
  c.ellipse(-21, 0, 2.6, 17, 0, 0, Math.PI * 2);
  c.fill();
  const len = Math.cos(t * 45) * 16;
  c.fillStyle = "rgba(70,60,100,.8)";
  c.beginPath();
  c.roundRect(-22.2, Math.min(-len, len), 2.4, Math.abs(len * 2) + 0.5, 1.2);
  c.fill();
}

/** Charuta: drawn in local space, feet at (0,0), facing +x. */
function drawCharuta(c: CanvasRenderingContext2D, x: number, feet: number, facing: number, onGround: boolean, anim: number, vy: number, t: number, cheering: boolean) {
  const skin = "#b87350";
  const hair = "#382444";
  const dress = "#f04f87";
  c.save();
  if (onGround) {
    c.fillStyle = "rgba(40,110,64,.28)";
    ellipse(c, x, feet + 1, 20, 5);
  }
  c.translate(x, feet);
  c.scale(facing, 1);
  const running = onGround && Math.abs(Math.sin(anim)) > 0.01;
  const swing = onGround ? Math.sin(anim) * 0.7 : 0;
  const bob = onGround ? Math.abs(Math.sin(anim)) * -2 : 0;
  c.translate(0, bob);

  // Ponytail (behind).
  const tail = Math.sin(t * 8 + anim) * 0.25 + (onGround ? 0 : vy > 0 ? -0.5 : 0.4);
  c.save();
  c.translate(-10, -54);
  c.rotate(-0.6 + tail);
  c.fillStyle = hair;
  ellipse(c, -8, 6, 7, 13);
  c.fillStyle = "#ff5f8f";
  circle(c, 0, 0, 3.5);
  c.restore();

  // Legs.
  const leg = (angle: number, back: boolean) => {
    c.save();
    c.translate(back ? -4 : 4, -20);
    c.rotate(onGround ? angle : back ? 0.5 : -0.6);
    c.fillStyle = back ? "#9b5e42" : skin;
    roundRect(c, -3, 0, 6, 16, 3);
    c.fill();
    c.fillStyle = back ? "#4b3590" : "#6446b3";
    roundRect(c, -3.5, 13, 10, 6, 3);
    c.fill();
    c.restore();
  };
  leg(-swing, true);
  // Back arm.
  const arm = (angle: number, back: boolean) => {
    c.save();
    c.translate(back ? -7 : 7, -38);
    c.rotate(cheering ? (back ? 2.6 : -2.6) * 0.9 : onGround ? angle : -2.4 + (back ? 0.3 : 0));
    c.fillStyle = back ? "#9b5e42" : skin;
    roundRect(c, -2.5, 0, 5, 15, 2.5);
    c.fill();
    circle(c, 0, 15, 3);
    c.restore();
  };
  arm(swing, true);

  // Dress.
  c.fillStyle = dress;
  c.beginPath();
  c.moveTo(-8, -40);
  c.lineTo(8, -40);
  c.lineTo(15, -17);
  c.quadraticCurveTo(0, -13, -15, -17);
  c.closePath();
  c.fill();
  c.fillStyle = "#ffd84d";
  c.fillRect(-9, -31, 18, 3);
  c.fillStyle = "rgba(255,255,255,.85)";
  circle(c, -6, -22, 1.5);
  circle(c, 5, -24, 1.5);
  circle(c, 0, -19, 1.5);
  circle(c, 9, -19, 1.3);
  leg(swing, false);
  arm(-swing, false);

  // Head.
  c.fillStyle = hair;
  circle(c, -1, -52, 14.5);
  c.fillStyle = skin;
  circle(c, 1.5, -50, 12);
  // Fringe.
  c.fillStyle = hair;
  c.beginPath();
  c.arc(0, -52, 14, Math.PI * 1.02, Math.PI * 1.98);
  c.quadraticCurveTo(8, -56, 2, -58);
  c.quadraticCurveTo(-4, -54, -13, -53);
  c.fill();
  // Face.
  const blink = Math.sin(t * 1.3) > 0.985;
  c.fillStyle = "#2d1b34";
  if (blink) {
    c.fillRect(1, -50, 4, 1.4);
    c.fillRect(8, -50, 4, 1.4);
  } else {
    ellipse(c, 3, -49.5, 1.7, 2.2);
    ellipse(c, 10, -49.5, 1.7, 2.2);
    c.fillStyle = "#fff";
    circle(c, 3.6, -50.4, 0.6);
    circle(c, 10.6, -50.4, 0.6);
  }
  c.fillStyle = "rgba(255,120,150,.55)";
  ellipse(c, 0, -45, 2.6, 1.6);
  ellipse(c, 12, -45, 2.6, 1.6);
  c.strokeStyle = "#5e2a37";
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(6.5, -45, running || cheering ? 3.2 : 2.6, 0.15, Math.PI - 0.15);
  c.stroke();

  // Crown.
  c.fillStyle = "#ffcf33";
  c.strokeStyle = "#d89528";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(-8, -63);
  c.lineTo(-9, -72);
  c.lineTo(-4, -67);
  c.lineTo(0, -75);
  c.lineTo(4, -67);
  c.lineTo(9, -72);
  c.lineTo(8, -63);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = "#ff5f8f";
  circle(c, 0, -66, 1.6);
  c.restore();
}
