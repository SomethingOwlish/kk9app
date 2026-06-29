const TYPE_LABEL = {
  attack: "Атака", defense: "Защита", buff: "Усиление", health_buff: "Здоровье",
  binding: "Сковывание", spatial: "Пространство", transforming: "Трансформация",
  prophetic: "Прорицание", utility: "Утилита",
};

export default function SpellItem({ item, activeSpell, isGM, onDelete, onEdit }) {
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
