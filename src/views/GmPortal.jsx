import CampaignHead from "../components/CampaignHead";

export default function GmPortal({ campaign, characters, onOpen, onSettings, role }) {
  return (
    <div className="kk-portal">
      <CampaignHead campaign={campaign} role={role}/>
      <div className="kk-gm-actions">
        <button className="kk-big" onClick={onSettings}>
          <span className="kk-big-t">⚙ Настройки кампании</span>
          <span className="kk-big-s">стоимость прокачки</span>
        </button>
      </div>
      <div className="kk-party-label">Игроки · {characters.length}</div>
      {characters.length === 0 && <div className="kk-empty">В кампании ещё нет персонажей.</div>}
      <div className="kk-party">{characters.map(p => {
        const col = p.faculty?.color || "#c8a14e";
        return (
          <button key={p.id} className="kk-party-card" style={{ ["--fac-color"]: col }} onClick={() => onOpen(p.id)}>
            <span className="kk-party-av">{(p.name || "?").slice(0, 1)}</span>
            <span className="kk-party-name">{p.name}</span>
            <span className="kk-party-sub">{p.faculty?.name || "без факультета"}</span>
          </button>
        );
      })}</div>
    </div>
  );
}
