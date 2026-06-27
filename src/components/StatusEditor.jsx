import { useState } from "react";
import { STATUSES } from "../lib/seed-statuses";

export default function StatusEditor({ activeStatuses = [], onApply, onClose }) {
  const [selected, setSelected] = useState(null);
  const [duration, setDuration] = useState(3);

  const activeIds = new Set(activeStatuses.map(s => s.id));

  function confirm() {
    if (!selected) return;
    const instance = {
      id: selected.id,
      name: selected.name,
      icon: selected.icon,
      type: selected.type,
      value: selected.value,
      durationMode: selected.durationMode,
      durationRemaining: selected.durationMode === "counter" ? duration : null,
      source: "gm",
    };
    onApply(instance);
    onClose();
  }

  return (
    <div className="kk-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="kk-modal kk-status-modal">
        <div className="kk-modal-head">
          <span className="kk-modal-title">Применить статус</span>
          <button className="kk-modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="kk-modal-body">
          <div className="kk-status-grid">
            {STATUSES.map(s => (
              <button
                key={s.id}
                className={`kk-status-pick ${selected?.id === s.id ? "active" : ""} ${activeIds.has(s.id) ? "applied" : ""}`}
                onClick={() => setSelected(s)}
                title={s.name}
              >
                <span className="kk-status-pick-icon">{s.icon}</span>
                <span className="kk-status-pick-name">{s.name}</span>
                {activeIds.has(s.id) && <span className="kk-status-pick-badge">✓</span>}
              </button>
            ))}
          </div>

          {selected?.durationMode === "counter" && (
            <div className="kk-field" style={{ marginTop: 12 }}>
              <label>Длительность (тиков тайм-ревинда)</label>
              <input
                className="kk-input sm"
                type="number"
                min={1}
                max={999}
                value={duration}
                onChange={e => setDuration(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          )}

          {selected && (
            <p className="kk-modal-hint" style={{ marginTop: 8 }}>
              <b>{selected.icon} {selected.name}</b>
              {selected.type === "roll_modifier" && ` · бросок ${selected.value >= 0 ? "+" : ""}${selected.value}`}
              {" · "}
              {selected.durationMode === "permanent" ? "постоянный" :
               selected.durationMode === "scene"    ? "до смены сцены" :
               `${duration} тик(ов)`}
            </p>
          )}
        </div>
        <div className="kk-modal-foot">
          <button className="kk-btn ghost sm" onClick={onClose}>Отмена</button>
          <button className="kk-btn primary sm" disabled={!selected} onClick={confirm}>Применить</button>
        </div>
      </div>
    </div>
  );
}
