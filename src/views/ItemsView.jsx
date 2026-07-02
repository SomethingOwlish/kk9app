import { useState, useMemo } from "react";
import SearchableSelect from "../components/SearchableSelect";
import { SKILLS_DATA } from "../lib/seed-skills";
import { ATTR_SHORT, ATTR_ORDER, ATTR_LABEL } from "../lib/constants";

// Artifact: single owner (ownerCharacterId on item doc).
// All others (weapon/gear/spell/device/vehicle): copy-per-character (catalog shows templates only).
// Language: character.languages[] embedded array.
const COPY_TYPES = ["weapon", "gear", "spell", "device", "vehicle"];
const LANG_TYPE  = "language";

const TYPE_LABELS = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакты",
  spell: "Заклинания", device: "Устройства", vehicle: "Транспорт",
  language: "Языки",
};
const ALL_CATALOG_TYPES = [...COPY_TYPES, "artifact", LANG_TYPE];

// ── Enumerations (mirror the Foundry .hbs templates) ──────────
const CONDITION = [["perfect","Идеальное"],["good","Нормальное"],["worn","Плохое"],["broken","Сломано"]];
const EQUIPPED  = [["home","Дома"],["carried","С собой"],["equipped","Экипирован"]];
const SIZE      = [["finger","Пальцевый"],["pocket","Карманный"],["small","Малый"],["medium","Средний"],["large","Большой"],["huge","Огромный"],["immovable","Неподвижный"]];
const DMG_LEVEL = [["light","Лёгкий"],["heavy","Тяжёлый"],["lethal","Летальный"]];
const DMG_TYPE  = [["physical","Физический"],["mental","Ментальный"]];
const TRACK     = [["physical","Физическая"],["mental","Ментальная"]];
const RARITY    = [["common","Обычный"],["uncommon","Необычный"],["rare","Редкий"],["unique","Уникальный"],["ancient","Древний"]];
const ART_TYPE  = [["attack","Атака"],["defense","Защита"],["binding","Связь"],["spatial","Пространственный"],["utility","Утилита"],["buff","Усиление"],["transforming","Трансформация"],["prophetic","Пророческий"],["ring","Кольцо"]];
const ART_CLASS = [["simple","Простой"],["complex","Сложный"]];
const SPELL_TYPE= [["attack","Атака"],["defense","Защита"],["buff","Усиление"],["health_buff","Буфер здоровья"],["binding","Связь"],["spatial","Пространство"],["transforming","Трансформация"],["prophetic","Прорицание"],["utility","Утилита"]];
const DEV_TYPE  = [["gadget","Гаджет"],["weapon","Оружие"],["drone","Дрон"],["computer","Компьютер"],["medical","Медицинское"],["other","Прочее"]];
const VEH_TYPE  = [["ground","Наземный"],["air","Воздушный"],["water","Водный"],["magical","Магический"],["other","Прочий"]];
const WORLD     = [["upper","Верхний мир"],["lower","Нижний мир"],["both","Оба мира"],["mystic","Мистический"]];
const SOAK_GEAR = [["absolute","Абсолютная"],["bonus","Бонус к стойкости"]];
const SOAK_SPELL= [["absolute","Абсолютная"],["status","Статус-защита"]];
const DIE_OPTS  = [["0","—"],["4","d4"],["6","d6"],["8","d8"],["10","d10"],["12","d12"]];

const lblOf = (pairs, v) => (pairs.find(([k]) => k === v)?.[1]) || v;

const DAMAGE_LEVEL_LABEL = Object.fromEntries(DMG_LEVEL);
const ARTIFACT_TYPE_LABEL = Object.fromEntries(ART_TYPE);
const SPELL_TYPE_LABEL = Object.fromEntries(SPELL_TYPE);
const DEVICE_TYPE_LABEL = Object.fromEntries(DEV_TYPE);

function itemSubtitle(item) {
  if (item.type === "weapon")   return `${DAMAGE_LEVEL_LABEL[item.damageLevel] || item.damageLevel || ""} · ${item.skillName || ""}`;
  if (item.type === "gear")     return item.gearType || "";
  if (item.type === "artifact") return `${ARTIFACT_TYPE_LABEL[item.artifactType] || item.artifactType || ""} · ${item.ringMaterial || ""} ${item.ringStone || ""}`.trim();
  if (item.type === "spell")    return `${SPELL_TYPE_LABEL[item.spellType] || item.spellType || ""} · ${item.skillName || ""}`;
  if (item.type === "device")   return DEVICE_TYPE_LABEL[item.deviceType] || item.deviceType || "";
  if (item.type === "vehicle")  return lblOf(VEH_TYPE, item.vehicleType);
  if (item.type === "language") return lblOf(WORLD, item.world);
  return "";
}

// ── Full-schema defaults per type (so every control is controlled) ──
function defaultsFor(type) {
  const D = {
    weapon: { condition:"perfect", equipped:"home", damageLevel:"light", damageType:"physical", range:0, size:"small", ap:0, rof:1, attackModifier:0, conditionChance:0, hasStatus:false, statusName:"" },
    gear: { condition:"perfect", gearType:"utility", size:"small", quantity:1, equipped:"home", energyRestore:0, soakType:"bonus", soakAbsoluteCapacity:0, soakAbsoluteCurrent:0, soakBonusDie:0, soakBonusModifier:0, soakUses:0, healthBufferPip:0, healthBufferTrack:"physical", damageLevel:"light", damageType:"physical", skillName:"", attackModifier:0, conditionChance:0, hasStatus:false, statusName:"" },
    artifact: { condition:"good", artifactType:"ring", artifactClass:"simple", artifactAge:0, rarity:"common", size:"finger", ringMaterial:"", ringStone:"", creator:"", lkArticleUrl:"", activationCondition:"", equipped:"home", energyRestore:0, bonuses:{agility:0,smarts:0,spirit:0,endurance:0,magic:0,toughness:0}, skillBonuses:[], soakType:"bonus", soakAbsoluteCapacity:0, soakAbsoluteCurrent:0, soakBonusDie:0, soakBonusModifier:0, soakBonusUses:0, healthBufferPip:0, healthBufferTrack:"physical", active:false, destroyed:false, damageLevel:"light", damageType:"physical", skillName:"", attackModifier:0, conditionChance:0, hasStatus:false, statusName:"" },
    spell: { spellType:"utility", effectColor:"#a855f7", effectDescription:"", cost:1, range:0, uses:1, durationHours:0, upkeepCost:0, skillName:"", folder:"", noWandNeeded:false, isAoe:false, snakeEyesStatusName:"", active:false, hasStatus:false, statusName:"", bypassSoak:false, unresistable:false, damageType:"physical", soakType:"absolute", soakAbsoluteCapacity:0, soakAbsoluteCurrent:0, toughnessBonus:0, bonuses:{agility:0,smarts:0,spirit:0,endurance:0,magic:0,toughness:0}, skillBonuses:[], healthBufferPip:0, healthBufferTrack:"physical", contestedSkillName:"" },
    device: { condition:"perfect", deviceType:"gadget", charges:0, maxCharges:-1, folder:"", creator:"", equipped:"home", worksUpper:true, worksLower:true, bonusSkillName:"", bonusValue:0, damageLevel:"light", damageType:"physical", range:0, attackSkillName:"", attackModifier:0, conditionChance:0, hasStatus:false, statusName:"", soakBonusDie:0, soakBonusModifier:0 },
    vehicle: { vehicleType:"ground", speed:0, toughness:0, capacity:0, notes:"" },
    language: { world:"lower", isDead:false },
  };
  return { name:"", description:"", ...(D[type] || {}) };
}


export default function ItemsView({
  items = [],
  characters = [],
  statuses = [],
  onCreateItem,
  onDeleteItem,
  onUpdateItem,
  onAssign,
  onUnassign,
  onAddLanguage,
}) {
  const [activeTab, setActiveTab] = useState("weapon");
  const [expandedId, setExpandedId] = useState(null);
  const [assignTarget, setAssignTarget] = useState({});
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({});
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItemData, setEditItemData] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [info, setInfo] = useState(null); // crosslink info popover: { title, lines[] }

  // Option sources for searchable selects (replace Foundry drag&drop)
  const skillOptions = useMemo(
    () => SKILLS_DATA.map(s => ({ value: s.name, label: s.name, hint: ATTR_SHORT[s.attr] })),
    []
  );
  const magicSkillOptions = useMemo(
    () => SKILLS_DATA.filter(s => s.attr === "magic").map(s => ({ value: s.name, label: s.name, hint: ATTR_SHORT[s.attr] })),
    []
  );
  const statusOptions = useMemo(
    () => [...statuses].sort((a, b) => a.name.localeCompare(b.name, "ru")).map(s => ({ value: s.name, label: s.name })),
    [statuses]
  );

  function showSkillInfo(name) {
    const s = SKILLS_DATA.find(x => x.name === name);
    if (!s) return setInfo({ title: name, lines: ["Навык не найден в справочнике."] });
    setInfo({ title: s.name, lines: [
      `Атрибут: ${ATTR_LABEL[s.attr] || s.attr}`,
      `Категория: ${s.categ}`,
      s.base ? "Базовый навык" : "Изучаемый навык",
    ] });
  }
  function showStatusInfo(name) {
    const s = statuses.find(x => x.name === name);
    if (!s) return setInfo({ title: name, lines: ["Статус не найден. Загрузите статусы в Настройках кампании."] });
    setInfo({ title: s.name, lines: [s.description || "Без описания."] });
  }

  // Copy types: catalog shows templates only (ownerCharacterId === null); copies live on character cards
  const tabItems = useMemo(() => {
    const all = items.filter(i => i.type === activeTab);
    return COPY_TYPES.includes(activeTab) ? all.filter(i => !i.ownerCharacterId) : all;
  }, [items, activeTab]);

  function setNew(k, v) { setNewItem(p => ({ ...p, [k]: v })); }

  function startAdd() {
    setNewItem(defaultsFor(activeTab));
    setAdding(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newItem.name?.trim()) return;
    setSaving(true);
    try {
      await onCreateItem({ type: activeTab, ...newItem, name: newItem.name.trim(), ownerCharacterId: null });
      setAdding(false);
      setNewItem({});
    } catch (err) {
      alert("Ошибка: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEditItem(item) { setEditingItemId(item.id); setEditItemData({ ...defaultsFor(item.type), ...item }); }
  function setEI(k, v) { setEditItemData(p => ({ ...p, [k]: v })); }

  async function handleSaveEditItem(e) {
    e.preventDefault();
    if (!editItemData.name?.trim()) return;
    setEditSaving(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { id: _id, createdAt: _ca, ...fields } = editItemData;
      await onUpdateItem(editingItemId, fields);
      setEditingItemId(null);
      setEditItemData({});
    } catch (err) {
      alert("Ошибка: " + err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleAssign(item) {
    const charId = assignTarget[item.id];
    if (!charId) return;
    try {
      await onAssign(item, charId, item.type);
      setAssignTarget(p => ({ ...p, [item.id]: "" }));
    } catch (err) {
      alert("Ошибка назначения: " + err.message);
    }
  }

  async function handleUnassign(item, charId) {
    try {
      await onUnassign(item.id, charId, item.type);
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  }

  async function handleAddLang(item) {
    const charId = assignTarget[item.id];
    if (!charId) return;
    const ch = characters.find(c => c.id === charId);
    if (!ch) return;
    try {
      await onAddLanguage(charId, { name: item.name, itemId: item.id });
      setAssignTarget(p => ({ ...p, [item.id]: "" }));
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  }

  function artifactOwner(item) {
    if (!item.ownerCharacterId) return null;
    return characters.find(c => c.id === item.ownerCharacterId) || null;
  }
  function languageOwners(item) {
    return characters.filter(c => c.languages?.some(l => l.itemId === item.id));
  }

  const isArtifact  = activeTab === "artifact";
  const isLanguage  = activeTab === LANG_TYPE;
  const isCopyType  = COPY_TYPES.includes(activeTab);

  const formProps = { skillOptions, magicSkillOptions, statusOptions, onSkillInfo: showSkillInfo, onStatusInfo: showStatusInfo };

  return (
    <div className="kk-block kk-items-view">
      <h2 className="kk-h2">Предметы (каталог)</h2>

      {/* Tabs */}
      <div className="kk-items-tabs">
        {ALL_CATALOG_TYPES.map(t => (
          <button
            key={t}
            className={`kk-items-tab${activeTab === t ? " active" : ""}`}
            onClick={() => { setActiveTab(t); setAdding(false); setExpandedId(null); }}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="kk-items-catalog">
        {tabItems.length === 0 && !adding && (
          <div className="kk-empty-sm">Нет предметов этого типа</div>
        )}

        {activeTab === "spell" && (() => {
          const folders = {};
          const folderOrder = [];
          for (const item of tabItems) {
            const key = item.folder || item.skillName || "Без навыка";
            if (!folders[key]) { folders[key] = []; folderOrder.push(key); }
            folders[key].push(item);
          }
          return folderOrder.map(folder => (
            <div key={folder} className="kk-spell-folder">
              <div className="kk-spell-folder-label">{folder}</div>
              {folders[folder].map(item => renderCatalogRow(item))}
            </div>
          ));
        })()}

        {activeTab !== "spell" && tabItems.map(item => renderCatalogRow(item))}
      </div>

      <button className="kk-note-btn kk-items-add-btn" onClick={startAdd} style={{ marginTop: "0.75rem" }}>
        + Добавить {TYPE_LABELS[activeTab]?.toLowerCase() || "предмет"}
      </button>

      {adding && <AddItemForm type={activeTab} data={newItem} setData={setNew} onSubmit={handleCreate} onCancel={() => setAdding(false)} saving={saving} {...formProps} />}

      {info && (
        <div className="kk-ss-info-overlay" onClick={() => setInfo(null)}>
          <div className="kk-ss-info" onClick={e => e.stopPropagation()}>
            <div className="kk-ss-info-head">
              <span className="kk-ss-info-title">{info.title}</span>
              <button className="kk-note-del" onClick={() => setInfo(null)}>✕</button>
            </div>
            {info.lines.map((l, i) => <p key={i} className="kk-ss-info-line">{l}</p>)}
          </div>
        </div>
      )}
    </div>
  );

  function renderCatalogRow(item) {
        const isExpanded = expandedId === item.id;
          const artOwner   = isArtifact ? artifactOwner(item) : null;
          const langOwners = isLanguage ? languageOwners(item) : [];

          return (
            <div key={item.id} className={`kk-catalog-row${isExpanded ? " expanded" : ""}`}>
              <div className="kk-catalog-row-head" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                <span className="kk-catalog-row-name">{item.name}</span>
                <span className="kk-catalog-row-sub">{itemSubtitle(item)}</span>
                {isArtifact && artOwner && (
                  <span className="kk-catalog-row-owner">{artOwner.name}</span>
                )}
                {isArtifact && !artOwner && (
                  <span className="kk-catalog-row-unowned">Нет владельца</span>
                )}
                {isLanguage && langOwners.length > 0 && (
                  <span className="kk-catalog-row-owner">{langOwners.map(c => c.name).join(", ")}</span>
                )}
                <span className="kk-catalog-chevron">{isExpanded ? "▲" : "▼"}</span>
              </div>

              {isExpanded && (
                <div className="kk-catalog-row-body">
                  {editingItemId === item.id ? (
                    <AddItemForm type={item.type} data={editItemData} setData={setEI}
                      onSubmit={handleSaveEditItem} onCancel={() => setEditingItemId(null)}
                      saving={editSaving} submitLabel="Сохранить" {...formProps} />
                  ) : (
                    <>
                      {item.description && <p className="kk-item-desc">{item.description}</p>}

                      {/* Assign: for copy types only show for unowned templates */}
                      {(!isCopyType || !item.ownerCharacterId) && (
                        <div className="kk-catalog-assign">
                          <select
                            className="kk-item-select"
                            value={assignTarget[item.id] || ""}
                            onChange={e => setAssignTarget(p => ({ ...p, [item.id]: e.target.value }))}
                          >
                            <option value="">— выбрать персонажа —</option>
                            {characters.filter(c => c.characterCreated !== false).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <button
                            className="kk-note-btn"
                            disabled={!assignTarget[item.id]}
                            onClick={() => isLanguage ? handleAddLang(item) : handleAssign(item)}
                          >
                            {isCopyType ? "Выдать копию" : "Назначить"}
                          </button>
                        </div>
                      )}

                      {isArtifact && artOwner && (
                        <div className="kk-catalog-owners">
                          <span className="kk-catalog-owner-name">{artOwner.name}</span>
                          <button className="kk-note-del" onClick={() => handleUnassign(item, item.ownerCharacterId)}>✕</button>
                        </div>
                      )}
                      {isLanguage && langOwners.map(c => (
                        <div key={c.id} className="kk-catalog-owners">
                          <span className="kk-catalog-owner-name">{c.name}</span>
                        </div>
                      ))}

                      <div className="kk-catalog-actions">
                        <button className="kk-note-btn" onClick={() => startEditItem(item)}>✎ Редактировать</button>
                        <button className="kk-note-btn kk-item-cancel-btn" onClick={() => onDeleteItem(item.id)}>Удалить предмет</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
  }
}

// ════════════════════════════════════════════════════════════════
//  Full-schema add/edit form — sections instead of Foundry tabs.
// ════════════════════════════════════════════════════════════════
function AddItemForm({
  type, data, setData, onSubmit, onCancel, saving, submitLabel = "Добавить",
  skillOptions, magicSkillOptions, statusOptions, onSkillInfo, onStatusInfo,
}) {
  const txt = k => e => setData(k, e.target.value);
  const num = k => e => setData(k, Number(e.target.value));
  const chk = k => e => setData(k, e.target.checked);
  const set = (k, v) => setData(k, v);
  const setBonus = (attr, v) => setData("bonuses", { ...(data.bonuses || {}), [attr]: Number(v) });

  // skillBonuses [{skillName, bonus}] managed via multiselect + per-row number
  const skillBonusNames = (data.skillBonuses || []).map(b => b.skillName);
  function setSkillBonusNames(names) {
    const existing = data.skillBonuses || [];
    setData("skillBonuses", names.map(nm => existing.find(b => b.skillName === nm) || { skillName: nm, bonus: 1 }));
  }
  function setSkillBonusValue(nm, val) {
    setData("skillBonuses", (data.skillBonuses || []).map(b => b.skillName === nm ? { ...b, bonus: Number(val) } : b));
  }

  const sel = (k, opts) => (
    <select className="kk-item-select" value={data[k] ?? opts[0][0]} onChange={txt(k)}>
      {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const numf = (k, a = {}) => (
    <input type="number" className="kk-item-num" value={data[k] ?? 0} onChange={num(k)} min={a.min} max={a.max} step={a.step} />
  );
  const skillSel = (k, opts = skillOptions, ph = "— навык —") => (
    <SearchableSelect options={opts} value={data[k] || ""} onChange={v => set(k, v)}
      placeholder={ph} onCrosslink={onSkillInfo} />
  );
  const statusSel = (k, ph = "— статус —") => (
    <SearchableSelect options={statusOptions} value={data[k] || ""} onChange={v => set(k, v)}
      placeholder={ph} emptyLabel="Нет статусов (загрузите в Настройках)" onCrosslink={onStatusInfo} />
  );

  const aType = data.artifactType;
  const sType = data.spellType;
  const dType = data.deviceType;
  const showCond = ["perfect", "worn"].includes(data.condition);

  return (
    <form className="kk-item-form" onSubmit={onSubmit} style={{ marginTop: "0.5rem" }}>
      <input className="kk-note-input" placeholder="Название *" value={data.name || ""} onChange={txt("name")} required maxLength={100} />
      <textarea className="kk-note-input kk-note-body-input" placeholder="Описание" value={data.description || ""} onChange={txt("description")} rows={2} maxLength={2000} />

      {/* ── Состояние (вещи) ── */}
      {(type === "weapon" || type === "gear" || type === "artifact" || type === "device") && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Состояние:</label>
          {sel("condition", CONDITION)}
          {(type === "weapon" || type === "gear" || type === "device") && (<>
            <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Экипировка:</label>
            {sel("equipped", EQUIPPED)}
          </>)}
        </div>
      )}

      {/* ══════════ WEAPON ══════════ */}
      {type === "weapon" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Урон:</label>
          {sel("damageLevel", DMG_LEVEL)}
          {sel("damageType", DMG_TYPE)}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Размер:</label>
          {sel("size", SIZE)}
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Дальн. (м):</label>{numf("range", { min: 0 })}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Бронепроб.:</label>{numf("ap", { min: 0 })}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Скоростр.:</label>{numf("rof", { min: 1 })}
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Навык атаки:</label>
          {skillSel("skillName")}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Мод. атаки:</label>{numf("attackModifier")}
        </div>
        <div className="kk-item-form-section">
          <label className="kk-item-form-chk">
            <input type="checkbox" checked={!!data.hasStatus} onChange={chk("hasStatus")} /> Статус при попадании
          </label>
          {data.hasStatus && statusSel("statusName")}
        </div>
        {showCond && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">% эффекта состояния:</label>{numf("conditionChance", { min: 0, max: 100 })}
          </div>
        )}
      </>)}

      {/* ══════════ GEAR ══════════ */}
      {type === "gear" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Подтип:</label>
          {sel("gearType", [["attack","Атака"],["defense","Защита"],["utility","Утилита"]])}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Размер:</label>
          {sel("size", SIZE)}
          {data.soakType !== "absolute" && (<>
            <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Кол-во:</label>{numf("quantity", { min: 0 })}
          </>)}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Экип.:</label>
          {sel("equipped", EQUIPPED)}
        </div>

        {data.gearType === "attack" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Атака</div>
            <div className="kk-item-form-row">
              {sel("damageLevel", DMG_LEVEL)}{sel("damageType", DMG_TYPE)}
              <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Мод.:</label>{numf("attackModifier")}
            </div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Навык:</label>{skillSel("skillName")}
            </div>
            <label className="kk-item-form-chk">
              <input type="checkbox" checked={!!data.hasStatus} onChange={chk("hasStatus")} /> Статус при попадании
            </label>
            {data.hasStatus && statusSel("statusName")}
            {showCond && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">% эффекта состояния:</label>{numf("conditionChance", { min: 0, max: 100 })}
              </div>
            )}
          </div>
        )}

        {data.gearType === "defense" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Защита</div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Тип защиты:</label>
              {sel("soakType", SOAK_GEAR)}
            </div>
            {data.soakType === "absolute" && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Запас макс.:</label>{numf("soakAbsoluteCapacity", { min: 0 })}
                <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Текущий:</label>{numf("soakAbsoluteCurrent", { min: 0 })}
              </div>
            )}
            {data.soakType === "bonus" && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">+Кубик:</label>{sel("soakBonusDie", DIE_OPTS)}
                <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Мод.:</label>{numf("soakBonusModifier")}
                <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Примен.:</label>{numf("soakUses", { min: 0 })}
              </div>
            )}
          </div>
        )}

        {data.gearType === "utility" && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Восст. энергии:</label>{numf("energyRestore", { min: 0 })}
          </div>
        )}
      </>)}

      {/* ══════════ ARTIFACT ══════════ */}
      {type === "artifact" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Редкость:</label>{sel("rarity", RARITY)}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Тип:</label>{sel("artifactType", ART_TYPE)}
        </div>
        {aType !== "ring" && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Класс:</label>{sel("artifactClass", ART_CLASS)}
            <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Размер:</label>{sel("size", SIZE)}
          </div>
        )}
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Экип.:</label>{sel("equipped", EQUIPPED)}
          {aType !== "ring" && (
            <label className="kk-item-form-chk" style={{ marginLeft: ".75rem" }}>
              <input type="checkbox" checked={!!data.active} onChange={chk("active")} /> Активен
            </label>
          )}
          <label className="kk-item-form-chk" style={{ marginLeft: ".75rem" }}>
            <input type="checkbox" checked={!!data.destroyed} onChange={chk("destroyed")} /> Уничтожен
          </label>
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Создатель:</label>
          <input className="kk-item-select" value={data.creator || ""} onChange={txt("creator")} maxLength={80} />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Legend Keeper:</label>
          <input className="kk-item-select" value={data.lkArticleUrl || ""} onChange={txt("lkArticleUrl")} placeholder="https://www.legendkeeper.com/app/…" />
        </div>

        {aType === "ring" ? (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Материал:</label>
            <input className="kk-item-select" value={data.ringMaterial || ""} onChange={txt("ringMaterial")} maxLength={60} />
            <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Сердечник:</label>
            <input className="kk-item-select" value={data.ringStone || ""} onChange={txt("ringStone")} maxLength={60} />
          </div>
        ) : (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Условие активации:</label>
            <input className="kk-item-select" value={data.activationCondition || ""} onChange={txt("activationCondition")} maxLength={120} />
          </div>
        )}
        {["rare", "unique", "ancient"].includes(data.rarity) && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Возраст (лет):</label>{numf("artifactAge", { min: 0 })}
          </div>
        )}

        {aType === "buff" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Бонусы к атрибутам</div>
            <div className="kk-item-bonus-grid">
              {[...ATTR_ORDER, "toughness"].map(attr => (
                <label key={attr} className="kk-item-bonus-cell">
                  <span>{attr === "toughness" ? "Стойкость" : ATTR_LABEL[attr]}</span>
                  <input type="number" className="kk-item-num" value={data.bonuses?.[attr] ?? 0} onChange={e => setBonus(attr, e.target.value)} />
                </label>
              ))}
            </div>
            <div className="kk-item-form-section-title" style={{ marginTop: ".5rem" }}>Бонусы к навыкам</div>
            <SearchableSelect multi options={skillOptions} value={skillBonusNames}
              onChange={setSkillBonusNames} placeholder="+ навыки для бонуса" onCrosslink={onSkillInfo} />
            {(data.skillBonuses || []).map(b => (
              <div key={b.skillName} className="kk-item-form-row">
                <label className="kk-item-form-label" style={{ flex: 1 }}>{b.skillName}</label>
                <input type="number" className="kk-item-num" value={b.bonus} onChange={e => setSkillBonusValue(b.skillName, e.target.value)} />
              </div>
            ))}
          </div>
        )}

        {aType === "attack" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Атака</div>
            <div className="kk-item-form-row">
              {sel("damageLevel", DMG_LEVEL)}{sel("damageType", DMG_TYPE)}
              <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Мод.:</label>{numf("attackModifier")}
            </div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Навык:</label>{skillSel("skillName")}
            </div>
            <label className="kk-item-form-chk">
              <input type="checkbox" checked={!!data.hasStatus} onChange={chk("hasStatus")} /> Статус при попадании
            </label>
            {data.hasStatus && statusSel("statusName")}
          </div>
        )}

        {aType === "defense" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Защита</div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Тип защиты:</label>{sel("soakType", SOAK_GEAR)}
            </div>
            {data.soakType === "absolute" && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Запас макс.:</label>{numf("soakAbsoluteCapacity", { min: 0 })}
                <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Текущий:</label>{numf("soakAbsoluteCurrent", { min: 0 })}
              </div>
            )}
            {data.soakType === "bonus" && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">+Кубик:</label>{sel("soakBonusDie", DIE_OPTS)}
                <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Мод.:</label>{numf("soakBonusModifier")}
                <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Примен.:</label>{numf("soakBonusUses", { min: 0 })}
              </div>
            )}
          </div>
        )}

        {aType === "utility" && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Восст. энергии:</label>{numf("energyRestore", { min: 0 })}
          </div>
        )}
      </>)}

      {/* ══════════ SPELL ══════════ */}
      {type === "spell" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип:</label>{sel("spellType", SPELL_TYPE)}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Цвет:</label>
          <input type="color" value={data.effectColor || "#a855f7"} onChange={txt("effectColor")} style={{ width: 32, height: 26, padding: 0 }} />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Навык каста:</label>
          {skillSel("skillName", magicSkillOptions, "— магический навык —")}
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Папка:</label>
          <input className="kk-item-select" value={data.folder || ""} onChange={txt("folder")} maxLength={60} placeholder="(по умолчанию: навык)" />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Энергия:</label>{numf("cost", { min: 0 })}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Дальн. (м):</label>{numf("range", { min: 0 })}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Примен.:</label>{numf("uses", { min: 1 })}
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Длит. (ч):</label>{numf("durationHours", { min: 0, step: 0.5 })}
          {(sType === "spatial" || sType === "health_buff") && (<>
            <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Поддерж.:</label>{numf("upkeepCost", { min: 0 })}
          </>)}
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-chk"><input type="checkbox" checked={!!data.noWandNeeded} onChange={chk("noWandNeeded")} /> Без кольца</label>
          <label className="kk-item-form-chk" style={{ marginLeft: ".75rem" }}><input type="checkbox" checked={!!data.isAoe} onChange={chk("isAoe")} /> Площадное</label>
        </div>
        <div className="kk-item-form-section">
          <div className="kk-item-form-section-title">Статус при глазе змеи{sType === "spatial" ? " (обязателен)" : ""}</div>
          {statusSel("snakeEyesStatusName", "— статус —")}
        </div>

        {sType === "attack" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Атака</div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Тип урона:</label>{sel("damageType", DMG_TYPE)}
            </div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-chk"><input type="checkbox" checked={!!data.bypassSoak} onChange={chk("bypassSoak")} /> Только абс. защита</label>
              <label className="kk-item-form-chk" style={{ marginLeft: ".75rem" }}><input type="checkbox" checked={!!data.unresistable} onChange={chk("unresistable")} /> Неотразимое</label>
            </div>
            <label className="kk-item-form-chk"><input type="checkbox" checked={!!data.hasStatus} onChange={chk("hasStatus")} /> Статус при попадании</label>
            {data.hasStatus && statusSel("statusName")}
          </div>
        )}

        {sType === "defense" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Защита</div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Вид защиты:</label>{sel("soakType", SOAK_SPELL)}
            </div>
            {data.soakType === "absolute" && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Запас макс.:</label>{numf("soakAbsoluteCapacity", { min: 0 })}
                <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Текущий:</label>{numf("soakAbsoluteCurrent", { min: 0 })}
              </div>
            )}
            {data.soakType === "status" && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Бонус стойкости:</label>{numf("toughnessBonus")}
              </div>
            )}
          </div>
        )}

        {sType === "buff" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Бонусы усиления</div>
            <div className="kk-item-bonus-grid">
              {[...ATTR_ORDER, "toughness"].map(attr => (
                <label key={attr} className="kk-item-bonus-cell">
                  <span>{attr === "toughness" ? "Стойкость" : ATTR_LABEL[attr]}</span>
                  <input type="number" className="kk-item-num" value={data.bonuses?.[attr] ?? 0} onChange={e => setBonus(attr, e.target.value)} />
                </label>
              ))}
            </div>
            <div className="kk-item-form-section-title" style={{ marginTop: ".5rem" }}>Бонусы к навыкам</div>
            <SearchableSelect multi options={skillOptions} value={skillBonusNames}
              onChange={setSkillBonusNames} placeholder="+ навыки для бонуса" onCrosslink={onSkillInfo} />
            {(data.skillBonuses || []).map(b => (
              <div key={b.skillName} className="kk-item-form-row">
                <label className="kk-item-form-label" style={{ flex: 1 }}>{b.skillName}</label>
                <input type="number" className="kk-item-num" value={b.bonus} onChange={e => setSkillBonusValue(b.skillName, e.target.value)} />
              </div>
            ))}
          </div>
        )}

        {sType === "health_buff" && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Пипов:</label>{numf("healthBufferPip", { min: 0, max: 5 })}
            <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Шкала:</label>{sel("healthBufferTrack", TRACK)}
          </div>
        )}

        {(sType === "binding" || sType === "transforming") && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">{sType === "binding" ? "Связь" : "Трансформация"}</div>
            {sType === "binding" && (
              <label className="kk-item-form-chk"><input type="checkbox" checked={!!data.unresistable} onChange={chk("unresistable")} /> Неотразимая</label>
            )}
            {!(sType === "binding" && data.unresistable) && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">Навык сопротивления:</label>
                {skillSel("contestedSkillName", skillOptions, "— навык цели —")}
              </div>
            )}
            <label className="kk-item-form-chk"><input type="checkbox" checked={!!data.hasStatus} onChange={chk("hasStatus")} /> Статус при успехе</label>
            {data.hasStatus && statusSel("statusName")}
          </div>
        )}

        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Эффект (визуал):</label>
          <input className="kk-item-select" value={data.effectDescription || ""} onChange={txt("effectDescription")} maxLength={120} placeholder="как выглядит заклинание…" />
        </div>
      </>)}

      {/* ══════════ DEVICE ══════════ */}
      {type === "device" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип:</label>{sel("deviceType", DEV_TYPE)}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Заряды (−1=∞):</label>{numf("charges", { min: -1 })}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }} title="Полный запас — восстанавливается при тайм-ревинде (−1=∞, не восстанавливается)">Макс. зарядов:</label>{numf("maxCharges", { min: -1 })}
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Создатель:</label>
          <input className="kk-item-select" value={data.creator || ""} onChange={txt("creator")} maxLength={80} />
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Папка:</label>
          <input className="kk-item-select" value={data.folder || ""} onChange={txt("folder")} maxLength={60} />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-chk"><input type="checkbox" checked={!!data.worksUpper} onChange={chk("worksUpper")} /> Верхний мир</label>
          <label className="kk-item-form-chk" style={{ marginLeft: ".75rem" }}><input type="checkbox" checked={!!data.worksLower} onChange={chk("worksLower")} /> Нижний мир</label>
        </div>

        {dType === "weapon" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Оружие</div>
            <div className="kk-item-form-row">
              {sel("damageLevel", DMG_LEVEL)}{sel("damageType", DMG_TYPE)}
              <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Дальн.:</label>{numf("range", { min: 0 })}
            </div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">Навык атаки:</label>{skillSel("attackSkillName")}
              <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Мод.:</label>{numf("attackModifier")}
            </div>
            <label className="kk-item-form-chk"><input type="checkbox" checked={!!data.hasStatus} onChange={chk("hasStatus")} /> Статус при попадании</label>
            {data.hasStatus && statusSel("statusName")}
            {showCond && (
              <div className="kk-item-form-row">
                <label className="kk-item-form-label">% эффекта состояния:</label>{numf("conditionChance", { min: 0, max: 100 })}
              </div>
            )}
          </div>
        )}

        {dType === "gadget" && (
          <div className="kk-item-form-section">
            <div className="kk-item-form-section-title">Защита (стойкость)</div>
            <div className="kk-item-form-row">
              <label className="kk-item-form-label">+Кубик (грань):</label>{numf("soakBonusDie", { min: 0 })}
              <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Мод.:</label>{numf("soakBonusModifier")}
            </div>
          </div>
        )}

        {dType !== "weapon" && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Бонус к навыку:</label>{skillSel("bonusSkillName")}
            <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Значение:</label>{numf("bonusValue")}
          </div>
        )}
      </>)}

      {/* ══════════ VEHICLE ══════════ */}
      {type === "vehicle" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип:</label>{sel("vehicleType", VEH_TYPE)}
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Скорость:</label>{numf("speed", { min: 0 })}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Стойкость:</label>{numf("toughness", { min: 0 })}
          <label className="kk-item-form-label" style={{ marginLeft: ".5rem" }}>Вместим.:</label>{numf("capacity", { min: 1 })}
        </div>
        <textarea className="kk-note-input kk-note-body-input" placeholder="Заметки (вооружение, особенности…)" value={data.notes || ""} onChange={txt("notes")} rows={2} maxLength={1000} />
      </>)}

      {/* ══════════ LANGUAGE ══════════ */}
      {type === "language" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Мир:</label>{sel("world", WORLD)}
          <label className="kk-item-form-chk" style={{ marginLeft: ".75rem" }}>
            <input type="checkbox" checked={!!data.isDead} onChange={chk("isDead")} /> Мёртвый
          </label>
        </div>
      )}

      <div className="kk-item-form-actions">
        <button type="submit" className="kk-note-btn" disabled={saving || !data.name?.trim()}>{saving ? "Сохранение…" : submitLabel}</button>
        <button type="button" className="kk-note-btn kk-item-cancel-btn" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
