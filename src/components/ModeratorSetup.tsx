import { useEffect, useRef, useState } from "react";
import { DEFAULT_ACTS } from "../realtime/questions";

const modPin = () => {
  try {
    return (JSON.parse(sessionStorage.getItem("party-join") || "{}").pin as string) || "";
  } catch {
    return "";
  }
};

interface VideoInfo {
  exists: boolean;
  name?: string;
  size?: number;
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

  useEffect(() => {
    fetch("/api/acts")
      .then((r) => r.json())
      .then((d) => setActs([0, 1, 2, 3, 4].map((i) => d.acts?.[i] ?? "")))
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

  const removeVideo = async () => {
    await fetch("/api/video", { method: "DELETE", headers: { "x-mod-pin": modPin() } }).catch(() => {});
    setVideo({ exists: false });
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
            <small>Plays for everyone when Charuta reaches the Party Castle, before the celebration. MP4, ideally under 300 MB.</small>
            {video.exists ? (
              <div className="video-file">
                <span>
                  ✅ {video.name} <em>({mb(video.size)})</em>
                </span>
                <div>
                  <a href="/api/video" target="_blank" rel="noreferrer">
                    Preview
                  </a>
                  <button onClick={() => fileRef.current?.click()}>Replace</button>
                  <button onClick={removeVideo}>Remove</button>
                </div>
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
