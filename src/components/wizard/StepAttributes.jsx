import { DIE_SCALE } from "../../lib/advancement";

const ATTR_LABELS = {
  agility:   "Ловкость",
  smarts:    "Хитрость",
  spirit:    "Дух",
  endurance: "Выносливость",
  magic:     "Магия",
};
const ATTRS = ["agility", "smarts", "spirit", "endurance", "magic"];

export default function StepAttributes({ attrDice, onChange, budget, maxDie }) {
  const maxDieIdx = DIE_SCALE.indexOf(maxDie) < 0 ? DIE_SCALE.indexOf(12) : DIE_SCALE.indexOf(maxDie);
  const spent = ATTRS.reduce((sum, a) => sum + DIE_SCALE.indexOf(attrDice[a]), 0);
  const remaining = budget - spent;

  function bump(attr, dir) {
    const cur = DIE_SCALE.indexOf(attrDice[attr]);
    const next = cur + dir;
    if (next < 0 || next > maxDieIdx) return;
    if (dir > 0 && remaining <= 0) return;
    onChange({ ...attrDice, [attr]: DIE_SCALE[next] });
  }

  return (
    <div className="kk-block">
      <h2 className="kk-h2">
        Атрибуты
        <span className="kk-count">очков: {remaining} / {budget}</span>
      </h2>
      <p className="kk-wiz-hint">Распределите {budget} очков. Каждое очко повышает кубик атрибута на один шаг (d4→d6→d8→…).</p>
      {ATTRS.map(attr => {
        const dieIdx = DIE_SCALE.indexOf(attrDice[attr]);
        return (
          <div key={attr} className="kk-wiz-attr-row">
            <span className="kk-wiz-attr-name">{ATTR_LABELS[attr]}</span>
            <div className="kk-wiz-attr-ctrl">
              <button
                className="kk-wiz-die-btn"
                onClick={() => bump(attr, -1)}
                disabled={dieIdx <= 0}
              >−</button>
              <span className="kk-wiz-die-val">d{attrDice[attr]}</span>
              <button
                className="kk-wiz-die-btn"
                onClick={() => bump(attr, 1)}
                disabled={dieIdx >= maxDieIdx || remaining <= 0}
              >+</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
