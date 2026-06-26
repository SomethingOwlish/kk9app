const ATTR_LABELS = {
  agility: "Ловкость", smarts: "Хитрость", spirit: "Дух",
  endurance: "Выносливость", magic: "Магия",
};
const ATTRS = ["agility", "smarts", "spirit", "endurance", "magic"];

export default function StepReview({ identity, faculty, attrDice, skills, saving, onConfirm }) {
  return (
    <div className="kk-block">
      <h2 className="kk-h2">Итог</h2>
      <p className="kk-wiz-hint">Проверьте данные персонажа и подтвердите создание.</p>

      <div className="kk-wiz-review-section">
        <div className="kk-h2">Личность</div>
        <div className="kk-wiz-review-row"><span>Имя</span><strong>{identity.name || "—"}</strong></div>
        <div className="kk-wiz-review-row"><span>Возраст</span><strong>{identity.age}</strong></div>
        {identity.gender && <div className="kk-wiz-review-row"><span>Пол</span><strong>{identity.gender}</strong></div>}
        {identity.birthplace && <div className="kk-wiz-review-row"><span>Место рождения</span><strong>{identity.birthplace}</strong></div>}
        {identity.dormitory && <div className="kk-wiz-review-row"><span>Дормиторий</span><strong>{identity.dormitory}</strong></div>}
        {identity.height && <div className="kk-wiz-review-row"><span>Рост</span><strong>{identity.height}</strong></div>}
      </div>

      <div className="kk-wiz-review-section">
        <div className="kk-h2">Факультет</div>
        {faculty
          ? <div className="kk-wiz-review-row">
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: faculty.color, flexShrink: 0 }} />
              <strong>{faculty.name}</strong>
            </div>
          : <span className="kk-text-dim">Не выбран</span>
        }
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
