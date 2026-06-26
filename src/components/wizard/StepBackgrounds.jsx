export default function StepBackgrounds({ backgrounds, bgBudget, selections, onChange }) {
  const spent = backgrounds.reduce((sum, bg) => {
    return selections[bg.key]?.selected ? sum + bg.cost : sum;
  }, 0);
  const remaining = bgBudget - spent;

  function toggle(bg) {
    const cur = selections[bg.key] || { selected: false, notes: "" };
    if (!cur.selected && remaining < bg.cost) return;
    onChange({ ...selections, [bg.key]: { ...cur, selected: !cur.selected } });
  }

  function setNotes(bg, notes) {
    const cur = selections[bg.key] || { selected: false, notes: "" };
    onChange({ ...selections, [bg.key]: { ...cur, notes } });
  }

  return (
    <div className="kk-block">
      <h2 className="kk-h2">
        Бэкграунды
        <span className="kk-count">очков: {remaining} / {bgBudget}</span>
      </h2>
      <p className="kk-wiz-hint">
        Выберите бэкграунды на оставшиеся очки навыков. ГМ учтёт их при формировании мира.
      </p>
      {bgBudget === 0 && (
        <p className="kk-note">У вас нет сохранённых очков навыков для бэкграундов.</p>
      )}
      <div className="kk-wiz-bg-list">
        {backgrounds.map(bg => {
          const sel = selections[bg.key];
          const isSelected = sel?.selected || false;
          const canSelect = isSelected || remaining >= bg.cost;
          return (
            <div key={bg.key} className={`kk-wiz-bg-card${isSelected ? " selected" : ""}${!canSelect ? " disabled" : ""}`}>
              <div className="kk-wiz-bg-head">
                <label className="kk-wiz-bg-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(bg)}
                    disabled={!canSelect && !isSelected}
                  />
                  <span className="kk-wiz-bg-label">{bg.label}</span>
                </label>
                <span className="kk-wiz-bg-cost">{bg.cost} оч.</span>
              </div>
              <p className="kk-wiz-bg-desc">{bg.desc}</p>
              {isSelected && (
                <textarea
                  className="kk-input kk-textarea"
                  rows={2}
                  placeholder="Пожелания мастеру…"
                  value={sel?.notes || ""}
                  onChange={e => setNotes(bg, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
