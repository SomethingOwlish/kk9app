import { useState } from "react";
import { DAEMON_COLORS, DAEMON_CORPORATIONS } from "../lib/library";

const COLOR_LABEL = Object.fromEntries(DAEMON_COLORS);
const CORP_LABEL = Object.fromEntries(DAEMON_CORPORATIONS);

// TASK-074 — Daemons section on the character sheet. Daemons are full-schema
// Library entries (kind:"daemon"); the character references them by id in
// refs.daemons[]. GM links/unlinks from the daemon library. true_name is shown
// only to the GM (it's the daemon's leverage).
// Props:
//   daemonIds[]  — character.refs.daemons (library entry ids)
//   library[]    — all daemon-kind library entries the viewer can see
//   isGM
//   onLink(daemonId), onUnlink(daemonId)
export default function DaemonRefs({ daemonIds = [], library = [], isGM, onLink, onUnlink }) {
  const [picking, setPicking] = useState(false);
  const byId = new Map(library.map((d) => [d.id, d]));
  const linked = daemonIds.map((id) => byId.get(id)).filter(Boolean);
  const available = library.filter((d) => !daemonIds.includes(d.id));

  if (linked.length === 0 && !isGM) return null;

  return (
    <details className="kk-bio-details kk-daemons">
      <summary className="kk-h2 kk-bio-summary">Даймоны {linked.length > 0 && <span className="kk-count">{linked.length}</span>}</summary>
      <div className="kk-bio-body">
        {linked.length === 0 && <div className="kk-empty-sm">Нет даймонов</div>}
        <div className="kk-comp-list">
          {linked.map((d) => (
            <div className="kk-comp-row" key={d.id}>
              <div className="kk-comp-av">
                {d.img ? <img src={d.img} alt="" /> : <span>{(d.name || "?")[0]}</span>}
              </div>
              <div className="kk-comp-main">
                <div className="kk-comp-top">
                  <span className="kk-comp-name">{d.name}</span>
                  <span className="kk-comp-state">
                    {[CORP_LABEL[d.corporation], d.major_arcana, COLOR_LABEL[d.color]].filter(Boolean).join(" · ")}
                  </span>
                </div>
                {isGM && d.true_name && <div className="kk-comp-desc"><b>Истинное имя:</b> {d.true_name}</div>}
                {d.description && <div className="kk-comp-desc" dangerouslySetInnerHTML={{ __html: d.description }} />}
              </div>
              {isGM && (
                <div className="kk-comp-acts">
                  <button className="kk-icon-btn kk-icon-del" title="Отвязать" onClick={() => onUnlink?.(d.id)}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isGM && !picking && (
          <button className="kk-btn ghost sm" style={{ marginTop: ".5rem" }} onClick={() => setPicking(true)} disabled={available.length === 0}>
            + Привязать даймона
          </button>
        )}
        {isGM && picking && (
          <div className="kk-item-form" style={{ marginTop: ".5rem" }}>
            {available.length === 0
              ? <div className="kk-empty-sm">Нет свободных даймонов в библиотеке.</div>
              : (
                <select className="kk-input" defaultValue="" onChange={(e) => { if (e.target.value) { onLink?.(e.target.value); setPicking(false); } }}>
                  <option value="" disabled>Выберите даймона…</option>
                  {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            <div className="kk-item-form-actions">
              <button className="kk-btn ghost sm" type="button" onClick={() => setPicking(false)}>Отмена</button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
