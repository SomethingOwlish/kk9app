import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// Searchable single/multi select sourced from a list of DB-backed options.
// Replaces Foundry-style drag&drop slots (skills, statuses, …).
//
// Props:
//   options    [{ value, label, hint? }]
//   value      single → string;  multi → string[]
//   onChange   (next) => void
//   multi      boolean (default false)
//   placeholder, emptyLabel
//   onCrosslink  optional (value) => void — adds a "↗" affordance per chosen option
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  multi = false,
  placeholder = "— выбрать —",
  emptyLabel = "Ничего не найдено",
  onCrosslink,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const panelRef = useRef(null);

  // Portal the panel to <body> so it escapes any `overflow:hidden`/low-z-index
  // ancestor (e.g. the shop's collapsible groups) that would otherwise clip it.
  const reposition = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 2, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    function onDoc(e) {
      const inControl = ref.current && ref.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inControl && !inPanel) { setOpen(false); setQ(""); }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = multi ? (Array.isArray(value) ? value : []) : value || "";
  const isSel = (v) => (multi ? selected.includes(v) : selected === v);
  const labelOf = (v) => options.find((o) => o.value === v)?.label || v;
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(q.trim().toLowerCase())
  );

  function pick(v) {
    if (multi) {
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    } else {
      onChange(v === selected ? "" : v);
      setOpen(false);
      setQ("");
    }
  }

  return (
    <div className="kk-ss" ref={ref}>
      <div className="kk-ss-control" onClick={() => setOpen((o) => !o)}>
        {multi ? (
          selected.length ? (
            <div className="kk-ss-chips">
              {selected.map((v) => (
                <span key={v} className="kk-ss-chip">
                  <span className="kk-ss-chip-label">{labelOf(v)}</span>
                  {onCrosslink && (
                    <button type="button" className="kk-ss-link" title="Открыть данные"
                      onClick={(e) => { e.stopPropagation(); onCrosslink(v); }}>↗</button>
                  )}
                  <button type="button" className="kk-ss-x" title="Убрать"
                    onClick={(e) => { e.stopPropagation(); pick(v); }}>✕</button>
                </span>
              ))}
            </div>
          ) : (
            <span className="kk-ss-ph">{placeholder}</span>
          )
        ) : selected ? (
          <span className="kk-ss-val">
            <span className="kk-ss-chip-label">{labelOf(selected)}</span>
            {onCrosslink && (
              <button type="button" className="kk-ss-link" title="Открыть данные"
                onClick={(e) => { e.stopPropagation(); onCrosslink(selected); }}>↗</button>
            )}
          </span>
        ) : (
          <span className="kk-ss-ph">{placeholder}</span>
        )}
        <span className="kk-ss-caret">{open ? "▲" : "▼"}</span>
      </div>

      {open && pos && createPortal(
        <div
          className="kk-ss-panel"
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <input
            autoFocus
            className="kk-ss-search"
            placeholder="Поиск…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="kk-ss-list">
            {!multi && selected && (
              <div className="kk-ss-opt kk-ss-clear" onClick={() => pick(selected)}>
                — очистить —
              </div>
            )}
            {filtered.length === 0 && <div className="kk-ss-empty">{emptyLabel}</div>}
            {filtered.map((o) => (
              <div
                key={o.value}
                className={`kk-ss-opt${isSel(o.value) ? " sel" : ""}`}
                onClick={() => pick(o.value)}
              >
                {multi && <input type="checkbox" readOnly checked={isSel(o.value)} tabIndex={-1} />}
                <span className="kk-ss-opt-label">{o.label}</span>
                {o.hint && <span className="kk-ss-opt-hint">{o.hint}</span>}
              </div>
            ))}
          </div>
        </div>,
        // Portal into the nearest .kk-root (not <body>) so the theme's CSS
        // custom properties cascade — otherwise --kk-surface etc. resolve to
        // nothing and the panel renders transparent/unreadable.
        ref.current?.closest(".kk-root") || document.body
      )}
    </div>
  );
}
