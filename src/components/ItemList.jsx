import { useState } from "react";
import WeaponItem from "./items/WeaponItem";
import GearItem from "./items/GearItem";

const CONDITIONS = ["perfect", "good", "worn", "broken"];
const COND_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
const SUBTYPES = ["attack", "defense", "utility"];
const SUBTYPE_LABEL = { attack: "Атака", defense: "Защита", utility: "Утилита" };

const EMPTY_WEAPON = { name: "", description: "", condition: "perfect", die: 6, modifier: 0, attackModifier: 0, damageLevel: "", damageType: "", statusOnHit: null };
const EMPTY_GEAR = { name: "", description: "", condition: "perfect", subtype: "utility" };

export default function ItemList({ items = [], isGM, onCreate, onDelete, campaignStatuses = [] }) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("weapon");
  const [form, setForm] = useState(EMPTY_WEAPON);
  const [saving, setSaving] = useState(false);

  const weapons = items.filter(i => i.type === "weapon");
  const gear = items.filter(i => i.type === "gear");
  const other = items.filter(i => i.type !== "weapon" && i.type !== "gear");

  function startAdd() { setAdding(true); setType("weapon"); setForm(EMPTY_WEAPON); }

  function handleTypeChange(t) {
    setType(t);
    setForm(t === "weapon" ? EMPTY_WEAPON : EMPTY_GEAR);
  }

  function setF(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onCreate({ type, ...form, name: form.name.trim() });
      setAdding(false);
      setForm(EMPTY_WEAPON);
    } catch (err) {
      alert("Ошибка при создании предмета: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="kk-block">
      <h2 className="kk-h2">Предметы</h2>

      {items.length === 0 && !adding && (
        <div className="kk-empty-sm">Нет предметов</div>
      )}

      {weapons.length > 0 && (
        <div className="kk-items-group">
          <div className="kk-items-group-label">Оружие</div>
          {weapons.map(item => (
            <WeaponItem key={item.id} item={item} isGM={isGM} onDelete={() => onDelete(item.id)} />
          ))}
        </div>
      )}

      {gear.length > 0 && (
        <div className="kk-items-group">
          <div className="kk-items-group-label">Снаряжение</div>
          {gear.map(item => (
            <GearItem key={item.id} item={item} isGM={isGM} onDelete={() => onDelete(item.id)} />
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="kk-items-group">
          <div className="kk-items-group-label">Прочее</div>
          {other.map(item => (
            <div key={item.id} className="kk-item">
              <div className="kk-item-header">
                <span className="kk-item-name">{item.name}</span>
                <span className="kk-item-subtype">{item.type}</span>
                {isGM && (
                  <button className="kk-note-del" onClick={() => onDelete(item.id)} title="Удалить">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isGM && !adding && (
        <button className="kk-note-btn kk-items-add-btn" onClick={startAdd}>+ Добавить предмет</button>
      )}

      {isGM && adding && (
        <form className="kk-item-form" onSubmit={handleSubmit}>
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Тип:</label>
            <select className="kk-item-select" value={type} onChange={e => handleTypeChange(e.target.value)}>
              <option value="weapon">Оружие</option>
              <option value="gear">Снаряжение</option>
            </select>
          </div>

          <input
            className="kk-note-input"
            placeholder="Название *"
            value={form.name}
            onChange={e => setF("name", e.target.value)}
            required
            maxLength={100}
          />
          <textarea
            className="kk-note-input kk-note-body-input"
            placeholder="Описание (необязательно)"
            value={form.description}
            onChange={e => setF("description", e.target.value)}
            rows={2}
            maxLength={500}
          />

          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Состояние:</label>
            <select className="kk-item-select" value={form.condition} onChange={e => setF("condition", e.target.value)}>
              {CONDITIONS.map(c => <option key={c} value={c}>{COND_LABEL[c]}</option>)}
            </select>
          </div>

          {type === "weapon" && (
            <>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Урон:</label>
                <select className="kk-item-select" value={form.die} onChange={e => setF("die", Number(e.target.value))}>
                  {[4, 6, 8, 10, 12, 20].map(d => <option key={d} value={d}>d{d}</option>)}
                </select>
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>Мод:</label>
                <input
                  type="number"
                  className="kk-item-num"
                  value={form.modifier}
                  onChange={e => setF("modifier", Number(e.target.value))}
                />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Мод атаки:</label>
                <input
                  type="number"
                  className="kk-item-num"
                  value={form.attackModifier}
                  onChange={e => setF("attackModifier", Number(e.target.value))}
                />
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>Тип урона:</label>
                <input
                  className="kk-item-select"
                  placeholder="физический"
                  value={form.damageType}
                  onChange={e => setF("damageType", e.target.value)}
                  maxLength={40}
                />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Уровень урона:</label>
                <input
                  className="kk-item-select"
                  placeholder="лёгкий"
                  value={form.damageLevel}
                  onChange={e => setF("damageLevel", e.target.value)}
                  maxLength={40}
                />
              </div>
              {campaignStatuses.length > 0 && (
                <div className="kk-item-form-row">
                  <label className="kk-item-form-label">Статус при попадании:</label>
                  <select
                    className="kk-item-select"
                    value={form.statusOnHit?.id || ""}
                    onChange={e => {
                      const s = campaignStatuses.find(st => st.id === e.target.value);
                      setF("statusOnHit", s ? { id: s.id, name: s.name } : null);
                    }}
                  >
                    <option value="">— нет —</option>
                    {campaignStatuses.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {type === "gear" && (
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Подтип:</label>
              <select className="kk-item-select" value={form.subtype} onChange={e => setF("subtype", e.target.value)}>
                {SUBTYPES.map(s => <option key={s} value={s}>{SUBTYPE_LABEL[s]}</option>)}
              </select>
            </div>
          )}

          <div className="kk-item-form-actions">
            <button type="submit" className="kk-note-btn" disabled={saving || !form.name.trim()}>
              {saving ? "Сохранение…" : "Добавить"}
            </button>
            <button type="button" className="kk-note-btn kk-item-cancel-btn" onClick={() => setAdding(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
