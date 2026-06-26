import { useState, useEffect, useRef } from "react";

export default function Tip({ text, children, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const c = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", c);
    return () => document.removeEventListener("pointerdown", c);
  }, [open]);
  return (
    <span ref={ref} className="kk-tip"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      tabIndex={0} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      aria-label={typeof text === "string" ? text : label}>
      {children}
      {open && <span className="kk-tip-pop" role="tooltip">{text}</span>}
    </span>
  );
}
