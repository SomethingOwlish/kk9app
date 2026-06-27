import { useState } from "react";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Props:
//   campaignStatuses — array of definition objects from watchStatuses
//   activeStatuses   — current instances on the character (to show duplicates)
//   onApply(instance) — called when GM confirms applying a status
//   onClose          — close the modal
export default function StatusEditor({ campaignStatuses = [], activeStatuses = [], onApply, onClose }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [overrideVal, setOverrideVal] = useState("");

  const filtered = campaignStatuses.filter(s =>
    !query || s.name.toLowerCase().includes(query.toLowerCase())
  );

  const activeNames = new Set(activeStatuses.map(s => s.name));

  function apply() {
    if (!selected) return;
    const dur = selected.duration || {};
    const durationRemaining =
      dur.mode === "counter" || dur.mode === "charges"
        ? (overrideVal !== "" ? Number(overrideVal) : (dur.value ?? null))
        : null;

    const instance = {
      _uid: uid(),
      definitionId: selected.id,
      name: selected.name,
      durationMode: dur.mode || "time",
      durationRemaining,
      effects: selected.effects || [],
      source: "gm",
    };
    onApply(instance);
    onClose();
  }

  return (
    <div className="kk-modal-backdrop" onClick={onClose}>
      <div className="kk-se-modal" onClick={e => e.stopPropagation()}>
        <div className="kk-se-head">
          <span className="kk-se-title">Добавить статус</span>
          <button className="kk-sc-close" onClick={onClose}>✕</button>
        </div>

        <input
          className="kk-input kk-se-search"
          type="text"
          placeholder="Поиск по названию…"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); setOverrideVal(""); }}
          autoFocus
        />

        <div className="kk-se-list">
          {filtered.length === 0 && (
            <div className="kk-se-empty">
              {campaignStatuses.length === 0
                ? "Статусы не загружены. Загрузите их в Настройках кампании."
                : "Ничего не найдено."}
            </div>
          )}
          {filtered.map(s => {
            const dur = s.duration || {};
            const alreadyOn = activeNames.has(s.name);
            return (
              <div
                key={s.id}
                className={`kk-se-item ${selected?.id === s.id ? "kk-se-item--sel" : ""} ${alreadyOn ? "kk-se-item--active" : ""}`}
                onClick={() => { setSelected(s); setOverrideVal(""); }}
              >
                <span className="kk-se-item-name">{s.name}</span>
                <span className="kk-se-item-dur">
                  {dur.mode === "time" ? "время" : dur.mode === "charges" ? `${dur.value} зарядов` : `${dur.value} раундов`}
                </span>
                {alreadyOn && <span className="kk-se-item-badge">на персонаже</span>}
              </div>
            );
          })}
        </div>

        {selected && (
          <div className="kk-se-footer">
            {(selected.duration?.mode === "counter" || selected.duration?.mode === "charges") && (
              <label className="kk-sc-field">
                <span>{selected.duration.mode === "counter" ? "Раундов" : "Зарядов"} (пусто = {selected.duration.value ?? "∞"})</span>
                <input
                  className="kk-input sm"
                  type="number"
                  min={0}
                  value={overrideVal}
                  onChange={e => setOverrideVal(e.target.value)}
                  placeholder={String(selected.duration.value ?? "")}
                />
              </label>
            )}
            {selected.description && (
              <p className="kk-se-desc">{selected.description}</p>
            )}
            <button className="kk-btn primary kk-se-apply" onClick={apply}>
              Применить «{selected.name}»
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
