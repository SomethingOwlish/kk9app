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
          <input
            className="kk-input"
            value={data.gender}
            onChange={e => onChange({ gender: e.target.value })}
            placeholder="—"
          />
        </div>
      </div>
      <div className="kk-wiz-row">
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
          <label className="kk-wiz-label">Дормиторий</label>
          <input
            className="kk-input"
            value={data.dormitory}
            onChange={e => onChange({ dormitory: e.target.value })}
            placeholder="—"
          />
        </div>
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
    </div>
  );
}
