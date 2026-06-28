const CONDITION_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };

export default function DeviceItem({ item, isGM, onDelete, onUpdateCharges }) {
  return (
    <div className="kk-item kk-item-device">
      <div className="kk-item-header">
        <span className="kk-item-icon">⚙</span>
        <span className="kk-item-name">{item.name}</span>
        {item.deviceType && <span className="kk-item-subtype">{item.deviceType}</span>}
        <span className={`kk-item-condition kk-cond-${item.condition}`}>
          {CONDITION_LABEL[item.condition] || item.condition}
        </span>
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить предмет">✕</button>
        )}
      </div>
      <div className="kk-item-stats">
        {item.charges !== undefined && item.charges !== null && (
          <span className="kk-item-stat kk-device-charges">
            Заряды: {item.charges}
            {onUpdateCharges && (
              <>
                <button className="kk-charge-btn" onClick={() => onUpdateCharges(item.charges - 1)} disabled={item.charges <= 0}>−</button>
                <button className="kk-charge-btn" onClick={() => onUpdateCharges(item.charges + 1)}>+</button>
              </>
            )}
          </span>
        )}
        {item.bonusSkillName && <span className="kk-item-stat">+{item.bonusValue || 1} {item.bonusSkillName}</span>}
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
