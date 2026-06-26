const GENDER_OPTIONS = [
  { value: "m",  label: "М" },
  { value: "f",  label: "Ж" },
  { value: "nb", label: "Нонбинари" },
];

export default function StepIdentity({ data, onChange }) {
  return (
    <div className="kk-block">
      <h2 className="kk-h2">Личность</h2>
      <div className="kk-wiz-field">
        <label className="kk-wiz-label">Имя *</label>
        <input
          className="kk-input"
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Имя персонажа"
        />
      </div>
      <div className="kk-wiz-field">
        <label className="kk-wiz-label">URL портрета</label>
        <input
          className="kk-input"
          value={data.portrait}
          onChange={e => onChange({ portrait: e.target.value })}
          placeholder="https://…"
        />
      </div>
      <div className="kk-wiz-row">
        <div className="kk-wiz-field">
          <label className="kk-wiz-label">Возраст</label>
          <input
            className="kk-input"
            type="number"
            value={data.age}
            onChange={e => onChange({ age: Number(e.target.value) || 15 })}
            min={14} max={30}
          />
        </div>
        <div className="kk-wiz-field">
          <label className="kk-wiz-label">Пол</label>
          <div className="kk-wiz-gender-group">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`kk-wiz-gender-btn${data.gender === opt.value ? " selected" : ""}`}
                onClick={() => onChange({ gender: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="kk-wiz-field">
        <label className="kk-wiz-label">Место рождения</label>
        <input
          className="kk-input"
          value={data.birthplace}
          onChange={e => onChange({ birthplace: e.target.value })}
          placeholder="—"
        />
      </div>
      <div className="kk-wiz-field">
        <label className="kk-wiz-label">Рост</label>
        <input
          className="kk-input"
          value={data.height}
          onChange={e => onChange({ height: e.target.value })}
          placeholder="—"
        />
      </div>
      <p className="kk-note" style={{ marginTop: 4 }}>
        Данные биографии можно изменить позже в карточке персонажа.
      </p>
    </div>
  );
}
