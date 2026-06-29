import { useState, useEffect, useMemo } from "react";
import { watchCampaign, watchCharacterList, watchActiveScene } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";
import PartyCard from "../components/PartyCard";
import DateWeatherPanel from "../components/DateWeatherPanel";
import ScenePreviewPanel from "../components/ScenePreviewPanel";

// FEAT-18 — Live session landing page. Rendered inside AuthGate (main.jsx),
// so `user` is always authenticated and Firestore reads are permitted.
// All subscriptions are cleaned up on unmount.
export default function LandingPage({ signOut }) {
  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [activeScene, setActiveScene] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => watchCampaign(CAMPAIGN_ID, setCampaign), []);
  useEffect(() => watchCharacterList(CAMPAIGN_ID, (list) => { setCharacters(list); setReady(true); }), []);
  useEffect(() => watchActiveScene(CAMPAIGN_ID, setActiveScene), []);

  const partyRefs = useMemo(() => new Set(campaign?.partyRefs || []), [campaign?.partyRefs]);
  const party = useMemo(
    () => characters.filter((c) => partyRefs.has(c.id)),
    [characters, partyRefs]
  );

  return (
    <div className="kk-landing">
      <header className="kk-landing-head">
        <div className="kk-landing-title">
          <span className="kk-logo">КК<span>9</span></span>
          <span className="kk-landing-campaign">{campaign?.name || "Кампания"}</span>
        </div>
        <div className="kk-landing-head-actions">
          <a className="kk-btn ghost sm" href="#/">Открыть приложение</a>
          {signOut && <button className="kk-btn ghost sm" onClick={signOut}>Выйти</button>}
        </div>
      </header>

      <div className="kk-landing-top">
        <DateWeatherPanel campaign={campaign}/>
        <ScenePreviewPanel scene={activeScene}/>
      </div>

      <section className="kk-landing-party">
        <h2 className="kk-h2">Отряд</h2>
        {!ready && <div className="kk-load">Загрузка…</div>}
        {ready && party.length === 0 && (
          <div className="kk-empty">В отряде пока никого нет.</div>
        )}
        {ready && party.length > 0 && (
          <div className="kk-party-grid">
            {party.map((ch) => <PartyCard key={ch.id} ch={ch}/>)}
          </div>
        )}
      </section>
    </div>
  );
}
