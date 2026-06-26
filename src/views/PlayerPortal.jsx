import CampaignHead from "../components/CampaignHead";

export default function PlayerPortal({ campaign, characters, onOpen, myUid, role }) {
  return (
    <div className="kk-portal">
      <CampaignHead campaign={campaign} role={role}/>
      <div className="kk-party-label">Отряд</div>
      <div className="kk-party">{characters.map(p => {
        const self = p.ownerUid === myUid;
        const col = p.faculty?.color || "#c8a14e";
        return (
          <button key={p.id} className={`kk-party-card ${self ? "self" : ""}`} style={{ ["--fac-color"]: col }}
            onClick={() => self && onOpen(p.id)} disabled={!self}>
            <span className="kk-party-av">{(p.name || "?").slice(0, 1)}</span>
            <span className="kk-party-name">{p.name}</span>
            {self && <span className="kk-party-you">это вы</span>}
          </button>
        );
      })}</div>
    </div>
  );
}
