import Badge from "./Badge";

export default function CampaignCard({ name, system, playerCount, isGM, status, onClick }) {
  return (
    <div className="kk-campaign" style={{ cursor: onClick ? "pointer" : undefined }} onClick={onClick}>
      <div className="kk-campaign-name">
        {name}
        {isGM && <Badge variant="gold">GM</Badge>}
      </div>
      <div className="kk-campaign-meta">
        {system && <span>{system}</span>}
        {playerCount != null && <><span>·</span><span>{playerCount} players</span></>}
        {status && <><span>·</span><span>{status}</span></>}
      </div>
    </div>
  );
}
