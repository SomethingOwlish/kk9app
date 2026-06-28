import { useState, useCallback } from "react";
import WeaponItem from "./items/WeaponItem";
import GearItem from "./items/GearItem";
import ArtifactItem from "./items/ArtifactItem";
import SpellItem from "./items/SpellItem";
import DeviceItem from "./items/DeviceItem";
import VehicleItem from "./items/VehicleItem";

const CONDITIONS = ["perfect", "good", "worn", "broken"];
const COND_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
const DAMAGE_LEVELS = ["light", "heavy", "lethal"];
const DMG_LABEL = { light: "Лёгкий", heavy: "Тяжёлый", lethal: "Летальный" };
const DAMAGE_TYPES = ["physical", "mental"];
const DMGTYPE_LABEL = { physical: "Физический", mental: "Ментальный" };
const GEAR_TYPES = ["attack", "defense", "utility"];
const GEAR_LABEL = { attack: "Атака", defense: "Защита", utility: "Утилита" };
const ARTIFACT_TYPES = ["attack", "defense", "binding", "spatial", "utility", "buff", "transforming", "prophetic", "ring"];
const ARTIFACT_LABEL = {
  attack: "Атакующий", defense: "Защитный", binding: "Сковывающий", spatial: "Пространственный",
  utility: "Утилитарный", buff: "Усиливающий", transforming: "Трансформирующий",
  prophetic: "Пророческий", ring: "Кольцо",
};
const SPELL_TYPES = ["attack", "defense", "buff", "health_buff", "binding", "spatial", "transforming", "prophetic", "utility"];
const SPELL_LABEL = {
  attack: "Атака", defense: "Защита", buff: "Усиление", health_buff: "Здоровье",
  binding: "Сковывание", spatial: "Пространство", transforming: "Трансформация",
  prophetic: "Прорицание", utility: "Утилита",
};

const EMPTY_WEAPON = {
  name: "", description: "", condition: "perfect",
  skillName: "", damageLevel: "light", damageType: "physical",
  range: 0, size: "medium", ap: 0, rof: 1, attackModifier: 0,
  conditionChance: 0, hasStatus: false, statusName: "",
};
const EMPTY_GEAR = {
  name: "", description: "", condition: "perfect", gearType: "utility",
  quantity: 1, energyRestore: 0, soakType: "none",
  soakAbsoluteCapacity: 0, soakAbsoluteCurrent: 0,
  soakBonusDie: 0, soakBonusModifier: 0, healthBufferPip: 0,
};
const EMPTY_ARTIFACT = {
  name: "", description: "", condition: "perfect",
  artifactType: "ring", rarity: "common",
  ringMaterial: "", ringStone: "",
  activationCondition: "", active: false,
  bonuses: {}, skillBonuses: [], energyRestore: 0,
};
const EMPTY_SPELL = {
  name: "", description: "", spellType: "utility",
  cost: 1, range: 0, duration: 0, durationHours: 0,
  uses: 1, upkeepCost: 0, skillName: "", folder: "", noWandNeeded: false,
  isAoe: false, active: false, hasStatus: false, statusName: "",
};
const EMPTY_DEVICE = {
  name: "", description: "", condition: "perfect",
  deviceType: "", charges: 0, bonusSkillName: "", bonusValue: 0,
};
const EMPTY_VEHICLE = { name: "", description: "", speed: 0, toughness: 0, capacity: 0 };
const EMPTY_BY_TYPE = {
  weapon: EMPTY_WEAPON, gear: EMPTY_GEAR, artifact: EMPTY_ARTIFACT,
  spell: EMPTY_SPELL, device: EMPTY_DEVICE, vehicle: EMPTY_VEHICLE,
};

const SECTION_LABELS = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакты",
  spell: "Заклинания", device: "Устройства", vehicle: "Транспорт",
};

// Language and feature are embedded in the character doc, not in the items collection.
const ITEM_TYPES = Object.keys(SECTION_LABELS);

export default function ItemList({ items = [], isGM, onCreate, onDelete, onUpdateItem, campaignStatuses = [], character }) {
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState("weapon");
  const [form, setForm] = useState(EMPTY_WEAPON);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const byType = {};
  for (const t of ITEM_TYPES) byType[t] = items.filter(i => i.type === t);

  const activeSpellsMap = {};
  if (character?.activeSpells) {
    for (const as of character.activeSpells) activeSpellsMap[as.itemId] = as;
  }

  function startAdd() { setAdding(true); setType("weapon"); setForm(EMPTY_WEAPON); }

  function handleTypeChange(t) {
    setType(t);
    setForm(EMPTY_BY_TYPE[t] || {});
  }

  function setF(k, v) { setForm(prev => ({ ...prev, [k]: v })); }
  const setE = useCallback((k, v) => setEditData(prev => ({ ...prev, [k]: v })), []);

  function startEdit(item) { setEditingId(item.id); setEditData({ ...item }); }

  async function handleSaveEdit() {
    if (!editData.name?.trim()) return;
    setEditSaving(true);
    try {
      const { id: _id, createdAt: _ca, ...fields } = editData;
      await onUpdateItem(editingId, fields);
      setEditingId(null);
      setEditData({});
    } catch (err) {
      alert("Ошибка: " + err.message);
    } finally {
      setEditSaving(false);
    }
  }

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

      {ITEM_TYPES.map(t => {
        const group = byType[t];
        if (group.length === 0) return null;

        const renderOne = (item) => {
          if (editingId === item.id) {
            return (
              <ItemEditForm key={item.id} item={item} data={editData} setData={setE}
                onSave={handleSaveEdit} onCancel={() => setEditingId(null)}
                saving={editSaving} campaignStatuses={campaignStatuses} />
            );
          }
          const del = isGM ? () => onDelete(item.id) : undefined;
          let component;
          if (t === "weapon") component = <WeaponItem item={item} isGM={isGM} onDelete={del} />;
          else if (t === "gear") component = <GearItem item={item} isGM={isGM} onDelete={del} />;
          else if (t === "artifact") component = <ArtifactItem item={item} isGM={isGM} onDelete={del} />;
          else if (t === "spell") component = <SpellItem item={item} activeSpell={activeSpellsMap[item.id]} isGM={isGM} onDelete={del} />;
          else if (t === "device") component = <DeviceItem item={item} isGM={isGM} onDelete={del}
            onUpdateCharges={onUpdateItem ? (charges) => onUpdateItem(item.id, { charges }) : undefined} />;
          else if (t === "vehicle") component = <VehicleItem item={item} isGM={isGM} onDelete={del} />;
          else return null;
          return (
            <div key={item.id} className="kk-item-with-edit">
              {component}
              {isGM && <button className="kk-item-edit-btn" onClick={() => startEdit(item)} title="Редактировать">✎</button>}
            </div>
          );
        };

        if (t === "spell") {
          const folders = {};
          const folderOrder = [];
          for (const item of group) {
            const key = item.folder || item.skillName || "Без навыка";
            if (!folders[key]) { folders[key] = []; folderOrder.push(key); }
            folders[key].push(item);
          }
          return (
            <div key={t} className="kk-items-group">
              <div className="kk-items-group-label">{SECTION_LABELS[t]}</div>
              {folderOrder.map(folder => (
                <div key={folder} className="kk-spell-folder">
                  <div className="kk-spell-folder-label">{folder}</div>
                  {folders[folder].map(item => renderOne(item))}
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={t} className="kk-items-group">
            <div className="kk-items-group-label">{SECTION_LABELS[t]}</div>
            {group.map(item => renderOne(item))}
          </div>
        );
      })}

      {isGM && !adding && (
        <button className="kk-note-btn kk-items-add-btn" onClick={startAdd}>+ Добавить предмет</button>
      )}

      {isGM && adding && (
        <form className="kk-item-form" onSubmit={handleSubmit}>
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Тип:</label>
            <select className="kk-item-select" value={type} onChange={e => handleTypeChange(e.target.value)}>
              {ITEM_TYPES.map(t => <option key={t} value={t}>{SECTION_LABELS[t]}</option>)}
            </select>
          </div>

          <input
            className="kk-note-input"
            placeholder="Название *"
            value={form.name || ""}
            onChange={e => setF("name", e.target.value)}
            required
            maxLength={100}
          />
          {type !== "language" && (
            <textarea
              className="kk-note-input kk-note-body-input"
              placeholder="Описание"
              value={form.description || ""}
              onChange={e => setF("description", e.target.value)}
              rows={2}
              maxLength={600}
            />
          )}

          {/* Weapon fields */}
          {type === "weapon" && (
            <>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Состояние:</label>
                <select className="kk-item-select" value={form.condition} onChange={e => setF("condition", e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{COND_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Уровень урона:</label>
                <select className="kk-item-select" value={form.damageLevel} onChange={e => setF("damageLevel", e.target.value)}>
                  {DAMAGE_LEVELS.map(l => <option key={l} value={l}>{DMG_LABEL[l]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Тип урона:</label>
                <select className="kk-item-select" value={form.damageType} onChange={e => setF("damageType", e.target.value)}>
                  {DAMAGE_TYPES.map(d => <option key={d} value={d}>{DMGTYPE_LABEL[d]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Навык:</label>
                <input className="kk-item-select" placeholder="Рукопашный бой" value={form.skillName} onChange={e => setF("skillName", e.target.value)} maxLength={60} />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Дальность (м):</label>
                <input type="number" className="kk-item-num" value={form.range} onChange={e => setF("range", Number(e.target.value))} min={0} />
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>БП:</label>
                <input type="number" className="kk-item-num" value={form.ap} onChange={e => setF("ap", Number(e.target.value))} min={0} />
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>СКО:</label>
                <input type="number" className="kk-item-num" value={form.rof} onChange={e => setF("rof", Number(e.target.value))} min={1} />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Мод атаки:</label>
                <input type="number" className="kk-item-num" value={form.attackModifier} onChange={e => setF("attackModifier", Number(e.target.value))} />
              </div>
              {campaignStatuses.length > 0 && (
                <div className="kk-item-form-row">
                  <label className="kk-item-form-label">Статус при попадании:</label>
                  <select
                    className="kk-item-select"
                    value={form.statusName || ""}
                    onChange={e => { setF("hasStatus", !!e.target.value); setF("statusName", e.target.value); }}
                  >
                    <option value="">— нет —</option>
                    {campaignStatuses.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Gear fields */}
          {type === "gear" && (
            <>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Состояние:</label>
                <select className="kk-item-select" value={form.condition} onChange={e => setF("condition", e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{COND_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Подтип:</label>
                <select className="kk-item-select" value={form.gearType} onChange={e => setF("gearType", e.target.value)}>
                  {GEAR_TYPES.map(g => <option key={g} value={g}>{GEAR_LABEL[g]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Кол-во:</label>
                <input type="number" className="kk-item-num" value={form.quantity} onChange={e => setF("quantity", Number(e.target.value))} min={1} />
              </div>
            </>
          )}

          {/* Artifact fields */}
          {type === "artifact" && (
            <>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Состояние:</label>
                <select className="kk-item-select" value={form.condition} onChange={e => setF("condition", e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{COND_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Тип артефакта:</label>
                <select className="kk-item-select" value={form.artifactType} onChange={e => setF("artifactType", e.target.value)}>
                  {ARTIFACT_TYPES.map(t => <option key={t} value={t}>{ARTIFACT_LABEL[t]}</option>)}
                </select>
              </div>
              {form.artifactType === "ring" && (
                <>
                  <div className="kk-item-form-row">
                    <label className="kk-item-form-label">Материал кольца:</label>
                    <input className="kk-item-select" value={form.ringMaterial} onChange={e => setF("ringMaterial", e.target.value)} maxLength={60} />
                  </div>
                  <div className="kk-item-form-row">
                    <label className="kk-item-form-label">Камень:</label>
                    <input className="kk-item-select" value={form.ringStone} onChange={e => setF("ringStone", e.target.value)} maxLength={60} />
                  </div>
                </>
              )}
            </>
          )}

          {/* Spell fields */}
          {type === "spell" && (
            <>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Тип заклинания:</label>
                <select className="kk-item-select" value={form.spellType} onChange={e => setF("spellType", e.target.value)}>
                  {SPELL_TYPES.map(t => <option key={t} value={t}>{SPELL_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Навык:</label>
                <input className="kk-item-select" value={form.skillName} onChange={e => setF("skillName", e.target.value)} maxLength={60} />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Папка:</label>
                <input className="kk-item-select" value={form.folder || ""} onChange={e => setF("folder", e.target.value)} maxLength={60} placeholder="(по умолчанию: навык)" />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Стоимость:</label>
                <input type="number" className="kk-item-num" value={form.cost} onChange={e => setF("cost", Number(e.target.value))} min={0} />
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>Поддержание:</label>
                <input type="number" className="kk-item-num" value={form.upkeepCost} onChange={e => setF("upkeepCost", Number(e.target.value))} min={0} />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Использований:</label>
                <input type="number" className="kk-item-num" value={form.uses} onChange={e => setF("uses", Number(e.target.value))} min={1} />
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>Дальность (м):</label>
                <input type="number" className="kk-item-num" value={form.range} onChange={e => setF("range", Number(e.target.value))} min={0} />
              </div>
            </>
          )}

          {/* Device fields */}
          {type === "device" && (
            <>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Состояние:</label>
                <select className="kk-item-select" value={form.condition} onChange={e => setF("condition", e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{COND_LABEL[c]}</option>)}
                </select>
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Тип устройства:</label>
                <input className="kk-item-select" value={form.deviceType} onChange={e => setF("deviceType", e.target.value)} maxLength={60} />
              </div>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Заряды:</label>
                <input type="number" className="kk-item-num" value={form.charges} onChange={e => setF("charges", Number(e.target.value))} min={0} />
              </div>
            </>
          )}

          {/* Vehicle fields */}
          {type === "vehicle" && (
            <>
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Скорость:</label>
                <input type="number" className="kk-item-num" value={form.speed} onChange={e => setF("speed", Number(e.target.value))} min={0} />
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>Стойкость:</label>
                <input type="number" className="kk-item-num" value={form.toughness} onChange={e => setF("toughness", Number(e.target.value))} min={0} />
                <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>Вместимость:</label>
                <input type="number" className="kk-item-num" value={form.capacity} onChange={e => setF("capacity", Number(e.target.value))} min={0} />
              </div>
            </>
          )}

          <div className="kk-item-form-actions">
            <button type="submit" className="kk-note-btn" disabled={saving || !form.name?.trim()}>
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

function ItemEditForm({ item, data, setData, onSave, onCancel, saving, campaignStatuses = [] }) {
  const t = item.type;
  const s = (k) => (e) => setData(k, e.target.value);
  const n = (k) => (e) => setData(k, Number(e.target.value));
  return (
    <div className="kk-item-edit-form">
      <input className="kk-note-input" placeholder="Название *" value={data.name || ""} onChange={s("name")} maxLength={100} />
      <textarea className="kk-note-input kk-note-body-input" placeholder="Описание" value={data.description || ""} onChange={s("description")} rows={2} maxLength={600} />

      {(t === "weapon" || t === "gear" || t === "artifact" || t === "device") && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Состояние:</label>
          <select className="kk-item-select" value={data.condition || "good"} onChange={s("condition")}>
            {CONDITIONS.map(c => <option key={c} value={c}>{COND_LABEL[c]}</option>)}
          </select>
        </div>
      )}

      {t === "weapon" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Уровень урона:</label>
          <select className="kk-item-select" value={data.damageLevel || "light"} onChange={s("damageLevel")}>
            {DAMAGE_LEVELS.map(l => <option key={l} value={l}>{DMG_LABEL[l]}</option>)}
          </select>
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Тип:</label>
          <select className="kk-item-select" value={data.damageType || "physical"} onChange={s("damageType")}>
            {DAMAGE_TYPES.map(d => <option key={d} value={d}>{DMGTYPE_LABEL[d]}</option>)}
          </select>
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Навык:</label>
          <input className="kk-item-select" value={data.skillName || ""} onChange={s("skillName")} maxLength={60} />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Дальн.:</label>
          <input type="number" className="kk-item-num" value={data.range ?? 0} onChange={n("range")} min={0} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>БП:</label>
          <input type="number" className="kk-item-num" value={data.ap ?? 0} onChange={n("ap")} min={0} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>СКО:</label>
          <input type="number" className="kk-item-num" value={data.rof ?? 1} onChange={n("rof")} min={1} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Мод:</label>
          <input type="number" className="kk-item-num" value={data.attackModifier ?? 0} onChange={n("attackModifier")} />
        </div>
        {campaignStatuses.length > 0 && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Статус при попадании:</label>
            <select className="kk-item-select" value={data.statusName || ""} onChange={e => { setData("hasStatus", !!e.target.value); setData("statusName", e.target.value); }}>
              <option value="">— нет —</option>
              {campaignStatuses.map(st => <option key={st.id} value={st.name}>{st.name}</option>)}
            </select>
          </div>
        )}
      </>)}

      {t === "gear" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Подтип:</label>
          <select className="kk-item-select" value={data.gearType || "utility"} onChange={s("gearType")}>
            {GEAR_TYPES.map(g => <option key={g} value={g}>{GEAR_LABEL[g]}</option>)}
          </select>
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Кол-во:</label>
          <input type="number" className="kk-item-num" value={data.quantity ?? 1} onChange={n("quantity")} min={1} />
        </div>
      </>)}

      {t === "artifact" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип артефакта:</label>
          <select className="kk-item-select" value={data.artifactType || "ring"} onChange={s("artifactType")}>
            {ARTIFACT_TYPES.map(at => <option key={at} value={at}>{ARTIFACT_LABEL[at]}</option>)}
          </select>
        </div>
        {data.artifactType === "ring" && (<>
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Материал:</label>
            <input className="kk-item-select" value={data.ringMaterial || ""} onChange={s("ringMaterial")} maxLength={60} />
            <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Камень:</label>
            <input className="kk-item-select" value={data.ringStone || ""} onChange={s("ringStone")} maxLength={60} />
          </div>
        </>)}
      </>)}

      {t === "spell" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип:</label>
          <select className="kk-item-select" value={data.spellType || "utility"} onChange={s("spellType")}>
            {SPELL_TYPES.map(st => <option key={st} value={st}>{SPELL_LABEL[st]}</option>)}
          </select>
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Навык:</label>
          <input className="kk-item-select" value={data.skillName || ""} onChange={s("skillName")} maxLength={60} />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Папка:</label>
          <input className="kk-item-select" value={data.folder || ""} onChange={s("folder")} maxLength={60} placeholder="(по умолчанию: навык)" />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Стоимость:</label>
          <input type="number" className="kk-item-num" value={data.cost ?? 1} onChange={n("cost")} min={0} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Поддерж.:</label>
          <input type="number" className="kk-item-num" value={data.upkeepCost ?? 0} onChange={n("upkeepCost")} min={0} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Исп.:</label>
          <input type="number" className="kk-item-num" value={data.uses ?? 1} onChange={n("uses")} min={1} />
        </div>
      </>)}

      {t === "device" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип устройства:</label>
          <input className="kk-item-select" value={data.deviceType || ""} onChange={s("deviceType")} maxLength={60} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Заряды:</label>
          <input type="number" className="kk-item-num" value={data.charges ?? 0} onChange={n("charges")} min={0} />
        </div>
      </>)}

      {t === "vehicle" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Скорость:</label>
          <input type="number" className="kk-item-num" value={data.speed ?? 0} onChange={n("speed")} min={0} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Стойкость:</label>
          <input type="number" className="kk-item-num" value={data.toughness ?? 0} onChange={n("toughness")} min={0} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Вместим.:</label>
          <input type="number" className="kk-item-num" value={data.capacity ?? 0} onChange={n("capacity")} min={0} />
        </div>
      )}

      <div className="kk-item-form-actions">
        <button className="kk-note-btn" onClick={onSave} disabled={saving || !data.name?.trim()}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button className="kk-note-btn kk-item-cancel-btn" onClick={onCancel}>Отмена</button>
      </div>
    </div>
  );
}
