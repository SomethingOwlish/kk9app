import { useState, useMemo } from "react";

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

const DAMAGE_LEVEL_LABEL = { light: "Лёгкий", heavy: "Тяжёлый", lethal: "Летальный" };
const ARTIFACT_TYPE_LABEL = {
  attack: "Атак.", defense: "Защ.", binding: "Сков.", spatial: "Прост.",
  utility: "Утил.", buff: "Усил.", transforming: "Трансф.", prophetic: "Проц.", ring: "Кольцо",
};
const SPELL_TYPE_LABEL = {
  attack: "Атак.", defense: "Защ.", buff: "Усил.", health_buff: "Здор.",
  binding: "Сков.", spatial: "Прост.", transforming: "Трансф.", prophetic: "Проц.", utility: "Утил.",
};

function itemSubtitle(item) {
  if (item.type === "weapon")   return `${DAMAGE_LEVEL_LABEL[item.damageLevel] || item.damageLevel || ""} · ${item.skillName || ""}`;
  if (item.type === "gear")     return item.gearType || "";
  if (item.type === "artifact") return `${ARTIFACT_TYPE_LABEL[item.artifactType] || item.artifactType || ""} · ${item.ringMaterial || ""} ${item.ringStone || ""}`.trim();
  if (item.type === "spell")    return `${SPELL_TYPE_LABEL[item.spellType] || item.spellType || ""} · ${item.skillName || ""}`;
  if (item.type === "device")   return item.deviceType || "";
  if (item.type === "language") return item.world || "";
  return "";
}


export default function ItemsView({
  items = [],
  characters = [],
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

  // Copy types: catalog shows templates only (ownerCharacterId === null); copies live on character cards
  // Artifact: catalog shows all (single owner tracked here); Language: all (reference list)
  const tabItems = useMemo(() => {
    const all = items.filter(i => i.type === activeTab);
    return COPY_TYPES.includes(activeTab) ? all.filter(i => !i.ownerCharacterId) : all;
  }, [items, activeTab]);

  function setNew(k, v) { setNewItem(p => ({ ...p, [k]: v })); }

  function startAdd() {
    const defaults = activeTab === "weapon"
      ? { name: "", condition: "perfect", damageLevel: "light", damageType: "physical", skillName: "", range: 0, ap: 0, rof: 1, attackModifier: 0 }
      : activeTab === "gear"
      ? { name: "", condition: "perfect", gearType: "utility", quantity: 1 }
      : activeTab === "artifact"
      ? { name: "", condition: "perfect", artifactType: "ring", rarity: "common", ringMaterial: "", ringStone: "", active: false }
      : activeTab === "spell"
      ? { name: "", spellType: "utility", cost: 1, upkeepCost: 0, uses: 1, range: 0, skillName: "" }
      : activeTab === "device"
      ? { name: "", condition: "perfect", deviceType: "", charges: 0 }
      : activeTab === "vehicle"
      ? { name: "", speed: 0, toughness: 0, capacity: 0 }
      : activeTab === "language"
      ? { name: "", world: "lower", isDead: false }
      : { name: "" };
    setNewItem(defaults);
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

  function startEditItem(item) { setEditingItemId(item.id); setEditItemData({ ...item }); }
  function setEI(k, v) { setEditItemData(p => ({ ...p, [k]: v })); }

  async function handleSaveEditItem(e) {
    e.preventDefault();
    if (!editItemData.name?.trim()) return;
    setEditSaving(true);
    try {
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

  // For artifact: returns 0 or 1 owner; for language: all chars with that language
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

      {adding && <AddItemForm type={activeTab} data={newItem} setData={setNew} onSubmit={handleCreate} onCancel={() => setAdding(false)} saving={saving} />}
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
                      saving={editSaving} submitLabel="Сохранить" />
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

// ── Minimal inline add-form per type ─────────────────────────
function AddItemForm({ type, data, setData, onSubmit, onCancel, saving, submitLabel = "Добавить" }) {
  const CONDITIONS = ["perfect", "good", "worn", "broken"];
  const COND_LBL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
  const n = k => e => setData(k, typeof e === "object" ? e.target.value : e);
  const num = k => e => setData(k, Number(e.target.value));

  return (
    <form className="kk-item-form" onSubmit={onSubmit} style={{ marginTop: "0.5rem" }}>
      <input className="kk-note-input" placeholder="Название *" value={data.name || ""} onChange={n("name")} required maxLength={100} />
      <textarea className="kk-note-input kk-note-body-input" placeholder="Описание" value={data.description || ""} onChange={n("description")} rows={2} maxLength={600} />

      {(type === "weapon" || type === "gear" || type === "artifact" || type === "device") && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Состояние:</label>
          <select className="kk-item-select" value={data.condition || "good"} onChange={n("condition")}>
            {CONDITIONS.map(c => <option key={c} value={c}>{COND_LBL[c]}</option>)}
          </select>
        </div>
      )}

      {type === "weapon" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Урон:</label>
          <select className="kk-item-select" value={data.damageLevel || "light"} onChange={n("damageLevel")}>
            {[["light","Лёгкий"],["heavy","Тяжёлый"],["lethal","Летальный"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select className="kk-item-select" style={{marginLeft:"0.5rem"}} value={data.damageType || "physical"} onChange={n("damageType")}>
            <option value="physical">Физический</option>
            <option value="mental">Ментальный</option>
          </select>
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Навык:</label>
          <input className="kk-item-select" value={data.skillName || ""} onChange={n("skillName")} maxLength={60} />
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Дальн.:</label>
          <input type="number" className="kk-item-num" value={data.range || 0} onChange={num("range")} min={0} />
        </div>
      </>)}

      {type === "gear" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Подтип:</label>
          <select className="kk-item-select" value={data.gearType || "utility"} onChange={n("gearType")}>
            <option value="attack">Атака</option><option value="defense">Защита</option><option value="utility">Утилита</option>
          </select>
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Кол-во:</label>
          <input type="number" className="kk-item-num" value={data.quantity || 1} onChange={num("quantity")} min={1} />
        </div>
      )}

      {type === "artifact" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип:</label>
          <select className="kk-item-select" value={data.artifactType || "ring"} onChange={n("artifactType")}>
            {["attack","defense","binding","spatial","utility","buff","transforming","prophetic","ring"].map(t => (
              <option key={t} value={t}>{({attack:"Атакующий",defense:"Защитный",binding:"Сковывающий",spatial:"Прост.",utility:"Утилитарный",buff:"Усиливающий",transforming:"Трансф.",prophetic:"Проц.",ring:"Кольцо"})[t]}</option>
            ))}
          </select>
        </div>
        {data.artifactType === "ring" && (
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Материал:</label>
            <input className="kk-item-select" value={data.ringMaterial || ""} onChange={n("ringMaterial")} maxLength={60} />
            <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Камень:</label>
            <input className="kk-item-select" value={data.ringStone || ""} onChange={n("ringStone")} maxLength={60} />
          </div>
        )}
      </>)}

      {type === "spell" && (<>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип:</label>
          <select className="kk-item-select" value={data.spellType || "utility"} onChange={n("spellType")}>
            {["attack","defense","buff","health_buff","binding","spatial","transforming","prophetic","utility"].map(t => (
              <option key={t} value={t}>{({attack:"Атака",defense:"Защита",buff:"Усиление",health_buff:"Здоровье",binding:"Сковывание",spatial:"Пространство",transforming:"Трансф.",prophetic:"Прорицание",utility:"Утилита"})[t]}</option>
            ))}
          </select>
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Навык:</label>
          <input className="kk-item-select" value={data.skillName || ""} onChange={n("skillName")} maxLength={60} />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Папка:</label>
          <input className="kk-item-select" value={data.folder || ""} onChange={n("folder")} maxLength={60} placeholder="(по умолчанию: навык)" />
        </div>
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Стоимость:</label>
          <input type="number" className="kk-item-num" value={data.cost || 1} onChange={num("cost")} min={0} />
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Поддерж.:</label>
          <input type="number" className="kk-item-num" value={data.upkeepCost || 0} onChange={num("upkeepCost")} min={0} />
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Использ.:</label>
          <input type="number" className="kk-item-num" value={data.uses || 1} onChange={num("uses")} min={1} />
        </div>
      </>)}

      {type === "device" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Тип:</label>
          <input className="kk-item-select" value={data.deviceType || ""} onChange={n("deviceType")} maxLength={60} />
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Заряды:</label>
          <input type="number" className="kk-item-num" value={data.charges ?? 0} onChange={num("charges")} min={-1} />
        </div>
      )}

      {type === "vehicle" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Скорость:</label>
          <input type="number" className="kk-item-num" value={data.speed || 0} onChange={num("speed")} min={0} />
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Стойкость:</label>
          <input type="number" className="kk-item-num" value={data.toughness || 0} onChange={num("toughness")} min={0} />
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>Вместим.:</label>
          <input type="number" className="kk-item-num" value={data.capacity || 0} onChange={num("capacity")} min={0} />
        </div>
      )}

      {type === "language" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">Мир:</label>
          <select className="kk-item-select" value={data.world || "lower"} onChange={n("world")}>
            <option value="upper">Верхний</option>
            <option value="lower">Нижний</option>
            <option value="both">Оба</option>
            <option value="mystic">Мистический</option>
          </select>
          <label className="kk-item-form-label" style={{marginLeft:"0.5rem"}}>
            <input type="checkbox" checked={!!data.isDead} onChange={e => setData("isDead", e.target.checked)} /> Мёртвый
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
