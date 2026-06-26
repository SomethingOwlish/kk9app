import { useState } from "react";
import { advSettings, DEFAULT_ADVANCEMENT } from "../lib/advancement";

function SettingsField({ label, value, onChange, step }) {
  return (
    <label className="kk-field"><span>{label}</span>
      <input className="kk-input sm" type="number" step={step || 1} value={value} onChange={onChange}/>
    </label>
  );
}

export default function CampaignSettings({ campaign, onSave, onClose }) {
  const [d, setD] = useState(() => advSettings(campaign));
  const setIn = (g, k, v) => setD(p => ({ ...p, [g]: { ...p[g], [k]: v } }));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const field = (label, g, k, step) => (
    <SettingsField label={label} value={d[g][k]} step={step} onChange={e => setIn(g, k, num(e.target.value))}/>
  );

  return (
    <div className="kk-edit">
      <div className="kk-edit-bar">
        <span className="kk-edit-title">Настройки кампании · прокачка</span>
        <div className="kk-edit-actions">
          <button className="kk-btn ghost" onClick={onClose}>Закрыть</button>
          <button className="kk-btn primary" onClick={() => onSave({ advancement: d })}>Сохранить</button>
        </div>
      </div>
      <section className="kk-block">
        <h2 className="kk-h2">Атрибуты</h2>
        <p className="kk-note">Кубик: цена шага = база × № шага от d4. Мод: база × новый мод. Потолок мода на d20 — отдельно.</p>
        <div className="kk-form-grid">
          {field("База кубика", "attr", "dieCostBase")}
          {field("База мода", "attr", "modCostBase")}
          {field("Снятие штрафа", "attr", "negModCost")}
          {field("Потолок мода d20 (+N)", "attr", "d20ModCap")}
        </div>
      </section>
      <section className="kk-block">
        <h2 className="kk-h2">Навыки</h2>
        <p className="kk-note">Кубик: база × (№ шага +1). Мод: база × (2 × новый мод). Всё ×множитель категории.</p>
        <div className="kk-form-grid">
          {field("База кубика", "abil", "dieCostBase")}
          {field("База мода", "abil", "modCostBase")}
          {field("Снятие −1", "abil", "negModCost")}
        </div>
      </section>
      <section className="kk-block">
        <h2 className="kk-h2">Множители по группам навыков</h2>
        <div className="kk-form-grid">
          {field("Общие", "catMult", "common", 0.1)}
          {field("Изученные", "catMult", "learned", 0.1)}
          {field("Магические", "catMult", "magic", 0.1)}
          {field("Личные", "catMult", "personal", 0.1)}
        </div>
      </section>
      <div className="kk-edit-foot">
        <button className="kk-btn ghost" onClick={() => setD(structuredClone(DEFAULT_ADVANCEMENT))}>Сбросить к дефолтам</button>
        <button className="kk-btn primary" onClick={() => onSave({ advancement: d })}>Сохранить</button>
      </div>
    </div>
  );
}
