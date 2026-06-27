const CONDITION_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
const SUBTYPE_LABEL = { attack: "Атака", defense: "Защита", utility: "Утилита" };

export default function GearItem({ item, isGM, onDelete }) {
  return (
    <div className="kk-item kk-item-gear">
      <div className="kk-item-header">
        <span className="kk-item-icon">🎒</span>
        <span className="kk-item-name">{item.name}</span>
        {item.subtype && (
          <span className="kk-item-subtype">{SUBTYPE_LABEL[item.subtype] || item.subtype}</span>
        )}
        <span className={`kk-item-condition kk-cond-${item.condition}`}>
          {CONDITION_LABEL[item.condition] || item.condition}
        </span>
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить предмет">✕</button>
        )}
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
