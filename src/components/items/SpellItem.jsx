const TYPE_LABEL = {
  attack: "Атака", defense: "Защита", buff: "Усиление", health_buff: "Здоровье",
  binding: "Сковывание", spatial: "Пространство", transforming: "Трансформация",
  prophetic: "Прорицание", utility: "Утилита",
};

// A buff/defense spell can stack several enhancement KINDS at once (attribute
// bonuses + per-skill bonuses + toughness/soak + an applied status). Collect the
// non-zero ones so the card shows every effect, not just the status.
const ATTR_LABEL = { agility: "Ловк", smarts: "Смек", spirit: "Дух", endurance: "Вын", magic: "Магия", toughness: "Стойк" };
function enhancementTags(item) {
  const tags = [];
  const b = item.bonuses || {};
  for (const [k, label] of Object.entries(ATTR_LABEL)) {
    if (b[k]) tags.push(`${label} ${b[k] > 0 ? "+" : ""}${b[k]}`);
  }
  for (const sb of item.skillBonuses || []) {
    if (sb?.bonus) tags.push(`${sb.skillName} ${sb.bonus > 0 ? "+" : ""}${sb.bonus}`);
  }
  if (item.toughnessBonus) tags.push(`Стойк ${item.toughnessBonus > 0 ? "+" : ""}${item.toughnessBonus}`);
  if (item.soakType === "absolute" && item.soakAbsoluteCapacity) tags.push(`Поглощение ${item.soakAbsoluteCapacity}`);
  if (item.healthBufferPip) tags.push(`Буфер ${item.healthBufferPip} (${item.healthBufferTrack === "mental" ? "мент." : "физ."})`);
  if (item.dieChange) tags.push(`Грань ${item.dieChange > 0 ? "+" : ""}${item.dieChange}`);
  if (item.successMod) tags.push(`Успех ${item.successMod > 0 ? "+" : ""}${item.successMod}`);
  if (item.extraDie?.enabled) tags.push(`${item.extraDie.mode === "subtract" ? "−" : "+"}d${item.extraDie.faces || 6}`);
  return tags;
}

export default function SpellItem({ item, activeSpell, isGM, onDelete, onEdit }) {
  const enhTags = enhancementTags(item);
  // activeSpell = { itemId, usesRemaining, durationRemaining, upkeepCost } or undefined
  return (
    <div className={`kk-item kk-item-spell${activeSpell ? " kk-item-active" : ""}`}>
      <div className="kk-item-header">
        <span className="kk-item-icon">✦</span>
        <span className="kk-item-name">{item.name}</span>
        {item.spellType && (
          <span className="kk-item-subtype">{TYPE_LABEL[item.spellType] || item.spellType}</span>
        )}
        {item.skillName && <span className="kk-item-stat" style={{ marginLeft: "auto" }}>{item.skillName}</span>}
        {isGM && onEdit && (
          <button className="kk-item-edit-btn" onClick={onEdit} title="Редактировать">✎</button>
        )}
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить предмет">✕</button>
        )}
      </div>
      <div className="kk-item-stats">
        {item.cost > 0 && <span className="kk-item-stat">Стоимость {item.cost}</span>}
        {item.upkeepCost > 0 && <span className="kk-item-stat">Поддержание {item.upkeepCost}/раунд</span>}
        {item.uses > 0 && <span className="kk-item-stat">Использований {item.uses}</span>}
        {item.range > 0 && <span className="kk-item-stat">{item.range}м</span>}
        {item.duration !== 0 && item.durationHours > 0 && (
          <span className="kk-item-stat">{item.durationHours}ч</span>
        )}
        {item.noWandNeeded && <span className="kk-item-stat">Без жезла</span>}
        {item.isAoe && <span className="kk-item-stat">Площадь</span>}
        {item.hasStatus && item.statusName && <span className="kk-item-stat kk-item-status-tag">» {item.statusName}</span>}
      </div>
      {enhTags.length > 0 && (
        <div className="kk-item-stats">
          {enhTags.map((t, i) => <span key={i} className="kk-item-stat kk-item-buff-tag">{t}</span>)}
        </div>
      )}
      {activeSpell && (
        <div className="kk-item-stats kk-spell-active-state">
          {activeSpell.usesRemaining !== undefined && (
            <span className="kk-item-stat">Осталось: {activeSpell.usesRemaining}</span>
          )}
          {activeSpell.durationRemaining !== undefined && activeSpell.durationRemaining > 0 && (
            <span className="kk-item-stat">Раунды: {activeSpell.durationRemaining}</span>
          )}
        </div>
      )}
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
