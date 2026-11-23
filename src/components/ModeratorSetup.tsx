import { useEffect, useRef, useState } from "react";
import { DEFAULT_ACTS } from "../realtime/questions";
import { formatOpening } from "../lib/useSchedule";

const modPin = () => {
  try {
    return (JSON.parse(sessionStorage.getItem("party-join") || "{}").pin as string) || "";
  } catch {
    return "";
  }
};

interface VideoInfo {
  exists: boolean;
  /** "upload" when running `pnpm party` locally; "link" on Netlify (paste a URL). */
  mode?: "upload" | "link";
  name?: string;
  size?: number;
  url?: string;
}

const mb = (n = 0) => `${(n / 1024 / 1024).toFixed(n > 100 * 1024 * 1024 ? 0 : 1)} MB`;

/** Moderator-only: Charuta's 5 challenges and the team's finale film. */
export function ModeratorSetup() {
  const [open, setOpen] = useState(true);
  const [acts, setActs] = useState<string[]>(["", "", "", "", ""]);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [video, setVideo] = useState<VideoInfo>({ exists: false });
  const [progress, setProgress] = useState<number | null>(null);
  const [videoError, setVideoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [opensAt, setOpensAt] = useState<string | null>(null);
  const [opensInput, setOpensInput] = useState("");
  const [schedMsg, setSchedMsg] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => {
    fetch("/api/acts")
      .then((r) => r.json())
      .then((d) => setActs([0, 1, 2, 3, 4].map((i) => d.acts?.[i] ?? "")))
      .catch(() => {});
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => {
        setOpensAt(d.opensAt ?? null);
        setOpensInput(d.opensAt ? toLocalInput(d.opensAt) : "");
      })
      .catch(() => {});
    fetch("/api/video/info")
      .then((r) => r.json())
      .then(setVideo)
      .catch(() => {});
  }, []);

  const saveActs = async () => {
    setSaved("saving");
    try {
      const r = await fetch("/api/acts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: modPin(), acts }) });
      setSaved(r.ok ? "saved" : "error");
    } catch {
      setSaved("error");
    }
  };

  const upload = (file: File) => {
    setVideoError("");
    if (!file.type.startsWith("video/")) return setVideoError("Please choose a video file (MP4 works best).");
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/video");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-mod-pin", modPin());
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
    xhr.onload = () => {
      setProgress(null);
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 300) setVideoError(d.error || "Upload failed");
        else setVideo(d);
      } catch {
        setVideoError("Upload failed");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setVideoError("Upload failed. Check the connection and try again.");
    };
    setProgress(0);
    xhr.send(file);
  };

  const saveLink = async () => {
    setVideoError("");
    setLinkBusy(true);
    try {
      const r = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: modPin(), url: link.trim() }) });
      const d = await r.json();
      if (!r.ok) setVideoError(d.error || "Couldn't save the link");
      else {
        setVideo(d);
        setLink("");
      }
    } catch {
      setVideoError("Couldn't save the link");
    } finally {
      setLinkBusy(false);
    }
  };

  const saveSchedule = async (value: string | null) => {
    setSchedMsg("");
    try {
      const r = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: modPin(), opensAt: value === null ? null : new Date(value).toISOString() }) });
      const d = await r.json();
      if (!r.ok) return setSchedMsg(d.error || "Couldn't save");
      setOpensAt(d.opensAt ?? null);
      setSchedMsg(d.opensAt ? "✓ Saved" : "✓ Sign-in is open now");
    } catch {
      setSchedMsg("Couldn't save");
    }
  };

  const removeVideo = async () => {
    await fetch("/api/video", { method: "DELETE", headers: { "x-mod-pin": modPin(), "Content-Type": "application/json" }, body: JSON.stringify({ pin: modPin() }) }).catch(() => {});
    setVideo((v) => ({ exists: false, mode: v.mode }));
  };

  return (
    <div className="mod-setup">
      <button className="mod-setup-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>🛠️ Moderator setup</span>
        <small>{open ? "Hide" : "Show"}</small>
      </button>
      {open && (
        <>
          <div className="mod-section">
            <b>⏰ Party opening time</b>
            <small>Guests see a countdown until then; sign-in opens automatically. Charuta and moderators can always log in.</small>
            <div className="sched-now">{opensAt && Date.parse(opensAt) > Date.now() ? <>🔒 Opens {formatOpening(opensAt)}</> : <>✅ Sign-in is open</>}</div>
            <input className="sched-input" type="datetime-local" value={opensInput} onChange={(e) => setOpensInput(e.target.value)} />
            <div className="sched-buttons">
              <button className="mod-save" onClick={() => opensInput && saveSchedule(opensInput)} disabled={!opensInput}>
                Save opening time
              </button>
              <button className="mod-save ghost" onClick={() => saveSchedule(null)}>
                Open now
              </button>
            </div>
            {schedMsg && <small className={schedMsg.startsWith("✓") ? "ok" : "err"}>{schedMsg}</small>}
          </div>

          <div className="mod-section">
            <b>🎭 Charuta's 5 challenges</b>
            <small>Shown between the friend reveals (Friend 1 → Challenge 1 → Friend 2 …). Leave blank to use the suggestion.</small>
            {acts.map((a, i) => (
              <label key={i} className="act-field">
                <span>{i + 1}</span>
                <input
                  value={a}
                  maxLength={200}
                  placeholder={DEFAULT_ACTS[i]}
                  onChange={(e) => {
                    setSaved("idle");
                    setActs((l) => l.map((x, j) => (j === i ? e.target.value : x)));
                  }}
                />
              </label>
            ))}
            <button className="mod-save" onClick={saveActs} disabled={saved === "saving"}>
              {saved === "saving" ? "Saving…" : saved === "saved" ? "✓ Saved" : "Save challenges"}
            </button>
            {saved === "error" && <small className="err">Couldn't save. Is your moderator PIN right?</small>}
          </div>

          <div className="mod-section">
            <b>🎬 Team video for the finale</b>
            <small>
              Plays for everyone when Charuta reaches the Party Castle, before the celebration.{" "}
              {video.mode === "link" ? "Paste a direct link to the MP4 file (it must play when opened in a browser tab)." : "MP4, ideally under 300 MB."}
            </small>
            {video.exists ? (
              <div className="video-file">
                <span>
                  ✅ {video.name} {video.size ? <em>({mb(video.size)})</em> : null}
                </span>
                <div>
                  <a href={video.url || "/api/video"} target="_blank" rel="noreferrer">
                    Preview
                  </a>
                  {video.mode !== "link" && <button onClick={() => fileRef.current?.click()}>Replace</button>}
                  <button onClick={removeVideo}>Remove</button>
                </div>
              </div>
            ) : video.mode === "link" ? (
              <div className="video-link">
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…/team-video.mp4" />
                <button className="mod-save" onClick={saveLink} disabled={linkBusy || !link.trim()}>
                  {linkBusy ? "Saving…" : "Save video link"}
                </button>
              </div>
            ) : (
              <button className="mod-save" onClick={() => fileRef.current?.click()} disabled={progress !== null}>
                ⬆️ Upload video
              </button>
            )}
            {progress !== null && (
              <div className="upload-bar">
                <i style={{ width: `${Math.round(progress * 100)}%` }} />
                <span>Uploading… {Math.round(progress * 100)}%</span>
              </div>
            )}
            {videoError && <small className="err">{videoError}</small>}
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** ISO time → value for <input type="datetime-local"> in this device's time zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
