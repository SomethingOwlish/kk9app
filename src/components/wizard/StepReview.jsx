const ATTR_LABELS = {
  agility: "Ловкость", smarts: "Хитрость", spirit: "Дух",
  endurance: "Выносливость", magic: "Магия",
};
const ATTRS = ["agility", "smarts", "spirit", "endurance", "magic"];

export default function StepReview({ identity, attrDice, skills, specCount, bgSelections, saving, onConfirm }) {
  const chosenBgs = Object.entries(bgSelections || {}).filter(([, v]) => v.selected);
  return (
    <div className="kk-block">
      <h2 className="kk-h2">Итог</h2>
      <p className="kk-wiz-hint">Проверьте данные персонажа и подтвердите создание.</p>

      <div className="kk-wiz-review-section">
        <div className="kk-h2">Личность</div>
        <div className="kk-wiz-review-row"><span>Имя</span><strong>{identity.name || "—"}</strong></div>
        <div className="kk-wiz-review-row"><span>Возраст</span><strong>{identity.age}</strong></div>
        {identity.gender && <div className="kk-wiz-review-row"><span>Пол</span><strong>{{ m: "М", f: "Ж", nb: "Нонбинари" }[identity.gender] || identity.gender}</strong></div>}
        {identity.birthplace && <div className="kk-wiz-review-row"><span>Место рождения</span><strong>{identity.birthplace}</strong></div>}
        {identity.height && <div className="kk-wiz-review-row"><span>Рост</span><strong>{identity.height}</strong></div>}
      </div>

      <div className="kk-wiz-review-section">
        <div className="kk-h2">Атрибуты</div>
        {ATTRS.map(a => (
          <div key={a} className="kk-wiz-review-row">
            <span>{ATTR_LABELS[a]}</span>
            <strong>d{attrDice[a]}</strong>
          </div>
        ))}
      </div>

      <div className="kk-wiz-review-section">
        <div className="kk-h2">Навыки ({skills.length})</div>
        <div className="kk-wiz-fac-abilities">
          {skills.map(s => (
            <span key={s.name} className="kk-wiz-ability-tag">
              {s.name} d{s.die}{s.modifier !== 0 ? (s.modifier > 0 ? "+" : "") + s.modifier : ""}
            </span>
          ))}
        </div>
      </div>

      {(specCount > 0 || chosenBgs.length > 0) && (
        <div className="kk-wiz-review-section">
          <div className="kk-h2">Запросы ГМу</div>
          {specCount > 0 && (
            <div className="kk-wiz-review-row">
              <span>Спецспособностей</span><strong>{specCount}</strong>
            </div>
          )}
          {chosenBgs.map(([key, val]) => (
            <div key={key} className="kk-wiz-review-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
              <strong>{key}</strong>
              {val.notes && <span className="kk-text-dim" style={{ fontSize: 12 }}>{val.notes}</span>}
            </div>
          ))}
        </div>
      )}

      <button
        className="kk-create-btn"
        style={{ marginTop: 16 }}
        disabled={saving || !identity.name?.trim()}
        onClick={onConfirm}
      >
        {saving ? "Сохраняем…" : "Подтвердить создание"}
      </button>
      {!identity.name?.trim() && (
        <p className="kk-text-dim" style={{ fontSize: 12, textAlign: "center" }}>
          Введите имя персонажа (шаг 1)
        </p>
      )}
    </div>
  );
}
