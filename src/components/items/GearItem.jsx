const CONDITION_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
const GEAR_TYPE_LABEL = { attack: "Атака", defense: "Защита", utility: "Утилита" };
const DAMAGE_LEVEL_LABEL = { light: "Лёгкий", heavy: "Тяжёлый", lethal: "Летальный" };

export default function GearItem({ item, isGM, onDelete, onEdit }) {
  const hasSoakAbsolute = item.soakType === "absolute" && item.soakAbsoluteCapacity > 0;
  const hasSoakBonus = item.soakType === "bonus" && (item.soakBonusDie > 0 || item.soakBonusModifier !== 0);
  const hasAttack = item.gearType === "attack" || !!item.skillName;
  const atk = item.attackModifier > 0 ? `+${item.attackModifier}` : item.attackModifier < 0 ? `${item.attackModifier}` : "";

  return (
    <div className="kk-item kk-item-gear">
      <div className="kk-item-header">
        <span className="kk-item-icon">🎒</span>
        <span className="kk-item-name">{item.name}</span>
        {item.gearType && (
          <span className="kk-item-subtype">{GEAR_TYPE_LABEL[item.gearType] || item.gearType}</span>
        )}
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
        {item.quantity > 1 && <span className="kk-item-stat">×{item.quantity}</span>}
        {item.energyRestore > 0 && <span className="kk-item-stat">+{item.energyRestore} энергии</span>}
        {hasSoakAbsolute && (
          <span className="kk-item-stat">Поглощение {item.soakAbsoluteCurrent}/{item.soakAbsoluteCapacity}</span>
        )}
        {hasSoakBonus && (
          <span className="kk-item-stat">
            Бонус поглощения {item.soakBonusDie > 0 ? `d${item.soakBonusDie}` : ""}{item.soakBonusModifier > 0 ? `+${item.soakBonusModifier}` : item.soakBonusModifier < 0 ? `${item.soakBonusModifier}` : ""}
          </span>
        )}
        {item.healthBufferPip > 0 && (
          <span className="kk-item-stat">Здоровье +{item.healthBufferPip}</span>
        )}
        {hasAttack && item.damageLevel && (
          <span className="kk-item-stat">{DAMAGE_LEVEL_LABEL[item.damageLevel] || item.damageLevel}</span>
        )}
        {hasAttack && item.skillName && (
          <span className="kk-item-stat">{item.skillName}</span>
        )}
        {hasAttack && item.attackModifier !== 0 && atk && (
          <span className="kk-item-stat">Атака {atk}</span>
        )}
        {item.hasStatus && item.statusName && (
          <span className="kk-item-stat kk-item-status-tag">» {item.statusName}</span>
        )}
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
