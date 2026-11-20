import { useCallback, useEffect, useState } from "react";
import { CharutaLogin, ModeratorLogin, Welcome, type JoinRequest } from "./components/Welcome";
import { Celebration } from "./components/Celebration";
import type { JoinInfo } from "./realtime/useLiveParty";

const pageRole = (): JoinRequest["role"] => {
  const p = location.pathname.replace(/\/+$/, "");
  return p.endsWith("/charuta") ? "charuta" : p.endsWith("/moderator") ? "moderator" : "guest";
};

function deviceId() {
  let id = localStorage.getItem("party-guest-id");
  if (!id) {
    id = Math.random().toString(36).slice(2, 12);
    localStorage.setItem("party-guest-id", id);
  }
  return id;
}

export default function App() {
  const role = pageRole();
  const [join, setJoin] = useState<JoinInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const doJoin = useCallback(async (r: JoinRequest) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...r, id: deviceId() }) });
      const text = await res.text();
      let data: { error?: string; token?: string; url?: string; identity?: string } = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("The party server isn't responding properly. Please tell the host.");
      }
      if (!res.ok || !data.token) throw new Error(data.error || "Could not join");
      // Remember this session so a page refresh rejoins automatically.
      sessionStorage.setItem("party-join", JSON.stringify(r));
      setJoin({ token: data.token, url: data.url ?? "", identity: data.identity ?? "", role: r.role, name: r.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join. Check your connection.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("party-join");
    if (!saved) return;
    const r = JSON.parse(saved) as JoinRequest;
    if (r.role === role) doJoin(r);
  }, [role, doJoin]);

  if (join)
    return (
      <Celebration
        key={join.token}
        join={join}
        onLeave={() => {
          sessionStorage.removeItem("party-join");
          setJoin(null);
        }}
      />
    );
  if (role === "charuta") return <CharutaLogin onJoin={doJoin} busy={busy} error={error} />;
  if (role === "moderator") return <ModeratorLogin onJoin={doJoin} busy={busy} error={error} />;
  return <Welcome onJoin={doJoin} busy={busy} error={error} />;
}
