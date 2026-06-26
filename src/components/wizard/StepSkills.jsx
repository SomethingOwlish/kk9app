import { DIE_SCALE } from "../../lib/advancement";
import { nextUpCost, skillPointsSpent } from "../../lib/chargen";

const ATTR_SHORT = {
  agility: "Ловк", smarts: "Смек", spirit: "Дух",
  endurance: "Выносл", magic: "Маг",
};

export default function StepSkills({
  skills, skillRaises, onChange,
  budget, maxDie, attrDice,
  specCount, onSpecCount, specCost, specMax,
}) {
  const maxDieIdx = DIE_SCALE.indexOf(maxDie) < 0 ? DIE_SCALE.indexOf(8) : DIE_SCALE.indexOf(maxDie);

  const totalSkillSpent = skills.reduce((sum, s) => {
    const raise = skillRaises[s.name];
    if (!raise) return sum;
    return sum + skillPointsSpent(s.die, s.modifier, raise.die, raise.modifier);
  }, 0);
  const specTotalCost = specCount * specCost;
  const remaining = budget - totalSkillSpent - specTotalCost;

  function bumpUp(skill) {
    const raise = skillRaises[skill.name] || { die: skill.die, modifier: skill.modifier };
    const cost = nextUpCost(raise.die, raise.modifier);
    if (remaining < cost) return;
    const attrDie = attrDice?.[skill.attr];
    let next;
    if (raise.modifier < 0) {
      next = { die: raise.die, modifier: 0 };
    } else {
      const curIdx = DIE_SCALE.indexOf(raise.die);
      const nextIdx = curIdx + 1;
      if (nextIdx > maxDieIdx) return;
      if (attrDie && DIE_SCALE[nextIdx] > attrDie) return;
      next = { die: DIE_SCALE[nextIdx], modifier: 0 };
    }
    onChange({ ...skillRaises, [skill.name]: next });
  }

  function bumpDown(skill) {
    const raise = skillRaises[skill.name];
    if (!raise) return;
    let next;
    if (raise.die > skill.die) {
      const curIdx = DIE_SCALE.indexOf(raise.die);
      next = { die: DIE_SCALE[curIdx - 1], modifier: raise.modifier };
    } else if (raise.modifier > skill.modifier) {
      next = { die: raise.die, modifier: skill.modifier };
    } else {
      const rest = { ...skillRaises };
      delete rest[skill.name];
      onChange(rest);
      return;
    }
    if (next.die === skill.die && next.modifier === skill.modifier) {
      const rest = { ...skillRaises };
      delete rest[skill.name];
      onChange(rest);
    } else {
      onChange({ ...skillRaises, [skill.name]: next });
    }
  }

  function canBumpUp(skill) {
    const raise = skillRaises[skill.name] || { die: skill.die, modifier: skill.modifier };
    const cost = nextUpCost(raise.die, raise.modifier);
    if (remaining < cost) return false;
    if (raise.modifier < 0) return true;
    const curIdx = DIE_SCALE.indexOf(raise.die);
    if (curIdx >= maxDieIdx) return false;
    const attrDie = attrDice?.[skill.attr];
    if (attrDie && DIE_SCALE[curIdx + 1] > attrDie) return false;
    return true;
  }

  function canBumpDown(skill) {
    const raise = skillRaises[skill.name];
    if (!raise) return false;
    return raise.die > skill.die || raise.modifier > skill.modifier;
  }

  return (
    <div className="kk-block">
      <h2 className="kk-h2">
        Навыки
        <span className="kk-count">очков: {remaining} / {budget}</span>
      </h2>
      <p className="kk-wiz-hint">
        Поднять мод −2→0: 1 очко. d4→d6: 1 очко. d6→d8 и выше: 2 очка за шаг.
        Навык не может превышать привязанный атрибут.
      </p>
      <div className="kk-wiz-skills-list">
        {skills.map(skill => {
          const raise = skillRaises[skill.name];
          const curDie = raise?.die ?? skill.die;
          const curMod = raise?.modifier ?? skill.modifier;
          const isRaised = curDie > skill.die || curMod > skill.modifier;
          const attrDie = attrDice?.[skill.attr];
          return (
            <div key={skill.name} className={`kk-wiz-skill-row${isRaised ? " raised" : ""}`}>
              <span className="kk-wiz-skill-name">
                {skill.name}
                {skill.attr && (
                  <span className="kk-wiz-skill-attr">{ATTR_SHORT[skill.attr] || skill.attr}</span>
                )}
                {attrDie && (
                  <span className="kk-wiz-skill-cap">≤d{attrDie}</span>
                )}
              </span>
              <div className="kk-wiz-attr-ctrl">
                <button
                  className="kk-wiz-die-btn"
                  onClick={() => bumpDown(skill)}
                  disabled={!canBumpDown(skill)}
                >−</button>
                <span className="kk-wiz-die-val">
                  d{curDie}
                  {curMod !== 0 && (
                    <span className="kk-text-dim">{curMod > 0 ? "+" : ""}{curMod}</span>
                  )}
                </span>
                <button
                  className="kk-wiz-die-btn"
                  onClick={() => bumpUp(skill)}
                  disabled={!canBumpUp(skill)}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>

      {specMax > 0 && (
        <div className="kk-wiz-spec-block">
          <div className="kk-h2" style={{ marginTop: 14 }}>
            Спецспособность
            <span className="kk-count">{specCount} / {specMax}</span>
          </div>
          <p className="kk-wiz-hint">
            Запрос спецспособности стоит {specCost} очков. ГМ назначит её после создания.
          </p>
          <div className="kk-wiz-attr-ctrl" style={{ marginTop: 8 }}>
            <button
              className="kk-wiz-die-btn"
              onClick={() => onSpecCount(Math.max(0, specCount - 1))}
              disabled={specCount === 0}
            >−</button>
            <span className="kk-wiz-die-val">{specCount}</span>
            <button
              className="kk-wiz-die-btn"
              onClick={() => onSpecCount(Math.min(specMax, specCount + 1))}
              disabled={specCount >= specMax || remaining < specCost}
            >+</button>
          </div>
        </div>
      )}
    </div>
  );
}
