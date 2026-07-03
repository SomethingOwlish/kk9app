import { useState, useEffect } from "react";
import { watchLatestJournalPage } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

// IMP-13 — landing "Сессия" block. Next session is a GM-set campaign field;
// the last-session log is derived from the newest public campaign journal page.
export default function SessionPanel({ campaign }) {
  const [lastLog, setLastLog] = useState(null);
  useEffect(
    () => watchLatestJournalPage(CAMPAIGN_ID, "campaign", setLastLog),
    []
  );

  const next = campaign?.nextSession?.trim?.() || "";
  if (!next && !lastLog) return null;

  return (
    <div className="kk-landing-panel kk-session-panel">
      <h2 className="kk-h2">Сессия</h2>
      <div className="kk-session-row">
        <span className="kk-session-label">Следующая</span>
        <span className="kk-session-next">{next || "не назначена"}</span>
      </div>
      {lastLog && (
        <div className="kk-session-last">
          <span className="kk-session-label">Прошлая</span>
          <div className="kk-session-log-title">{lastLog.title || "Без названия"}</div>
          {lastLog.body && <p className="kk-session-log-body">{lastLog.body}</p>}
        </div>
      )}
    </div>
  );
}
