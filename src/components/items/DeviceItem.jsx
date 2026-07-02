const CONDITION_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
const DEVICE_TYPE_LABEL = { gadget: "Гаджет", weapon: "Оружие", drone: "Дрон", computer: "Компьютер", medical: "Медицинское", other: "Прочее" };

export default function DeviceItem({ item, isGM, onDelete, onEdit, onUpdateCharges }) {
  return (
    <div className="kk-item kk-item-device">
      <div className="kk-item-header">
        <span className="kk-item-icon">⚙</span>
        <span className="kk-item-name">{item.name}</span>
        {item.deviceType && <span className="kk-item-subtype">{DEVICE_TYPE_LABEL[item.deviceType] || item.deviceType}</span>}
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
        {item.worksUpper !== undefined && (
          <span className={`kk-item-stat${item.worksUpper ? "" : " kk-item-stat-muted"}`} title="Работает в Верхнем городе">
            {item.worksUpper ? "✓ Верхний" : "✗ Верхний"}
          </span>
        )}
        {item.worksLower !== undefined && (
          <span className={`kk-item-stat${item.worksLower ? "" : " kk-item-stat-muted"}`} title="Работает в Нижнем городе">
            {item.worksLower ? "✓ Нижний" : "✗ Нижний"}
          </span>
        )}
        {item.charges !== undefined && item.charges !== null && (
          <span className="kk-item-stat kk-device-charges">
            {item.charges === -1 ? "∞ зарядов" : `Заряды: ${item.charges}${item.maxCharges > 0 ? ` / ${item.maxCharges}` : ""}`}
            {onUpdateCharges && item.charges !== -1 && (
              <>
                <button className="kk-charge-btn" onClick={() => onUpdateCharges(item.charges - 1)} disabled={item.charges <= 0}>−</button>
                <button className="kk-charge-btn" onClick={() => onUpdateCharges(item.charges + 1)}>+</button>
              </>
            )}
          </span>
        )}
        {item.bonusSkillName && <span className="kk-item-stat">+{item.bonusValue || 1} {item.bonusSkillName}</span>}
        {item.creator && <span className="kk-item-stat kk-item-stat-muted">{item.creator}</span>}
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
