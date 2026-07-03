import CampaignHead from "./CampaignHead";
import DateWeatherPanel from "./DateWeatherPanel";
import ScenePreviewPanel from "./ScenePreviewPanel";
import SessionPanel from "./SessionPanel";
import PartyCard from "./PartyCard";

// FEAT-18 — Live session board. Used both as the in-app portal (App.jsx) and
// the standalone #/landing route (LandingPage.jsx). Presentational: data and
// the open-character handler are passed in.
//   canOpen(ch) -> whether clicking the card opens that character.
export default function LiveSession({ campaign, party = [], activeScene, role, isGM = false, onOpen, canOpen, onSettings }) {
  const openable = (ch) => onOpen && (canOpen ? canOpen(ch) : true);
  return (
    <div className="kk-portal kk-live">
      <CampaignHead campaign={campaign} role={role}/>
      {isGM && onSettings && (
        <div className="kk-gm-actions">
          <button className="kk-big" onClick={onSettings}>
            <span className="kk-big-t">⚙ Настройки кампании</span>
            <span className="kk-big-s">стоимость прокачки</span>
          </button>
        </div>
      )}
      {/* IMP-13 — scene banner full-width; date/weather + session side by side. */}
      <ScenePreviewPanel scene={activeScene}/>
      <div className="kk-landing-top">
        <DateWeatherPanel campaign={campaign}/>
        <SessionPanel campaign={campaign}/>
      </div>
      <section className="kk-landing-party">
        <h2 className="kk-h2">Отряд</h2>
        {party.length === 0 && <div className="kk-empty">В отряде пока никого нет.</div>}
        {party.length > 0 && (
          <div className="kk-party-grid">
            {party.map((ch) => (
              <PartyCard
                key={ch.id}
                ch={ch}
                onOpen={openable(ch) ? () => onOpen(ch.id) : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
