import { useState } from "react";

// Purchase confirm dialog (FEAT-17, TASK-088). For stackable items the quantity is
// bounded by 1..min(remaining, money/price); unique items are quantity 1.
export default function PurchaseDialog({ target, money, onConfirm, onCancel }) {
  const { name, price, max } = target;
  const [qty, setQty] = useState(1);
  const cap = Math.max(1, max);
  const clamped = Math.min(Math.max(1, qty || 1), cap);
  const total = price * clamped;
  const afford = money >= total;

  return (
    <div className="kk-modal-backdrop" onClick={onCancel}>
      <div className="kk-modal kk-shop-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="kk-modal-head">
          <span className="kk-modal-title">Покупка</span>
          <button className="kk-modal-x" onClick={onCancel} aria-label="Закрыть">✕</button>
        </div>
        <div className="kk-shop-dialog-body">
          <div className="kk-shop-dialog-name">{name}</div>
          {max > 1 && (
            <label className="kk-sc-field">
              <span>Количество (макс. {cap})</span>
              <input
                className="kk-input" type="number" min={1} max={cap} value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </label>
          )}
          <div className="kk-shop-dialog-total">
            Итого: <b>◈ {total}</b> {!afford && <span className="kk-shop-err">— не хватает денег</span>}
          </div>
        </div>
        <div className="kk-modal-foot">
          <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
          <button className="kk-btn primary" disabled={!afford} onClick={() => onConfirm(clamped)}>
            Купить за ◈ {total}
          </button>
        </div>
      </div>
    </div>
  );
}
