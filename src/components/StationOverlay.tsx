import type { ModCommand, Participant, Station } from "../realtime/types";
import { VideoTile } from "./VideoTile";
import { Icon } from "./Icon";
import { SpinWheel } from "./SpinWheel";

interface Props {
  station: Station;
  charuta?: Participant;
  friend?: Participant;
  /** Names that can still land on the wheel (not yet spotlighted). */
  wheelNames: string[];
  isCharuta: boolean;
  isModerator: boolean;
  isPickedMe: boolean;
  /** Moderator (or Charuta if no moderator joined) can run the Q&A buttons. */
  canControl: boolean;
  hasModerator: boolean;
  speaking: Set<string>;
  micOn: boolean;
  mutedForQA: boolean;
  onSpin: () => void;
  onAnswer: (option: string) => void;
  onCommand: (a: ModCommand) => void;
  onUnmute: () => void;
}

/** The in-game "Pick a Friend" window and the Q&A spotlight that follows. */
export function StationOverlay(props: Props) {
  const { station, charuta, friend, wheelNames, isCharuta, canControl, speaking } = props;

  if (station.stage === "spin") {
    const spin = station.spin ? { names: station.spin.names, winnerIndex: Math.max(0, station.spin.ids.indexOf(station.spin.winner)), key: `${station.n}-${station.spin.winner}-${station.spin.ids.length}` } : undefined;
    return (
      <div className="station-overlay" role="dialog" aria-label="Spin the wheel">
        <div className="station-card">
          <div className="surprise-tag">🎡 Friend Station {station.n >= 0 ? Math.floor(station.n / 2) + 1 : ""} of 6 · Spin the Wheel</div>
          <div className="pick-layout">
            <div className="pick-charuta">{charuta && <VideoTile p={charuta} variant="stage" speaking={speaking.has(charuta.id)} />}</div>
            <div className="pick-deck">
              <h2>{spin ? "Spinning…" : isCharuta ? "Spin the wheel to pick a friend!" : "Charuta is about to spin…"}</h2>
              <p>{(spin?.names.length ?? wheelNames.length)} friends on the wheel. Whoever it lands on asks Charuta a question!</p>
              <SpinWheel names={wheelNames} spin={spin} canSpin={isCharuta} onSpin={props.onSpin} />
            </div>
          </div>
          {canControl && !spin && (
            <div className="mod-controls">
              <button className="ghost" onClick={() => props.onCommand("close")}>
                Skip this station
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Challenge: Charuta alone in the spotlight, performing the moderator's challenge.
  if (station.stage === "act") {
    return (
      <div className="station-overlay spotlight act" role="dialog" aria-label="Charuta's challenge">
        {Array.from({ length: 14 }).map((_, i) => (
          <i key={i} className={`unlock-confetti uc${i % 5}`} style={{ left: `${(i * 7.3) % 100}%`, animationDelay: `${(i % 7) * -0.3}s` }} />
        ))}
        <div className="spot-wrap" key={`act-${station.act}`}>
          <div className="surprise-tag">🎭 Charuta's Challenge {(station.act ?? 0) + 1} of 5</div>
          <div className="act-stage">
            <figure className="spot-person">
              {charuta && <VideoTile p={charuta} variant="stage" speaking={speaking.has(charuta.id)} />}
              <figcaption>👑 Charuta, it's your turn!</figcaption>
            </figure>
          </div>
          <div className="question-card act-card">
            <small>Your challenge</small>
            <h3>{station.question}</h3>
          </div>
          {props.mutedForQA && <div className="muted-note">🔇 You're muted while Charuta performs. Cheer with the reaction buttons!</div>}
          {canControl ? (
            <div className="mod-controls">
              <button className="primary" onClick={() => props.onCommand("close")}>
                ✅ Done, continue quest
              </button>
            </div>
          ) : (
            <div className="wait-note">{props.hasModerator ? "The moderator will continue the quest when Charuta is done." : "Continue when you're done!"}</div>
          )}
        </div>
      </div>
    );
  }

  // Spotlight: Charuta and the picked friend, big and centred, with the question.
  return (
    <div className="station-overlay spotlight" role="dialog" aria-label="Question time">
      {Array.from({ length: 18 }).map((_, i) => (
        <i key={i} className={`unlock-confetti uc${i % 5}`} style={{ left: `${(i * 5.7) % 100}%`, animationDelay: `${(i % 9) * -0.25}s` }} />
      ))}
      <div className="spot-wrap" key={station.guestId}>
        <div className="surprise-tag">
          <Icon name="sparkle" size={14} /> The wheel picked {friend?.name ?? "a friend"}!
        </div>
        <div className="spot-stage">
          <figure className="spot-person">
            {charuta && <VideoTile p={charuta} variant="stage" speaking={speaking.has(charuta.id)} />}
            <figcaption>👑 Charuta</figcaption>
          </figure>
          <div className="spot-vs">💬</div>
          <figure className="spot-person friend">
            {friend ? <VideoTile p={friend} variant="stage" speaking={speaking.has(friend.id)} /> : <div className="spot-left">This friend just left the party</div>}
            <figcaption>🎉 {friend?.name ?? "Friend"}</figcaption>
          </figure>
        </div>

        <div className="question-card">
          <small>{friend?.name ?? "Your friend"} asks Charuta…</small>
          <h3>{station.question}</h3>
          {!!station.options?.length && !station.answer && isCharuta && (
            <div className="answer-options">
              {station.options.map((o) => (
                <button key={o} onClick={() => props.onAnswer(o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
          {station.answer && <div className="answer-banner">Charuta picked: {station.answer}! 🎉</div>}
        </div>

        {props.isPickedMe && (
          <div className="picked-banner">
            🎤 You've been picked!{" "}
            {props.micOn ? (
              <span>You're unmuted. Ask Charuta the question!</span>
            ) : (
              <button onClick={props.onUnmute}>Unmute & ask the question</button>
            )}
          </div>
        )}
        {props.mutedForQA && <div className="muted-note">🔇 You're muted for this Q&A so everyone can hear. You'll be unmuted after.</div>}

        {canControl ? (
          <div className="mod-controls">
            <button className="primary" onClick={() => props.onCommand("close")}>
              ✅ Q&A done, continue quest
            </button>
            <button className="ghost" onClick={() => props.onCommand("skip")}>
              ⏭ Skip & spin again (not responding)
            </button>
          </div>
        ) : (
          <div className="wait-note">{props.hasModerator ? "The moderator will continue the quest when the Q&A is done." : "Charuta will continue when the Q&A is done."}</div>
        )}
      </div>
    </div>
  );
}
