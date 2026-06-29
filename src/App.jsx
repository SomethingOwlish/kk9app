import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  watchCampaign, watchCharacterList, saveCharacterDebounced,
  updateCharacterNow, updateCampaignNow, clearCharacterLog,
  watchAdvancementConfig, applyAdvancement, saveAdvancementConfig,
  watchGmMode, watchStatuses, seedStatuses, watchNpcs, watchActiveScene,
  watchItemsByOwner, watchAllItems, createItem, deleteItem, updateItem,
  assignItem, unassignItem, addLanguageToChar, saveBioFields,
  watchOrganizations, createOrganization, updateOrganization, deleteOrganization,
  linkCharToOrg, unlinkCharToOrg, setCharOrgLevel, applyRollOutcome,
} from "./lib/db";
import { STATUSES_DATA } from "./lib/seed-statuses";
import { advSettings } from "./lib/advancement";
import { enrichPatch } from "./lib/derive";
import { CAMPAIGN_ID } from "./lib/config";
import { getPath, applyOverrides, canAdvance } from "./lib/appUtils";
import { loadPrefs, savePref } from "./lib/userPrefs";
import "./styles/app.css";
import "./styles/theme-explorer.css";
import "./styles/tier2.css";
import CharacterCard from "./components/CharacterCard";
import AdvancementDialog from "./components/AdvancementDialog";
import LogView from "./components/LogView";
import EditCard from "./components/EditCard";
import BioEditCard from "./components/BioEditCard";
import CampaignSettings from "./components/CampaignSettings";
import Menu from "./components/Menu";
import LiveSession from "./components/LiveSession";
import GmBoard from "./views/GmBoard";
import ScenePlayerView from "./views/ScenePlayerView";
import CharacterCreationWizard from "./components/CharacterCreationWizard";
import JournalView from "./views/JournalView";
import ItemsView from "./views/ItemsView";
import GuideView from "./views/GuideView";
import OrganizationsView from "./views/OrganizationsView";
import RollLogView from "./views/RollLogView";

export default function App({ user, signOut }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [theme, setTheme] = useState(() => loadPrefs(user.uid).theme || "original");
  const saveTheme = useCallback((t) => { setTheme(t); savePref(user.uid, "theme", t); }, [user.uid]);
  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  // Player/GM bio (anketa) edit modal — kept separate from the full GM EditCard.
  const [editingBio, setEditingBio] = useState(false);
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
  const [npcs, setNpcs] = useState([]);
  const [activeScene, setActiveScene] = useState(null);
  const [activeItems, setActiveItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [orgs, setOrgs] = useState([]);

  useEffect(() => watchCampaign(CAMPAIGN_ID, setCampaign), []);
  useEffect(() => watchCharacterList(CAMPAIGN_ID, (list) => { setCharacters(list); setReady(true); }), []);
  useEffect(() => watchAdvancementConfig(CAMPAIGN_ID, (cfg) => { setAdvancementConfig(cfg); setAdvConfigReady(true); }), []);
  useEffect(() => watchGmMode(CAMPAIGN_ID, setGmModeData), []);
  useEffect(() => watchNpcs(CAMPAIGN_ID, setNpcs), []);
  useEffect(() => watchActiveScene(CAMPAIGN_ID, setActiveScene), []);
  useEffect(() => watchAllItems(CAMPAIGN_ID, setAllItems), []);
  // Re-subscribe when GM status resolves: players must query visible-only (rules).
  useEffect(() => watchStatuses(CAMPAIGN_ID, (statuses) => {
    setCampaignStatuses(statuses);
    if (statuses.length === 0) seedStatuses(CAMPAIGN_ID, STATUSES_DATA).catch(console.error);
  }), []);

  const cardMatch = pathname.match(/^\/card\/([^/]+)/);
  const urlCharId = cardMatch ? cardMatch[1] : null;
  const view = /^\/card\/[^/]+\/advance$/.test(pathname) ? "advance"
    : /^\/card\/[^/]+\/log$/.test(pathname) ? "log"
    : /^\/card\//.test(pathname) ? "card"
    : pathname === "/settings" ? "settings"
    : pathname === "/scene" ? "scene"
    : pathname === "/board" ? "board"
    : pathname === "/journal" ? "journal"
    : pathname === "/guide" ? "guide"
    : pathname === "/orgs" ? "orgs"
    : pathname === "/rolls" ? "rolls"
    : pathname === "/items" ? "items" : "portal";
  const baseRole = campaign?.members?.[user.uid];
  const isAdmin = baseRole === "admin";
  const role = isAdmin ? actingAs : baseRole;
  const isGM = role === "gm";
  const settings = advSettings(advancementConfig);
  const myChar = characters.find(c => c.ownerUid === user.uid) || null;
  const activeId = isGM ? (urlCharId || lastSelectedCharId) : myChar?.id;
  const activeChar = characters.find(c => c.id === activeId) || null;
  // Subscribe to items for the currently-open character.
  useEffect(() => {
    if (!activeId) return;
    return watchItemsByOwner(CAMPAIGN_ID, activeId, setActiveItems);
  }, [activeId]);
  // Prune overrides whose values now match server state (optimistic update confirmed).
  const effectiveOverrides = useMemo(() => {
    if (overridesCharId !== activeId || !activeChar) return {};
    const next = {};
    for (const [p, v] of Object.entries(overrides)) { if (getPath(activeChar, p) !== v) next[p] = v; }
    return next;
  }, [overrides, overridesCharId, activeId, activeChar]);
  const viewCh = activeChar ? applyOverrides(activeChar, effectiveOverrides) : null;
  const canAdv = activeChar ? canAdvance(activeChar, settings) : false;
  // Relations ref-picker source: all chars + npcs except the open one.
  const peers = useMemo(
    () => [...characters, ...npcs]
      .filter(c => c.id !== activeId)
      .map(c => ({ id: c.id, name: c.name, portrait: c.portrait })),
    [characters, npcs, activeId],
  );
  // Players (incl. admin acting-as-player) only see organizations marked visible.
  const orgsForView = useMemo(() => isGM ? orgs : orgs.filter(o => o.visibleToPlayers), [orgs, isGM]);
  const ownChar = !!(activeChar && user && activeChar.ownerUid === user.uid);
  const canRoll = role !== "demo" && (isGM || ownChar);
  // Players must query visible-only orgs (collection listener is denied otherwise).
  useEffect(() => watchOrganizations(CAMPAIGN_ID, setOrgs, !isGM), [isGM]);

  const save = useCallback((patch) => {
    if (!activeId || !viewCh) return;
    const enriched = enrichPatch(viewCh, patch);
    setOverridesCharId(activeId);
    setOverrides(prev => ({ ...prev, ...enriched }));
    saveCharacterDebounced(CAMPAIGN_ID, activeId, enriched, 500);
  }, [activeId, viewCh]);
  const openCard = useCallback((id) => {
    setLastSelectedCharId(id); setOverridesCharId(null); setOverrides({}); setEditing(false); setEditingBio(false);
    navigate(`/card/${id}`);
  }, [navigate]);
  const saveBio = useCallback(async (fields, changed) => {
    if (!activeId) return;
    // Errors propagate to BioEditCard, which renders them inline.
    await saveBioFields(CAMPAIGN_ID, activeId, fields, changed);
    setEditingBio(false);
  }, [activeId]);
  const saveEdit = useCallback(async (rawPatch) => {
    if (!activeId || !activeChar) return;
    const patch = enrichPatch(activeChar, rawPatch);
    try { await updateCharacterNow(CAMPAIGN_ID, activeId, patch); setEditing(false); }
    catch (e) { alert("Не удалось сохранить: " + (e?.message || e)); }
  }, [activeId, activeChar]);
  const saveSettings = useCallback(async ({ advancement, chargen, rewind, journalArchiveThreshold, extra }) => {
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
      if (extra) {
        campaignPatch.tension = extra.tension;
        campaignPatch.shop    = extra.shop;
        campaignPatch.scene   = extra.scene;
        campaignPatch.combat  = extra.combat;
        campaignPatch.magic   = extra.magic;
        campaignPatch.lk      = extra.lk;
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
  const onCreateItem = useCallback(async (data) => {
    if (!activeId) return;
    const COPY_ITEM_TYPES = new Set(["weapon", "gear", "spell", "device", "vehicle"]);
    if (COPY_ITEM_TYPES.has(data.type)) {
      await createItem(CAMPAIGN_ID, { ...data, ownerCharacterId: null });
    }
    await createItem(CAMPAIGN_ID, { ...data, ownerCharacterId: activeId });
  }, [activeId]);
  const onDeleteItem = useCallback(async (itemId) => {
    await deleteItem(CAMPAIGN_ID, itemId);
  }, []);
  const onUpdateItem = useCallback(async (itemId, data) => {
    await updateItem(CAMPAIGN_ID, itemId, data);
  }, []);
  const onAssignItem = useCallback(async (item, charId, itemType) => {
    await assignItem(CAMPAIGN_ID, item.id, charId, itemType, item);
  }, []);
  const onUnassignItem = useCallback(async (itemId, charId, itemType) => {
    await unassignItem(CAMPAIGN_ID, itemId, charId, itemType);
  }, []);
  const onAddLanguage = useCallback(async (charId, entry) => {
    await addLanguageToChar(CAMPAIGN_ID, charId, entry);
  }, []);
  // Persist a roll: merged status-tick + tension patch, then roll-log entry.
  const onCommitRoll = useCallback(async ({ charId, rollData, outcome, exhaustionInstance, charPatch }) => {
    const snapshot = characters.find(c => c.id === charId) || activeChar;
    if (!snapshot) return;
    try {
      await applyRollOutcome(CAMPAIGN_ID, charId, snapshot, { outcome, exhaustionInstance, rollData, charPatch });
    } catch (e) { alert("Не удалось сохранить бросок: " + (e?.message || e)); }
  }, [characters, activeChar]);
  const onLinkOrg = useCallback(async (ch, orgId) => {
    try { await linkCharToOrg(CAMPAIGN_ID, ch.id, ch.name || "", orgId, 0); }
    catch (e) { alert("Не удалось привязать организацию: " + (e?.message || e)); }
  }, []);
  const onUnlinkOrg = useCallback(async (charId, orgId) => {
    try { await unlinkCharToOrg(CAMPAIGN_ID, charId, orgId); }
    catch (e) { alert("Не удалось отвязать: " + (e?.message || e)); }
  }, []);
  const onSetOrgLevel = useCallback(async (charId, orgId, level) => {
    await setCharOrgLevel(CAMPAIGN_ID, charId, orgId, level).catch(console.error);
  }, []);
  const onCreateOrg = useCallback(async () => {
    await createOrganization(CAMPAIGN_ID, {}).catch(e => alert("Ошибка: " + (e?.message || e)));
  }, []);
  const onUpdateOrg = useCallback(async (orgId, patch) => {
    await updateOrganization(CAMPAIGN_ID, orgId, patch).catch(console.error);
  }, []);
  const onDeleteOrg = useCallback(async (orgId) => {
    await deleteOrganization(CAMPAIGN_ID, orgId).catch(e => alert("Ошибка: " + (e?.message || e)));
  }, []);
  const onCreateCatalogItem = useCallback(async (data) => {
    await createItem(CAMPAIGN_ID, data);
  }, []);
  const onDeleteCatalogItem = useCallback(async (itemId) => {
    await deleteItem(CAMPAIGN_ID, itemId);
  }, []);
  const saveGuide = useCallback(async (markdown) => {
    await updateCampaignNow(CAMPAIGN_ID, { guideMarkdown: markdown });
  }, []);
  const clearLog = useCallback(async () => {
    if (!activeId) return;
    try { await clearCharacterLog(CAMPAIGN_ID, activeId); }
    catch (e) { alert("Не удалось очистить: " + (e?.message || e)); }
  }, [activeId]);
  const nav = useCallback((id) => {
    setMenu(false);
    if (id === "portal") navigate("/");
    else if (id === "card") { setEditing(false); navigate(activeId ? `/card/${activeId}` : "/"); }
    else if (id === "set" && role !== "demo") navigate("/settings");
    else if (id === "scene") navigate("/scene");
    else if (id === "gm" && isGM) navigate("/board");
    else if (id === "journal") navigate("/journal");
    else if (id === "guide" && role !== "demo") navigate("/guide");
    else if (id === "lk" && campaign?.lk?.projectUrl) window.open(campaign.lk.projectUrl, "_blank", "noopener,noreferrer");
    else if (id === "items" && isGM) navigate("/items");
    else if (id === "orgs" && role !== "demo") navigate("/orgs");
    else if (id === "rolls" && role !== "demo") navigate("/rolls");
    else if (id === "print" && activeId) navigate(`/print/${activeId}`);
  }, [isGM, role, navigate, activeId, campaign]);
  const current = view === "portal" ? "portal"
    : view === "settings" ? "set"
    : view === "advance" ? "adv"
    : view === "scene" ? "scene"
    : view === "board" ? "gm"
    : view === "journal" ? "journal"
    : view === "guide" ? "guide"
    : view === "orgs" ? "orgs"
    : view === "rolls" ? "rolls"
    : view === "items" ? "items" : "card";
  const actAs = useCallback((r) => { setActingAs(r); setMenu(false); setEditing(false); navigate("/"); }, [navigate]);
  const partyRefs = useMemo(() => new Set(campaign?.partyRefs || []), [campaign?.partyRefs]);
  const partyMembers = useMemo(() => characters.filter(c => partyRefs.has(c.id)), [characters, partyRefs]);
  const cl = campaign !== null;
  const themeClass = theme !== "original" ? ` te-theme-${theme}` : "";
  if (view === "scene" && ready && cl) {
    return (
      <div className={`kk-root${themeClass}`}>
        <div className="kk-bg" aria-hidden/>
        <ScenePlayerView isGM={isGM} onBack={() => navigate("/")}/>
        {!isGM && (
          <button className="kk-burger kk-burger-fixed" onClick={() => setMenu(true)} aria-label="Меню">
            <span/><span/><span/>
          </button>
        )}
        <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs} isDemo={role === "demo"} hasLk={!!campaign?.lk?.projectUrl}/>
      </div>
    );
  }

  return (
    <div className={`kk-root${themeClass}`}>
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
        {ready && cl && view === "portal" && isGM && <LiveSession campaign={campaign} party={partyMembers} activeScene={activeScene} role={baseRole} isGM onOpen={openCard} canOpen={() => true} onSettings={() => navigate("/settings")}/>}
        {ready && cl && view === "board" && isGM && <GmBoard campaign={campaign} characters={characters} partyMembers={partyMembers} gmModeData={gmModeData} userUid={user.uid} onOpenChar={openCard} onSettings={() => navigate("/settings")} npcs={npcs} campaignStatuses={campaignStatuses}/>}
        {ready && cl && view === "journal" && baseRole && <JournalView isGM={isGM} campaign={campaign}/>}
        {ready && cl && view === "orgs" && baseRole && role !== "demo" && <OrganizationsView orgs={orgsForView} isGM={isGM} onCreate={onCreateOrg} onUpdate={onUpdateOrg} onDelete={onDeleteOrg} onUnlinkChar={onUnlinkOrg}/>}
        {ready && cl && view === "rolls" && baseRole && role !== "demo" && <RollLogView campaignId={CAMPAIGN_ID} isGM={isGM}/>}
        {ready && cl && view === "guide" && baseRole && role !== "demo" && <GuideView campaign={campaign} canEdit={isGM || isAdmin} onSave={saveGuide}/>}
        {ready && cl && view === "guide" && role === "demo" && <div className="kk-empty">Раздел недоступен в демо-режиме.</div>}
        {ready && cl && view === "items" && isGM && <ItemsView items={allItems} characters={[...characters, ...npcs]} statuses={campaignStatuses} onCreateItem={onCreateCatalogItem} onDeleteItem={onDeleteCatalogItem} onUpdateItem={onUpdateItem} onAssign={onAssignItem} onUnassign={onUnassignItem} onAddLanguage={onAddLanguage}/>}
        {ready && cl && view === "portal" && role === "player" && myChar?.characterCreated && <LiveSession campaign={campaign} party={partyMembers} activeScene={activeScene} role={baseRole} onOpen={openCard} canOpen={(ch) => ch.ownerUid === user.uid}/>}
        {ready && cl && view === "settings" && role !== "demo" && advConfigReady && <CampaignSettings campaign={campaign} advancementConfig={advancementConfig} onSave={saveSettings} onClose={() => navigate("/")} campaignId={CAMPAIGN_ID} campaignStatuses={campaignStatuses} isGM={isGM} theme={theme} onThemeChange={saveTheme}/>}
        {ready && view === "card" && viewCh && !editing && !(role === "player" && gmModeData?.active) && <CharacterCard ch={viewCh} save={save} isGM={isGM} user={user} canAdv={canAdv} onEdit={() => setEditing(true)} onEditBio={() => setEditingBio(true)} onAdvance={() => navigate(`/card/${activeId}/advance`)} onLog={() => navigate(`/card/${activeId}/log`)} campaignId={CAMPAIGN_ID} campaignStatuses={campaignStatuses} items={activeItems} onCreateItem={onCreateItem} onDeleteItem={onDeleteItem} onUpdateItem={onUpdateItem} peers={peers} orgs={orgsForView} campaign={campaign} canRoll={canRoll} onCommitRoll={onCommitRoll} onLinkOrg={onLinkOrg} onUnlinkOrg={onUnlinkOrg} onSetOrgLevel={onSetOrgLevel}/>}
        {ready && view === "card" && viewCh && editingBio && <BioEditCard ch={activeChar} onSave={saveBio} onCancel={() => setEditingBio(false)}/>}
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
      <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs} isDemo={role === "demo"} hasChar={!!viewCh} hasLk={!!campaign?.lk?.projectUrl}/>
    </div>
  );
}
