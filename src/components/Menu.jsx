import { MENU } from "../lib/constants";

export default function Menu({ open, onClose, onNav, current, onSignOut, onSwitchCampaign, isGM, isAdmin, actingAs, onActAs, hasChar, isDemo, hasLk }) {
  // Only active links are shown — anything not currently reachable is hidden
  // entirely (no disabled "скоро" placeholders).
  const items = MENU
    .filter(m => !m.gmOnly || isGM)
    .map(m => ({ ...m, on: m.on || m.id === "scene" || (m.id === "set" && !isDemo) || (m.id === "guide" && !isDemo) || (m.id === "orgs" && !isDemo) || (m.id === "library" && !isDemo) || (m.id === "rolls" && !isDemo) || (m.id === "shop" && !isDemo) || (m.id === "lk" && hasLk) || (isGM && (m.id === "gm" || m.id === "items" || m.id === "import")) || (m.id === "adv" && hasChar && !isGM && !isDemo) || (m.id === "log" && hasChar && isGM) || (m.id === "print" && hasChar) }))
    .filter(m => m.on);
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
          <button key={m.id} className={`kk-drawer-item ${current === m.id ? "cur" : ""}`} onClick={() => onNav(m.id)}>
            <span>{m.label}</span>
          </button>
        ))}</nav>
        {onSwitchCampaign && <button className="kk-drawer-item" onClick={onSwitchCampaign}><span>↹ Сменить кампанию</span></button>}
        <button className="kk-drawer-out" onClick={onSignOut}>Выйти</button>
      </aside>
    </>
  );
}
