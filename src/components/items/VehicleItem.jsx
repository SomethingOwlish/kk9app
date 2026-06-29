const VEHICLE_TYPE_LABEL = { ground: "Наземный", air: "Воздушный", water: "Водный", magical: "Магический", other: "Прочий" };

export default function VehicleItem({ item, isGM, onDelete, onEdit }) {
  return (
    <div className="kk-item kk-item-vehicle">
      <div className="kk-item-header">
        <span className="kk-item-icon">🚗</span>
        <span className="kk-item-name">{item.name}</span>
        {item.vehicleType && <span className="kk-item-subtype">{VEHICLE_TYPE_LABEL[item.vehicleType] || item.vehicleType}</span>}
        {isGM && onEdit && (
          <button className="kk-item-edit-btn" onClick={onEdit} title="Редактировать">✎</button>
        )}
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить предмет">✕</button>
        )}
      </div>
      <div className="kk-item-stats">
        {item.speed !== undefined && <span className="kk-item-stat">Скорость {item.speed}</span>}
        {item.toughness !== undefined && <span className="kk-item-stat">Стойкость {item.toughness}</span>}
        {item.capacity !== undefined && <span className="kk-item-stat">Вместимость {item.capacity}</span>}
      </div>
      {item.notes && <p className="kk-item-desc">{item.notes}</p>}
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
