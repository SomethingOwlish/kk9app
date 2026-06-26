import { useState, useEffect } from "react";
import { watchCharacterLog } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

function fmtDate(at) {
  if (!at?.toDate) return "…";
  return at.toDate().toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LogView({ char, onClose, onClear }) {
  const [entries, setEntries] = useState(null);
  useEffect(() => watchCharacterLog(CAMPAIGN_ID, char.id, setEntries), [char.id]);

  return (
    <div className="kk-edit">
      <div className="kk-edit-bar">
        <span className="kk-edit-title">Логи · {char.name}</span>
        <div className="kk-edit-actions">
          <button className="kk-btn ghost" onClick={onClose}>Назад</button>
          <button className="kk-btn danger" disabled={!entries?.length}
            onClick={() => { if (confirm("Удалить все записи лога этого персонажа?")) onClear(); }}>
            Удалить записи
          </button>
        </div>
      </div>
      {entries === null && <div className="kk-load">Загрузка…</div>}
      {entries && entries.length === 0 && <div className="kk-empty">Записей пока нет.</div>}
      {entries && entries.map(e => (
        <div className="kk-log" key={e.id}>
          <div className="kk-log-head">
            <span className="kk-log-date">{fmtDate(e.at)}</span>
            <span className="kk-log-spent">−{e.spent} опыта</span>
          </div>
          <div className="kk-log-changes">{(e.changes || []).map((c, j) => (
            <div className="kk-log-row" key={j}>
              <span className="kk-log-kind">{c.kind === "attr" ? "атрибут" : "навык"}</span>
              <span className="kk-log-name">{c.name}</span>
              <span className="kk-log-delta">{c.from} → {c.to}</span>
              <span className="kk-log-cost">{c.spent}</span>
            </div>
          ))}</div>
        </div>
      ))}
    </div>
  );
}
