import { useState, useEffect, useRef } from "react";

export default function Tip({ text, children, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const c = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", c);
    return () => document.removeEventListener("pointerdown", c);
  }, [open]);

  useEffect(() => {
    if (!open || !popRef.current) return;
    const rect = popRef.current.getBoundingClientRect();
    const margin = 8;
    if (rect.left < margin) {
      popRef.current.style.transform = `translateX(calc(-50% + ${margin - rect.left}px))`;
    } else if (rect.right > window.innerWidth - margin) {
      popRef.current.style.transform = `translateX(calc(-50% - ${rect.right - window.innerWidth + margin}px))`;
    }
  }, [open]);

  return (
    <span ref={ref} className="kk-tip"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
      tabIndex={0} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      aria-label={typeof text === "string" ? text : label}>
      {children}
      {open && <span ref={popRef} className="kk-tip-pop" role="tooltip">{text}</span>}
    </span>
  );
}
