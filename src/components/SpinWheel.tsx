import { useEffect, useRef, useState } from "react";
import { sfx } from "../lib/audio";

export const SPIN_MS = 5200;

const COLORS = ["#ff6fa5", "#ffd84d", "#5ec8e5", "#8e6cf0", "#6cd27f", "#ff9a52", "#f06292", "#4dd0b8"];

const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};

const short = (name: string, n: number) => {
  const first = name.trim().split(/\s+/)[0] || name;
  const max = n <= 12 ? 11 : n <= 20 ? 8 : 6;
  return first.length > max ? first.slice(0, max - 1) + "…" : first;
};

interface Props {
  /** Names on the wheel right now (before spinning). */
  names: string[];
  /** Once Charuta spins: the frozen list and the winner's index. */
  spin?: { names: string[]; winnerIndex: number; key: string };
  canSpin: boolean;
  onSpin: () => void;
}

/**
 * A prize wheel. The winner is decided by Charuta's browser; every screen computes the same
 * final angle from it, so everyone sees the wheel land on the same person.
 */
export function SpinWheel({ names: liveNames, spin, canSpin, onSpin }: Props) {
  const names = spin ? spin.names : liveNames;
  const n = Math.max(1, names.length);
  const seg = 360 / n;
  const wheelRef = useRef<SVGGElement>(null);
  const [rotation, setRotation] = useState(0);
  const [pointerName, setPointerName] = useState<string | null>(null);

  // Start spinning when a spin arrives.
  useEffect(() => {
    if (!spin) {
      setRotation(0);
      setPointerName(null);
      return;
    }
    // Land inside the winner's slice, at a jitter every screen agrees on.
    const jitter = ((hash(spin.key) % 1000) / 1000 - 0.5) * seg * 0.6;
    const final = 360 * 7 - (spin.winnerIndex + 0.5) * seg + jitter;
    const raf = requestAnimationFrame(() => setRotation(final));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key]);

  // Show the name passing under the pointer and tick as each slice goes by.
  useEffect(() => {
    if (!spin) return;
    let raf = 0;
    let last = -1;
    const started = performance.now();
    const loop = () => {
      const el = wheelRef.current;
      if (el) {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        const deg = ((Math.atan2(m.b, m.a) * 180) / Math.PI + 360) % 360;
        const idx = Math.floor((((360 - deg) % 360) + 360) % 360 / seg) % n;
        if (idx !== last) {
          last = idx;
          setPointerName(spin.names[idx]);
          sfx.tick();
        }
      }
      if (performance.now() - started < SPIN_MS + 300) raf = requestAnimationFrame(loop);
      else setPointerName(spin.names[spin.winnerIndex]);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key]);

  const R = 150;
  const labelR = n > 20 ? R * 0.74 : R * 0.64;
  const fontSize = n <= 8 ? 15 : n <= 14 ? 12.5 : n <= 22 ? 10 : 8;
  const slice = (i: number) => {
    if (n === 1) return `M0,0 m-${R},0 a${R},${R} 0 1,0 ${R * 2},0 a${R},${R} 0 1,0 -${R * 2},0`;
    const a0 = ((i * seg - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
    const large = seg > 180 ? 1 : 0;
    return `M0,0 L${R * Math.cos(a0)},${R * Math.sin(a0)} A${R},${R} 0 ${large},1 ${R * Math.cos(a1)},${R * Math.sin(a1)} Z`;
  };

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true">▼</div>
      <svg className="wheel" viewBox="-160 -160 320 320" role="img" aria-label={`Wheel with ${n} names`}>
        <circle r="158" fill="#3a2b64" />
        <g ref={wheelRef} style={{ transformBox: "fill-box", transformOrigin: "center", transform: `rotate(${rotation}deg)`, transition: spin ? `transform ${SPIN_MS}ms cubic-bezier(.12,.62,.08,1)` : "none" }}>
          {names.map((name, i) => {
            const mid = (i + 0.5) * seg - 90;
            const rad = (mid * Math.PI) / 180;
            return (
              <g key={i}>
                <path d={slice(i)} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={n > 24 ? 0.6 : 1.5} />
                <text x={labelR * Math.cos(rad)} y={labelR * Math.sin(rad)} transform={`rotate(${mid} ${labelR * Math.cos(rad)} ${labelR * Math.sin(rad)})`} textAnchor="middle" dominantBaseline="middle" fontSize={fontSize} fontWeight={800} fill="#2b1d4f">
                  {short(name, n)}
                </text>
              </g>
            );
          })}
        </g>
        {Array.from({ length: 16 }).map((_, i) => (
          <circle key={i} cx={154 * Math.cos((i * Math.PI) / 8)} cy={154 * Math.sin((i * Math.PI) / 8)} r="3" fill="#ffd84d" />
        ))}
      </svg>
      <button className="wheel-hub" onClick={onSpin} disabled={!canSpin || !!spin}>
        {spin ? "🎡" : canSpin ? "SPIN!" : "🎡"}
      </button>
      <div className={`wheel-name ${pointerName ? "on" : ""}`}>{pointerName ?? (canSpin ? "Press SPIN!" : "Waiting for Charuta to spin…")}</div>
    </div>
  );
}
