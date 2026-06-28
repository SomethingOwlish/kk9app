export default function Modal({ title, onClose, children, footer }) {
  return (
    <div className="kk-overlay" onClick={onClose}>
      <div className="kk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kk-modal-head">
          <span className="kk-modal-title">{title}</span>
          {onClose && <button className="kk-modal-x" onClick={onClose} aria-label="Close">✕</button>}
        </div>
        <div className="kk-modal-body">{children}</div>
        {footer && <div className="kk-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
