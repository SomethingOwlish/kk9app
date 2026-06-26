export default function CampaignHead({ campaign, role }) {
  const badge = { gm: "ГМ", admin: "АДМИН", demo: "ДЕМО", player: null }[role];
  return (
    <div className="kk-campaign">
      <div className="kk-campaign-name">
        {campaign?.name || "Кампания"}
        {badge && <span className="kk-gm-badge">{badge}</span>}
      </div>
      <div className="kk-campaign-meta">
        <span>{campaign?.gameDate || "дата не задана"}</span>
        <span className="kk-sep">·</span>
        <span>{campaign?.weather || "погода не задана"}</span>
      </div>
    </div>
  );
}
