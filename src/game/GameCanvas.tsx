import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { GameEngine, type EngineCallbacks, type GameSnapshot } from "./engine";

export interface GameHandle {
  burst: (emoji: string) => void;
  spawnGift: (kind?: "gift" | "cake") => void;
  reset: () => void;
  playerScreen: () => { x: number; y: number };
  snapshot: () => GameSnapshot | null;
  applySnapshot: (s: GameSnapshot) => void;
  callHelicopter: () => void;
}

interface Props extends EngineCallbacks {
  paused: boolean;
  /** Guests watch Charuta's game instead of playing it. */
  spectator?: boolean;
  ref?: Ref<GameHandle>;
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function GameCanvas({ paused, spectator = false, ref, ...callbacks }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new GameEngine(canvas, {
      onMilestone: (m) => cbRef.current.onMilestone(m),
      onStats: (s) => cbRef.current.onStats(s),
      onFinish: () => cbRef.current.onFinish(),
      onToast: (t) => cbRef.current.onToast(t),
      onStation: (n, k) => cbRef.current.onStation(n, k),
    }, spectator);
    engineRef.current = engine;
    if (import.meta.env.DEV) (window as unknown as { __game: GameEngine }).__game = engine;
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      engine.destroy();
    };
  }, []);

  useEffect(() => engineRef.current?.setPaused(paused), [paused]);

  useEffect(() => {
    if (spectator) return;
    const map: Record<string, "left" | "right" | "jump"> = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", Space: "jump", ArrowUp: "jump", KeyW: "jump" };
    const handle = (down: boolean) => (e: KeyboardEvent) => {
      const k = map[e.code];
      if (!k || isTyping(e.target)) return;
      e.preventDefault();
      engineRef.current?.setKey(k, down);
    };
    const kd = handle(true);
    const ku = handle(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [spectator]);

  useImperativeHandle(ref, () => ({
    burst: (e) => engineRef.current?.burst(e),
    spawnGift: (k) => engineRef.current?.spawnGift(k),
    reset: () => engineRef.current?.reset(),
    playerScreen: () => engineRef.current?.playerScreen() ?? { x: 0, y: 0 },
    snapshot: () => engineRef.current?.snapshot() ?? null,
    applySnapshot: (s) => engineRef.current?.applySnapshot(s),
    callHelicopter: () => engineRef.current?.callHelicopter(),
  }));

  const hold = (k: "left" | "right" | "jump") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      engineRef.current?.setKey(k, true);
    },
    onPointerUp: () => engineRef.current?.setKey(k, false),
    onPointerCancel: () => engineRef.current?.setKey(k, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" aria-label="Charuta's Birthday Quest game. Use arrow keys to move and space to jump." />
      {!spectator && <div className="touch-controls" aria-hidden={paused}>
        <div className="touch-dpad">
          <button {...hold("left")} aria-label="Move left">◀</button>
          <button {...hold("right")} aria-label="Move right">▶</button>
        </div>
        <button className="touch-jump" {...hold("jump")} aria-label="Jump">JUMP</button>
      </div>}
    </>
  );
}
