const CONDITION_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
const DAMAGE_LEVEL_LABEL = { light: "Лёгкий", heavy: "Тяжёлый", lethal: "Летальный" };
const DAMAGE_TYPE_LABEL = { physical: "Физический", mental: "Ментальный" };
const SIZE_LABEL = { pocket: "Карман", finger: "Палец", small: "Малый", medium: "Средний", large: "Крупный", huge: "Огромный", immovable: "Стационарный" };

export default function WeaponItem({ item, isGM, onDelete, onEdit }) {
  const atk = item.attackModifier > 0 ? `+${item.attackModifier}` : item.attackModifier < 0 ? `${item.attackModifier}` : "";
  return (
    <div className="kk-item kk-item-weapon">
      <div className="kk-item-header">
        <span className="kk-item-icon">⚔</span>
        <span className="kk-item-name">{item.name}</span>
        <span className={`kk-item-condition kk-cond-${item.condition}`}>
          {CONDITION_LABEL[item.condition] || item.condition}
        </span>
        {isGM && onEdit && (
          <button className="kk-item-edit-btn" onClick={onEdit} title="Редактировать">✎</button>
        )}
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить предмет">✕</button>
        )}
      </div>
      <div className="kk-item-stats">
        {item.damageLevel && (
          <span className="kk-item-stat">{DAMAGE_LEVEL_LABEL[item.damageLevel] || item.damageLevel}</span>
        )}
        {item.damageType && (
          <span className="kk-item-stat">{DAMAGE_TYPE_LABEL[item.damageType] || item.damageType}</span>
        )}
        {item.skillName && <span className="kk-item-stat">{item.skillName}</span>}
        {item.size && <span className="kk-item-stat">{SIZE_LABEL[item.size] || item.size}</span>}
        {item.range > 0 && <span className="kk-item-stat">{item.range}м</span>}
        {item.ap > 0 && <span className="kk-item-stat">БП {item.ap}</span>}
        {item.rof > 1 && <span className="kk-item-stat">СКО {item.rof}</span>}
        {item.attackModifier !== 0 && atk && <span className="kk-item-stat">Атака {atk}</span>}
        {item.conditionChance > 0 && <span className="kk-item-stat">Поломка {item.conditionChance}%</span>}
        {item.hasStatus && item.statusName && (
          <span className="kk-item-stat kk-item-status-tag">» {item.statusName}</span>
        )}
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
