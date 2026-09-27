import { useState, useEffect, useMemo } from "react";
import { watchCampaign, watchCharacterList, watchActiveScene } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";
import LiveSession from "../components/LiveSession";
import { overlay } from "../lib/lorebook";
import { LorebookProvider, useLorebookProjection } from "../lib/useLorebook";

// FEAT-18 — Standalone live-session page (#/landing). Rendered inside AuthGate
// (main.jsx), so `user` is always authenticated and Firestore reads are
// permitted. Read-only here; the same board is also the in-app portal (App.jsx,
// where party cards are clickable). All subscriptions are cleaned up on unmount.
//
// Кампания, связанная с миром Лорбука, показывает здесь текст мира так же, как
// портал в App.jsx: сцена и гайд идут с проекцией поверх (`lib/lorebook.js`).
// Иначе отдельная страница показывала бы старую копию текста, которую мир уже
// переписал или спрятал от игроков.
export default function LandingPage({ signOut }) {
  const [campaignRaw, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [activeSceneRaw, setActiveScene] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => watchCampaign(CAMPAIGN_ID, setCampaign), []);
  useEffect(() => watchCharacterList(CAMPAIGN_ID, (list) => { setCharacters(list); setReady(true); }), []);
  useEffect(() => watchActiveScene(CAMPAIGN_ID, setActiveScene), []);

  const lore = useLorebookProjection(CAMPAIGN_ID, campaignRaw);
  const campaign = useMemo(() => overlay(campaignRaw, lore, "guide", "guide"), [campaignRaw, lore]);
  const activeScene = useMemo(
    () => (activeSceneRaw ? overlay(activeSceneRaw, lore, `scenes/${activeSceneRaw.id}`, "scene") : activeSceneRaw),
    [activeSceneRaw, lore],
  );

  const partyRefs = useMemo(() => new Set(campaign?.partyRefs || []), [campaign?.partyRefs]);
  const party = useMemo(
    () => characters.filter((c) => partyRefs.has(c.id)),
    [characters, partyRefs]
  );

  return (
    <LorebookProvider value={lore}>
    <div className="kk-landing">
      <header className="kk-landing-head">
        <div className="kk-landing-title">
          <span className="kk-logo">КК<span>9</span></span>
          {/* IMP-13 — campaign name lives in CampaignHead below; not duplicated here. */}
        </div>
        <div className="kk-landing-head-actions">
          <a className="kk-btn ghost sm" href="#/">Открыть приложение</a>
          {signOut && <button className="kk-btn ghost sm" onClick={signOut}>Выйти</button>}
        </div>
      </header>

      {!ready && <div className="kk-load">Загрузка…</div>}
      {ready && <LiveSession campaign={campaign} party={party} activeScene={activeScene}/>}
    </div>
    </LorebookProvider>
  );
}
