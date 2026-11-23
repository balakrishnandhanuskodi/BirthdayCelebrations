import { useEffect, useState } from "react";

/**
 * When the party opens to guests. Uses the server's clock (so a wrong phone clock
 * doesn't matter) and re-checks every minute in case the moderator changes it.
 */
export function useSchedule() {
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/schedule", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          setOpensAt(d.opensAt ?? null);
          if (typeof d.now === "number") setOffset(d.now - Date.now());
          setLoaded(true);
        })
        .catch(() => alive && setLoaded(true));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const at = opensAt ? Date.parse(opensAt) : NaN;
  const msLeft = Number.isFinite(at) ? Math.max(0, at - (now + offset)) : 0;
  return { loaded, opensAt, msLeft, isOpen: msLeft === 0 };
}

export function formatOpening(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
}
