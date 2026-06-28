export default function FeatureItem({ item, isGM, onDelete }) {
  if (!isGM) return null;
  return (
    <div className="kk-item kk-item-feature">
      <div className="kk-item-header">
        <span className="kk-item-icon">★</span>
        <span className="kk-item-name">{item.name}</span>
        <button className="kk-note-del" onClick={onDelete} title="Удалить">✕</button>
      </div>
      {item.description && <p className="kk-item-desc">{item.description}</p>}
    </div>
  );
}
