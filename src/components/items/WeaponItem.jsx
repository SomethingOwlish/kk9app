const CONDITION_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };

export default function WeaponItem({ item, isGM, onDelete }) {
  const mod = item.modifier > 0 ? `+${item.modifier}` : item.modifier < 0 ? `${item.modifier}` : "";
  const atk = item.attackModifier > 0 ? `+${item.attackModifier}` : item.attackModifier < 0 ? `${item.attackModifier}` : "";
  return (
    <div className="kk-item kk-item-weapon">
      <div className="kk-item-header">
        <span className="kk-item-icon">⚔</span>
        <span className="kk-item-name">{item.name}</span>
        <span className={`kk-item-condition kk-cond-${item.condition}`}>
          {CONDITION_LABEL[item.condition] || item.condition}
        </span>
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить предмет">✕</button>
        )}
      </div>
      <div className="kk-item-stats">
        <span className="kk-item-stat">d{item.die}{mod}</span>
        {item.attackModifier !== 0 && <span className="kk-item-stat">Атака {atk}</span>}
        {item.damageType && <span className="kk-item-stat">{item.damageType}</span>}
        {item.damageLevel && <span className="kk-item-stat">{item.damageLevel}</span>}
        {item.statusOnHit?.name && <span className="kk-item-stat kk-item-status-tag">» {item.statusOnHit.name}</span>}
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
