import { useState, useEffect } from "react";
import { watchRolls } from "../lib/db";

// Campaign-wide roll log (chat-style). Last 50 rolls, live.
export default function RollLogView({ campaignId, isGM = false }) {
  const [rolls, setRolls] = useState([]);
  useEffect(() => watchRolls(campaignId, setRolls, 50), [campaignId]);

  return (
    <div className="kk-rolllog">
      <div className="kk-board-topbar">
        <div className="kk-h2">Лог бросков</div>
      </div>
      {rolls.length === 0 && <div className="kk-empty">Бросков пока не было.</div>}
      <div className="kk-rolllog-list">
        {rolls.map((r) => {
          const ts = r.at?.toDate ? r.at.toDate() : null;
          const time = ts ? ts.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "…";
          const verdict = r.snakeEyes ? "fail" : r.success ? "ok" : "fail";
          return (
            <div className={`kk-rolllog-row kk-rl-${verdict}`} key={r.id}>
              <div className="kk-rl-head">
                <span className="kk-rl-name">{r.characterName || "—"}</span>
                <span className="kk-rl-ability">{r.abilityName}</span>
                <span className="kk-rl-time">{time}</span>
              </div>
              <div className="kk-rl-body">
                <span className="kk-rl-kept">d{r.die} → {r.keptRaw}{r.modifier ? `${r.modifier > 0 ? "+" : ""}${r.modifier}` : ""} = <b>{r.finalTotal}</b></span>
                <span className={`kk-rl-verdict kk-rl-${verdict}`}>
                  {r.snakeEyes ? "💀 крит. провал" : r.success ? (r.raises > 0 ? `✔ +${r.raises}` : "✔ успех") : "✘ провал"}
                </span>
                {r.tension?.increment ? (
                  isGM
                    ? <span className="kk-rl-tension">⚗ {r.tension.increment > 0 ? "+" : ""}{r.tension.increment}</span>
                    : <span className="kk-rl-tension">⚗ {r.tension.increment > 0 ? "напряжение возросло" : "напряжение снизилось"}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
