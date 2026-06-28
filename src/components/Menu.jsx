import { MENU } from "../lib/constants";

export default function Menu({ open, onClose, onNav, current, onSignOut, isGM, isAdmin, actingAs, onActAs, hasChar, isDemo }) {
  const items = MENU
    .filter(m => !m.gmOnly || isGM)
    .map(m => ({ ...m, on: m.on || m.id === "scene" || (m.id === "set" && !isDemo) || (isGM && (m.id === "gm" || m.id === "items")) || (m.id === "print" && hasChar) }));
  return (
    <>
      <div className={`kk-scrim ${open ? "show" : ""}`} onClick={onClose} aria-hidden/>
      <aside className={`kk-drawer ${open ? "show" : ""}`} aria-hidden={!open}>
        <div className="kk-drawer-head">
          <span>Навигация</span>
          <button className="kk-drawer-x" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        {isAdmin && (
          <div className="kk-role-switch">
            <div className="kk-role-label">Режим админа</div>
            <div className="kk-role-btns">{[["gm", "ГМ"], ["player", "Игрок"], ["demo", "Демо"]].map(([id, lbl]) => (
              <button key={id} className={`kk-role-btn ${actingAs === id ? "on" : ""}`} onClick={() => onActAs(id)}>{lbl}</button>
            ))}</div>
          </div>
        )}
        <nav className="kk-drawer-nav">{items.map(m => (
          <button key={m.id} disabled={!m.on} className={`kk-drawer-item ${current === m.id ? "cur" : ""} ${m.on ? "" : "soon"}`} onClick={() => m.on && onNav(m.id)}>
            <span>{m.label}</span>{!m.on && <em>скоро</em>}
          </button>
        ))}</nav>
        <button className="kk-drawer-out" onClick={onSignOut}>Выйти</button>
      </aside>
    </>
  );
}
