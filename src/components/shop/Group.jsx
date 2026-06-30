import { useState } from "react";

// Collapsible group used across the shop (buy stock + sell list). Expanded by
// default; the whole header toggles. Each item type renders as its own group so
// the lists stay organised and every group can be folded away independently.
export default function Group({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="kk-shop-group">
      <button className="kk-shop-group-head" onClick={() => setOpen((v) => !v)}>
        <span className="kk-shop-group-caret">{open ? "▾" : "▸"}</span>
        <span className="kk-shop-group-title">{title}</span>
        {count != null && <span className="kk-count">{count}</span>}
      </button>
      {open && <div className="kk-shop-group-body">{children}</div>}
    </div>
  );
}
