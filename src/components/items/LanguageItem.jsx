const WORLD_LABEL = { upper: "Верхний мир", lower: "Нижний мир", both: "Оба мира", mystic: "Мистический" };

export default function LanguageItem({ item, isGM, onDelete }) {
  return (
    <div className="kk-item kk-item-language">
      <div className="kk-item-header">
        <span className="kk-item-icon">🗣</span>
        <span className="kk-item-name">{item.name}</span>
        {item.world && <span className="kk-item-subtype">{WORLD_LABEL[item.world] || item.world}</span>}
        {item.isDead && <span className="kk-item-stat">Мёртвый</span>}
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить">✕</button>
        )}
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
