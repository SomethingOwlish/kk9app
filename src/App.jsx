import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  watchCampaign, watchCharacterList, saveCharacterDebounced,
  updateCharacterNow, updateCampaignNow, clearCharacterLog,
  watchAdvancementConfig, applyAdvancement, saveAdvancementConfig,
  watchGmMode, watchStatuses,
} from "./lib/db";
import { advSettings } from "./lib/advancement";
import { enrichPatch } from "./lib/derive";
import { CAMPAIGN_ID } from "./lib/config";
import { getPath, applyOverrides, canAdvance } from "./lib/appUtils";
import "./styles/app.css";
import CharacterCard from "./components/CharacterCard";
import AdvancementDialog from "./components/AdvancementDialog";
import LogView from "./components/LogView";
import EditCard from "./components/EditCard";
import CampaignSettings from "./components/CampaignSettings";
import Menu from "./components/Menu";
import PlayerPortal from "./views/PlayerPortal";
import GmPortal from "./views/GmPortal";
import GmBoard from "./views/GmBoard";
import ScenePlayerView from "./views/ScenePlayerView";
import CharacterCreationWizard from "./components/CharacterCreationWizard";
import JournalView from "./views/JournalView";

export default function App({ user, signOut }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [overrides, setOverrides] = useState({});
  // Scopes overrides to a character ID so back/forward never applies one
  // character's unsaved changes to another character's view.
  const [overridesCharId, setOverridesCharId] = useState(null);
  const [actingAs, setActingAs] = useState("player");
  const [lastSelectedCharId, setLastSelectedCharId] = useState(null);
  const [advancementConfig, setAdvancementConfig] = useState(null);
  const [advConfigReady, setAdvConfigReady] = useState(false);
  const [gmModeData, setGmModeData] = useState(null);
  const [campaignStatuses, setCampaignStatuses] = useState([]);

  useEffect(() => watchCampaign(CAMPAIGN_ID, setCampaign), []);
  useEffect(() => watchCharacterList(CAMPAIGN_ID, (list) => { setCharacters(list); setReady(true); }), []);
  useEffect(() => watchAdvancementConfig(CAMPAIGN_ID, (cfg) => { setAdvancementConfig(cfg); setAdvConfigReady(true); }), []);
  useEffect(() => watchGmMode(CAMPAIGN_ID, setGmModeData), []);
  useEffect(() => watchStatuses(CAMPAIGN_ID, setCampaignStatuses), []);

  const cardMatch = pathname.match(/^\/card\/([^/]+)/);
  const urlCharId = cardMatch ? cardMatch[1] : null;
  const view = /^\/card\/[^/]+\/advance$/.test(pathname) ? "advance"
    : /^\/card\/[^/]+\/log$/.test(pathname) ? "log"
    : /^\/card\//.test(pathname) ? "card"
    : pathname === "/settings" ? "settings"
    : pathname === "/scene" ? "scene"
    : pathname === "/board" ? "board"
    : pathname === "/journal" ? "journal" : "portal";
  const baseRole = campaign?.members?.[user.uid];
  const isAdmin = baseRole === "admin";
  const role = isAdmin ? actingAs : baseRole;
  const isGM = role === "gm";
  const settings = advSettings(advancementConfig);
  const myChar = characters.find(c => c.ownerUid === user.uid) || null;
  const activeId = isGM ? (urlCharId || lastSelectedCharId) : myChar?.id;
  const activeChar = characters.find(c => c.id === activeId) || null;
  // Prune overrides whose values now match server state (optimistic update confirmed).
  const effectiveOverrides = useMemo(() => {
    if (overridesCharId !== activeId || !activeChar) return {};
    const next = {};
    for (const [p, v] of Object.entries(overrides)) { if (getPath(activeChar, p) !== v) next[p] = v; }
    return next;
  }, [overrides, overridesCharId, activeId, activeChar]);
  const viewCh = activeChar ? applyOverrides(activeChar, effectiveOverrides) : null;
  const canAdv = activeChar ? canAdvance(activeChar, settings) : false;

  const save = useCallback((patch) => {
    if (!activeId || !viewCh) return;
    const enriched = enrichPatch(viewCh, patch);
    setOverridesCharId(activeId);
    setOverrides(prev => ({ ...prev, ...enriched }));
    saveCharacterDebounced(CAMPAIGN_ID, activeId, enriched, 500);
  }, [activeId, viewCh]);
  const openCard = useCallback((id) => {
    setLastSelectedCharId(id); setOverridesCharId(null); setOverrides({}); setEditing(false);
    navigate(`/card/${id}`);
  }, [navigate]);
  const saveEdit = useCallback(async (rawPatch) => {
    if (!activeId || !activeChar) return;
    const patch = enrichPatch(activeChar, rawPatch);
    try { await updateCharacterNow(CAMPAIGN_ID, activeId, patch); setEditing(false); }
    catch (e) { alert("Не удалось сохранить: " + (e?.message || e)); }
  }, [activeId, activeChar]);
  const saveSettings = useCallback(async ({ advancement, chargen, rewind, journalArchiveThreshold }) => {
    try {
      const campaignPatch = { chargen };
      if (rewind) {
        campaignPatch.idleExpPerDay        = rewind.idleExpPerDay;
        campaignPatch.graduateDailyExpense = rewind.graduateDailyExpense;
        campaignPatch.salaryByGrade        = rewind.salaryByGrade;
        campaignPatch.semesterBreak1       = rewind.semesterBreak1;
        campaignPatch.semesterBreak2       = rewind.semesterBreak2;
      }
      if (journalArchiveThreshold != null) {
        campaignPatch.journalArchiveThreshold = journalArchiveThreshold;
      }
      await Promise.all([
        saveAdvancementConfig(CAMPAIGN_ID, advancement),
        updateCampaignNow(CAMPAIGN_ID, campaignPatch),
      ]);
      navigate("/");
    } catch (e) { alert("Не удалось сохранить настройки: " + (e?.message || e)); }
  }, [navigate]);
  const applyAdvance = useCallback(async (payload) => {
    if (!activeId) return;
    try {
      await applyAdvancement(CAMPAIGN_ID, activeId, payload);
      navigate(`/card/${activeId}`);
    } catch (e) { alert("Не удалось применить прокачку: " + (e?.message || e)); }
  }, [activeId, navigate]);
  const clearLog = useCallback(async () => {
    if (!activeId) return;
    try { await clearCharacterLog(CAMPAIGN_ID, activeId); }
    catch (e) { alert("Не удалось очистить: " + (e?.message || e)); }
  }, [activeId]);
  const nav = useCallback((id) => {
    setMenu(false);
    if (id === "portal") navigate("/");
    else if (id === "card") { setEditing(false); navigate(activeId ? `/card/${activeId}` : "/"); }
    else if (id === "set" && isGM) navigate("/settings");
    else if (id === "scene") navigate("/scene");
    else if (id === "gm" && isGM) navigate("/board");
    else if (id === "journal") navigate("/journal");
    else if (id === "print" && activeId) navigate(`/print/${activeId}`);
  }, [isGM, navigate, activeId]);
  const current = view === "portal" ? "portal"
    : view === "settings" ? "set"
    : view === "advance" ? "adv"
    : view === "scene" ? "scene"
    : view === "board" ? "gm"
    : view === "journal" ? "journal" : "card";
  const actAs = useCallback((r) => { setActingAs(r); setMenu(false); setEditing(false); navigate("/"); }, [navigate]);
  const partyRefs = useMemo(() => new Set(campaign?.partyRefs || []), [campaign?.partyRefs]);
  const partyMembers = useMemo(() => characters.filter(c => partyRefs.has(c.id)), [characters, partyRefs]);
  const cl = campaign !== null;
  if (view === "scene" && ready && cl) {
    return (
      <div className="kk-root">
        <div className="kk-bg" aria-hidden/>
        <ScenePlayerView isGM={isGM} onBack={() => navigate("/")}/>
        <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs}/>
      </div>
    );
  }

  return (
    <div className="kk-root">
      <div className="kk-bg" aria-hidden/>
      <button className="kk-burger kk-burger-fixed" onClick={() => setMenu(true)} aria-label="Меню"><span/><span/><span/></button>
      <div className="kk-shell">
        <div className="kk-topbar">
          <div className="kk-burger-placeholder" aria-hidden/>
          <button className="kk-logo" onClick={() => navigate("/")}>КК<span>9</span></button>
          {view !== "portal" && <button className="kk-back" onClick={() => { setEditing(false); navigate("/"); }}>← к порталу</button>}
        </div>
        {(!ready || !cl) && <div className="kk-load">Загрузка кампании…</div>}
        {ready && cl && !baseRole && <div className="kk-empty">Вы не участник этой кампании. Попросите ГМа добавить ваш UID в <code>members</code>.</div>}
        {ready && cl && role === "demo" && <ScenePlayerView/>}
        {ready && cl && role === "player" && (!myChar || myChar.characterCreated === false) && (
          <CharacterCreationWizard user={user} myChar={myChar} campaign={campaign} />
        )}
        {ready && cl && role === "player" && gmModeData?.active && view === "card" && <div className="kk-gmmode-block"><div className="kk-gmmode-block-inner"><div className="kk-gmmode-block-icon">🎬</div><div className="kk-gmmode-block-title">ГМ настраивает сцену</div><div className="kk-gmmode-block-sub">Подождите, скоро продолжим</div></div></div>}
        {ready && cl && view === "portal" && isGM && <GmPortal campaign={campaign} characters={characters} onOpen={openCard} onSettings={() => navigate("/settings")} role={baseRole}/>}
        {ready && cl && view === "board" && isGM && <GmBoard campaign={campaign} characters={characters} partyMembers={partyMembers} gmModeData={gmModeData} userUid={user.uid} onOpenChar={openCard} onSettings={() => navigate("/settings")}/>}
        {ready && cl && view === "journal" && baseRole && <JournalView isGM={isGM} campaign={campaign}/>}
        {ready && cl && view === "portal" && role === "player" && myChar?.characterCreated && <PlayerPortal campaign={campaign} characters={characters} onOpen={openCard} myUid={user.uid} role={baseRole}/>}
        {ready && cl && view === "settings" && isGM && advConfigReady && <CampaignSettings campaign={campaign} advancementConfig={advancementConfig} onSave={saveSettings} onClose={() => navigate("/")} campaignId={CAMPAIGN_ID} campaignStatuses={campaignStatuses}/>}
        {ready && view === "card" && viewCh && !editing && !(role === "player" && gmModeData?.active) && <CharacterCard ch={viewCh} save={save} isGM={isGM} user={user} canAdv={canAdv} onEdit={() => setEditing(true)} onAdvance={() => navigate(`/card/${activeId}/advance`)} onLog={() => navigate(`/card/${activeId}/log`)} campaignId={CAMPAIGN_ID} campaignStatuses={campaignStatuses}/>}
        {ready && view === "card" && viewCh && editing && isGM && <EditCard ch={activeChar} campaignId={CAMPAIGN_ID} onSave={saveEdit} onCancel={() => setEditing(false)}/>}
        {ready && view === "log" && viewCh && isGM && <LogView char={activeChar} onClose={() => navigate(`/card/${activeId}`)} onClear={clearLog}/>}
        {ready && view === "advance" && viewCh && !isGM && <AdvancementDialog ch={activeChar} settings={settings} onApply={applyAdvance} onCancel={() => navigate(`/card/${activeId}`)}/>}
        {ready && (view === "card" || view === "advance" || view === "log") && !viewCh && <div className="kk-empty">Персонаж не выбран. Вернитесь на портал.</div>}
      </div>
      {/* GM Mode overlay — blocks player UI when GM is managing the session */}
      {gmModeData?.active && !isGM && view === "card" && (
        <div className="kk-gmmode-overlay">
          <div className="kk-gmmode-overlay-box">
            <div className="kk-gmmode-overlay-icon">⚙</div>
            <div className="kk-gmmode-overlay-title">ГМ управляет сессией</div>
            <div className="kk-gmmode-overlay-sub">Подождите, пока ГМ завершит действие…</div>
            <button className="kk-back" onClick={() => navigate("/")}>← к порталу</button>
          </div>
        </div>
      )}
      <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs}/>
    </div>
  );
}
