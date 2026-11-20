/** Tiny Web Audio sound kit: no audio files needed. */
let ctx: AudioContext | null = null;
let muted = false;

export function setSfxMuted(value: boolean) {
  muted = value;
}
export function isSfxMuted() {
  return muted;
}

function ac() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  return ctx;
}

/**
 * Browsers (Safari and Chrome especially) only allow sound after a tap or key
 * press. Create and resume the audio engine on the first interaction, and
 * play one silent sample so iOS fully unlocks it.
 */
export function unlockAudio() {
  try {
    const a = ac();
    const buf = a.createBuffer(1, 1, 22050);
    const src = a.createBufferSource();
    src.buffer = buf;
    src.connect(a.destination);
    src.start(0);
  } catch {
    /* no audio support */
  }
}
if (typeof window !== "undefined") {
  const once = () => {
    unlockAudio();
    if (ctx?.state === "running") ["pointerdown", "keydown", "touchend"].forEach((e) => window.removeEventListener(e, once, true));
  };
  ["pointerdown", "keydown", "touchend"].forEach((e) => window.addEventListener(e, once, true));
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "triangle", vol = 0.08, slideTo?: number) {
  const a = ac();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime + start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + start + dur);
  gain.gain.setValueAtTime(0.0001, a.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(vol, a.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur + 0.05);
}

function safe(fn: () => void) {
  if (muted) return;
  try {
    fn();
  } catch {
    /* sound is an enhancement only */
  }
}

export const sfx = {
  jump: () => safe(() => tone(330, 0, 0.16, "square", 0.035, 620)),
  star: () => safe(() => { tone(988, 0, 0.08, "square", 0.04); tone(1319, 0.07, 0.22, "square", 0.04); }),
  tick: () => safe(() => tone(1400, 0, 0.03, "square", 0.025)),
  bump: () => safe(() => tone(180, 0, 0.12, "square", 0.05, 120)),
  hurt: () => safe(() => tone(420, 0, 0.3, "sawtooth", 0.04, 140)),
  pop: () => safe(() => tone(600, 0, 0.12, "sine", 0.08, 1200)),
  reveal: () =>
    safe(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, "triangle", 0.07))),
  cheer: () =>
    safe(() => {
      // A burst of claps: short filtered noise hits.
      const a = ac();
      for (let i = 0; i < 14; i++) {
        const buf = a.createBuffer(1, a.sampleRate * 0.05, a.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length) ** 3;
        const src = a.createBufferSource();
        const f = a.createBiquadFilter();
        const g = a.createGain();
        f.type = "bandpass";
        f.frequency.value = 1200 + Math.random() * 900;
        g.gain.value = 0.35;
        src.buffer = buf;
        src.connect(f).connect(g).connect(a.destination);
        src.start(a.currentTime + i * 0.07 + Math.random() * 0.04);
      }
      [784, 988, 1175].forEach((fr, i) => tone(fr, 0.1 + i * 0.12, 0.3, "triangle", 0.05));
    }),
  fanfare: () =>
    safe(() => {
      const notes: [number, number, number][] = [[523, 0, 0.18], [523, 0.2, 0.18], [523, 0.4, 0.18], [659, 0.6, 0.5], [587, 1.1, 0.18], [659, 1.3, 0.18], [784, 1.5, 0.9]];
      notes.forEach(([f, s, d]) => { tone(f, s, d, "square", 0.04); tone(f / 2, s, d, "triangle", 0.05); });
    }),
};

/**
 * "Happy Birthday to You" (public domain melody). Calls onLine(i) as each of
 * the four lines starts. Returns a stop function.
 */
export function playBirthdaySong(onLine: (line: number) => void, onEnd: () => void) {
  const N: Record<string, number> = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
  const lines: [string, number][][] = [
    [["G4", 0.75], ["G4", 0.25], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2]],
    [["G4", 0.75], ["G4", 0.25], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2]],
    [["G4", 0.75], ["G4", 0.25], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 2]],
    [["F5", 0.75], ["F5", 0.25], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 3]],
  ];
  const beat = 0.48;
  const timers: number[] = [];
  let t = 0.1;
  lines.forEach((line, li) => {
    timers.push(window.setTimeout(() => onLine(li), t * 1000));
    line.forEach(([n, b]) => {
      if (!muted) {
        try {
          tone(N[n], t, b * beat * 0.95, "triangle", 0.09);
          tone(N[n] * 2, t, b * beat * 0.6, "sine", 0.02);
        } catch { /* ignore */ }
      }
      t += b * beat;
    });
    t += 0.15;
  });
  timers.push(window.setTimeout(onEnd, t * 1000 + 200));
  return () => timers.forEach(clearTimeout);
}
