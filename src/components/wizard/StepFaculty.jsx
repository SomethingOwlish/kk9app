import { FACULTIES } from "../../lib/seed-faculties";

export default function StepFaculty({ chosen, onChoose }) {
  return (
    <div className="kk-block">
      <h2 className="kk-h2">Факультет</h2>
      <p className="kk-wiz-hint">Выберите факультет — он определяет характерные навыки персонажа.</p>
      <div className="kk-wiz-fac-grid">
        {FACULTIES.map(fac => (
          <button
            key={fac.key}
            className={`kk-wiz-fac-card${chosen?.key === fac.key ? " selected" : ""}`}
            style={{ "--fac-color": fac.color }}
            onClick={() => onChoose(fac)}
          >
            <span className="kk-wiz-fac-dot" style={{ background: fac.color }} />
            <span className="kk-wiz-fac-name">{fac.name}</span>
            {chosen?.key === fac.key && (
              <span className="kk-wiz-fac-count">{fac.abilities.length} навыков</span>
            )}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="kk-wiz-fac-preview">
          <div className="kk-h2" style={{ marginTop: 12 }}>Навыки {chosen.name}</div>
          <div className="kk-wiz-fac-abilities">
            {chosen.abilities.length === 0
              ? <span className="kk-text-dim">Навыки не назначены</span>
              : chosen.abilities.map(a => <span key={a} className="kk-wiz-ability-tag">{a}</span>)
            }
          </div>
        </div>
      )}
    </div>
  );
}
