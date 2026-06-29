// FEAT-18 — campaign date / weather / world note for the landing page.
export default function DateWeatherPanel({ campaign }) {
  return (
    <div className="kk-landing-panel kk-dw-panel">
      <div className="kk-dw-row">
        <span className="kk-dw-label">Дата</span>
        <span className="kk-dw-val">{campaign?.gameDate || "не задана"}</span>
      </div>
      <div className="kk-dw-row">
        <span className="kk-dw-label">Погода</span>
        <span className="kk-dw-val">{campaign?.weather || "не задана"}</span>
      </div>
      {campaign?.worldNote && (
        <div className="kk-dw-note">{campaign.worldNote}</div>
      )}
    </div>
  );
}
