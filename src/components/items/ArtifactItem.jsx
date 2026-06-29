const CONDITION_LABEL = { perfect: "Идеальное", good: "Хорошее", worn: "Потрёпанное", broken: "Сломанное" };
const RARITY_LABEL = { common: "Обычный", uncommon: "Необычный", rare: "Редкий", unique: "Уникальный", ancient: "Древний" };
const TYPE_LABEL = {
  attack: "Атакующий", defense: "Защитный", binding: "Сковывающий",
  spatial: "Пространственный", utility: "Утилитарный", buff: "Усиливающий",
  transforming: "Трансформирующий", prophetic: "Пророческий", ring: "Кольцо",
};

export default function ArtifactItem({ item, isGM, onDelete, onEdit }) {
  const bonusEntries = item.bonuses
    ? Object.entries(item.bonuses).filter(([, v]) => v !== 0)
    : [];

  return (
    <div className={`kk-item kk-item-artifact${item.active ? " kk-item-active" : ""}${item.destroyed ? " kk-item-destroyed" : ""}`}>
      <div className="kk-item-header">
        <span className="kk-item-icon">✦</span>
        <span className="kk-item-name">{item.name}</span>
        {item.artifactType && (
          <span className="kk-item-subtype">{TYPE_LABEL[item.artifactType] || item.artifactType}</span>
        )}
        {item.rarity && (
          <span className={`kk-item-rarity kk-rarity-${item.rarity}`}>{RARITY_LABEL[item.rarity] || item.rarity}</span>
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

      {item.artifactType === "ring" && (item.ringMaterial || item.ringStone) && (
        <div className="kk-item-stats">
          {item.ringMaterial && <span className="kk-item-stat">{item.ringMaterial}</span>}
          {item.ringStone && <span className="kk-item-stat">{item.ringStone}</span>}
        </div>
      )}

      {(bonusEntries.length > 0 || (item.skillBonuses && item.skillBonuses.length > 0) || item.energyRestore > 0) && (
        <div className="kk-item-stats">
          {bonusEntries.map(([k, v]) => (
            <span key={k} className="kk-item-stat">{k} {v > 0 ? `+${v}` : v}</span>
          ))}
          {item.skillBonuses && item.skillBonuses.map((sb, i) => (
            <span key={i} className="kk-item-stat">{sb.skillName} {sb.bonus > 0 ? `+${sb.bonus}` : sb.bonus}</span>
          ))}
          {item.energyRestore > 0 && <span className="kk-item-stat">+{item.energyRestore} энергии</span>}
        </div>
      )}

      {item.active && <div className="kk-item-active-badge">Активен</div>}
      {item.destroyed && <div className="kk-item-destroyed-badge">Уничтожен</div>}

      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
