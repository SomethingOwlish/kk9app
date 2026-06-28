export default function LanguageItem({ item, isGM, onDelete }) {
  return (
    <div className="kk-item kk-item-language">
      <div className="kk-item-header">
        <span className="kk-item-icon">🗣</span>
        <span className="kk-item-name">{item.name}</span>
        {isGM && (
          <button className="kk-note-del" onClick={onDelete} title="Удалить">✕</button>
        )}
      </div>
    </div>
  );
}
