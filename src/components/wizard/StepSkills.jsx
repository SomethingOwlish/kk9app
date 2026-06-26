import { DIE_SCALE } from "../../lib/advancement";

export default function StepSkills({ skills, skillRaises, onChange, budget, maxDie }) {
  const maxDieIdx = DIE_SCALE.indexOf(maxDie) < 0 ? DIE_SCALE.indexOf(12) : DIE_SCALE.indexOf(maxDie);

  const spent = Object.values(skillRaises).reduce(
    (sum, die) => sum + DIE_SCALE.indexOf(die), 0
  );
  const remaining = budget - spent;

  function bump(skill, dir) {
    const baseDieIdx = DIE_SCALE.indexOf(skill.die);
    const curRaisedDie = skillRaises[skill.name] ?? skill.die;
    const curIdx = DIE_SCALE.indexOf(curRaisedDie);
    const nextIdx = curIdx + dir;
    if (nextIdx < baseDieIdx || nextIdx > maxDieIdx) return;
    if (dir > 0 && remaining <= 0) return;
    const nextDie = DIE_SCALE[nextIdx];
    if (nextDie === skill.die) {
      const { [skill.name]: _, ...rest } = skillRaises;
      onChange(rest);
    } else {
      onChange({ ...skillRaises, [skill.name]: nextDie });
    }
  }

  return (
    <div className="kk-block">
      <h2 className="kk-h2">
        Навыки
        <span className="kk-count">очков: {remaining} / {budget}</span>
      </h2>
      <p className="kk-wiz-hint">
        Потратьте {budget} очков на прокачку навыков. Каждое очко — один шаг кубика.
        Нетренированные навыки (d4−2) можно поднять до d{maxDie}.
      </p>
      <div className="kk-wiz-skills-list">
        {skills.map(skill => {
          const curDie = skillRaises[skill.name] ?? skill.die;
          const curIdx = DIE_SCALE.indexOf(curDie);
          const baseDieIdx = DIE_SCALE.indexOf(skill.die);
          const isRaised = curDie > skill.die;
          return (
            <div key={skill.name} className={`kk-wiz-skill-row${isRaised ? " raised" : ""}`}>
              <span className="kk-wiz-skill-name">{skill.name}</span>
              <div className="kk-wiz-attr-ctrl">
                <button
                  className="kk-wiz-die-btn"
                  onClick={() => bump(skill, -1)}
                  disabled={curIdx <= baseDieIdx}
                >−</button>
                <span className="kk-wiz-die-val">
                  d{curDie}
                  {skill.modifier !== 0 && (
                    <span className="kk-text-dim">{skill.modifier > 0 ? "+" : ""}{skill.modifier}</span>
                  )}
                </span>
                <button
                  className="kk-wiz-die-btn"
                  onClick={() => bump(skill, 1)}
                  disabled={curIdx >= maxDieIdx || remaining <= 0}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
