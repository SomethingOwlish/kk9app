import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  watchCampaign, watchCharacterList, saveCharacterDebounced,
  updateCharacterNow, updateCampaignNow, clearCharacterLog,
  watchAdvancementConfig, applyAdvancement, saveAdvancementConfig,
  watchGmMode, watchStatuses, seedStatuses, watchNpcs, watchActiveScene,
  watchItemsByOwner, watchAllItems, createItem, deleteItem, updateItem,
  assignItem, unassignItem, addLanguageToChar, addFeatureToChar, saveBioFields,
  watchOrganizations, createOrganization, updateOrganization, deleteOrganization,
  linkCharToOrg, unlinkCharToOrg, setCharOrgLevel, applyRollOutcome, applyReroll,
  watchShopList, createShop, updateShop, deleteShop,
  purchaseStackable, purchaseUnique, requestSell, watchSellRequests, approveSell, rejectSell,
  watchLibrary, createLibraryEntry, updateLibraryEntry, deleteLibraryEntry, seedLibrary,
  createNpcFromLibrary,
  linkDaemonToChar, unlinkDaemonFromChar, updatePortraitConfig,
  ensureUserDoc, watchUserDoc,
  createAttacks, watchAttacks, resolveAttackOnSelf, dismissAttack,
} from "./lib/db";
import { effectiveRole } from "./lib/roles";
import { libraryDefaultsFor, LIBRARY_KIND_LABEL } from "./lib/library";
import { FACULTIES } from "./lib/seed-faculties";
import { CURATORS_DATA } from "./lib/seed-curators";
import { COMPANIONS_DATA } from "./lib/seed-companions";
import { NPC_LIGHT_DATA } from "./lib/seed-npc-light";

// Library kinds that can be batch-seeded from a static catalog.
const LIBRARY_SEED = {
  faculty: FACULTIES,
  curator: CURATORS_DATA,
  companion: COMPANIONS_DATA,
  "npc-light": NPC_LIGHT_DATA,
};
import { STATUSES_DATA } from "./lib/seed-statuses";
import { advSettings } from "./lib/advancement";
import { enrichPatch } from "./lib/derive";
import { tickRoundPatch } from "./lib/activeSpells";
import { CAMPAIGN_ID, clearActiveCampaign } from "./lib/config";
import { getPath, applyOverrides, canAdvance } from "./lib/appUtils";
import { loadPrefs, savePref } from "./lib/userPrefs";
import "./styles/app.css";
import "./styles/theme-explorer.css";
import "./styles/tier2.css";
import "./styles/portrait.css";
import CharacterCard from "./components/CharacterCard";
import AttackResolvePanel from "./components/AttackResolvePanel";
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
import ShopView from "./views/ShopView";
import ShopManager from "./views/ShopManager";
import LibraryView from "./views/LibraryView";
import FoundryImportView from "./views/FoundryImportView";
import PortraitLayer from "./components/PortraitLayer";
import PortraitDock from "./components/PortraitDock";

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
  const [shops, setShops] = useState([]);
  const [sellRequests, setSellRequests] = useState([]);
  const [library, setLibrary] = useState([]);
  // Глобальная роль из users/{uid} (admin/gm/player) — источник правды для доступа.
  const [globalRole, setGlobalRole] = useState(null);
  const [attacks, setAttacks] = useState([]);

  useEffect(() => { ensureUserDoc(user).catch(() => {}); }, [user]);
  useEffect(() => watchUserDoc(user.uid, (u) => setGlobalRole(u?.role || null)), [user.uid]);
  useEffect(() => watchCampaign(CAMPAIGN_ID, setCampaign), []);
  useEffect(() => watchShopList(CAMPAIGN_ID, setShops), []);
  useEffect(() => watchSellRequests(CAMPAIGN_ID, setSellRequests), []);
  useEffect(() => watchCharacterList(CAMPAIGN_ID, (list) => { setCharacters(list); setReady(true); }), []);
  useEffect(() => watchAdvancementConfig(CAMPAIGN_ID, (cfg) => { setAdvancementConfig(cfg); setAdvConfigReady(true); }), []);
  useEffect(() => watchGmMode(CAMPAIGN_ID, setGmModeData), []);
  useEffect(() => watchNpcs(CAMPAIGN_ID, setNpcs), []);
  useEffect(() => watchActiveScene(CAMPAIGN_ID, setActiveScene), []);
  useEffect(() => watchAllItems(CAMPAIGN_ID, setAllItems), []);
  useEffect(() => watchAttacks(CAMPAIGN_ID, setAttacks), []);
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
    : pathname === "/shop" ? "shop"
    : pathname === "/library" ? "library"
    : pathname === "/import" ? "import"
    : pathname === "/items" ? "items" : "portal";
  // membership — роль в ЭТОЙ кампании (members map); globalRole — глобальная.
  // Эффективная роль: admin всегда admin; глобальный gm играет игроком там, где
  // записан игроком; глобальный игрок всегда игрок. null = не участник.
  const membershipRole = campaign?.members?.[user.uid];
  const isAdmin = globalRole === "admin";
  const baseRole = effectiveRole(globalRole, membershipRole);
  const role = isAdmin ? actingAs : baseRole;
  const isGM = role === "gm";
  const settings = advSettings(advancementConfig);
  // Игрок может владеть НЕСКОЛЬКИМИ карточками. myChar — первая (для мастера
  // создания/фолбэков), myChars — все свои. Активная карточка игрока = та, что в
  // URL, если он ею владеет; иначе первая своя.
  const myChars = characters.filter(c => c.ownerUid === user.uid);
  const myChar = myChars[0] || null;
  const ownsUrlChar = !!(urlCharId && myChars.some(c => c.id === urlCharId));
  const activeId = isGM ? (urlCharId || lastSelectedCharId) : (ownsUrlChar ? urlCharId : myChar?.id);
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
  // Relations ref-picker source: all chars + npcs (except the open one), plus
  // every library unit the current viewer can see (players get visible-only via
  // watchLibrary). Lets players link NPCs and other library units into relations.
  const peers = useMemo(() => {
    const npcSet = new Set(npcs.map(n => n.id));
    const live = [...characters, ...npcs]
      .filter(c => c.id !== activeId)
      .map(c => ({ id: c.id, name: c.name, portrait: c.portrait, hint: npcSet.has(c.id) ? "НПС" : "" }));
    const lib = library
      .filter(e => e.id !== activeId)
      .map(e => ({ id: e.id, name: e.name, portrait: e.img || "", hint: LIBRARY_KIND_LABEL[e.kind] || "Библиотека" }));
    return [...live, ...lib];
  }, [characters, npcs, activeId, library]);
  // Players (incl. admin acting-as-player) only see organizations marked visible.
  const orgsForView = useMemo(() => isGM ? orgs : orgs.filter(o => o.visibleToPlayers), [orgs, isGM]);
  const ownChar = !!(activeChar && user && activeChar.ownerUid === user.uid);
  const canRoll = role !== "demo" && (isGM || ownChar);
  // Players must query visible-only orgs (collection listener is denied otherwise).
  useEffect(() => watchOrganizations(CAMPAIGN_ID, setOrgs, !isGM), [isGM]);
  // Library (FEAT-04): same visible-only constraint for players.
  useEffect(() => watchLibrary(CAMPAIGN_ID, setLibrary, !isGM), [isGM]);
  const daemonLib = useMemo(() => library.filter((e) => e.kind === "daemon"), [library]);
  const portraitIntensity = campaign?.portraits?.intensity ?? "normal";

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
  const saveSettings = useCallback(async ({ advancement, chargen, rewind, journalArchiveThreshold, nextSession, extra }) => {
    try {
      const campaignPatch = { chargen };
      if (nextSession != null) campaignPatch.nextSession = nextSession;
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

  // Combat attack→resist (B-54). Roster for the attack target picker + the
  // attacker's dispatch callback (one pending-attack doc per target).
  const npcIds = useMemo(() => new Set(npcs.map((c) => c.id)), [npcs]);
  const roster = useMemo(
    () => [...characters, ...npcs].map((c) => ({ id: c.id, name: c.name, kind: npcIds.has(c.id) ? "npc" : "character" })),
    [characters, npcs, npcIds],
  );
  const onAttack = useCallback(async (arr) => {
    await createAttacks(CAMPAIGN_ID, arr);
  }, []);
  // Pending attacks the current viewer may resolve: the defender's own character,
  // or (for the GM) any NPC target. Show the newest few unresolved.
  const myUid = user.uid;
  const pendingAttacks = useMemo(() => {
    return (attacks || [])
      .filter((a) => a && !a.resolved && !a.dismissed)
      .filter((a) => {
        const targetChar = characters.find((c) => c.id === a.targetCharId);
        if (targetChar && targetChar.ownerUid === myUid) return true;
        if (isGM && (a.targetKind === "npc" || npcIds.has(a.targetCharId))) return true;
        return false;
      })
      .slice(0, 3);
  }, [attacks, characters, npcIds, isGM, myUid]);
  const onResolveAttack = useCallback(async (attack, plan) => {
    const targetCh = characters.find((c) => c.id === attack.targetCharId)
      || npcs.find((c) => c.id === attack.targetCharId);
    if (!targetCh) return;
    await resolveAttackOnSelf(CAMPAIGN_ID, attack.targetCharId, targetCh, attack.id, plan);
  }, [characters, npcs]);
  const onDismissAttack = useCallback(async (attack) => {
    await dismissAttack(CAMPAIGN_ID, attack.id);
  }, []);
  // Active-spell round tick (B-55): charge upkeep energy + decrement duration +
  // expire, for every party character. No initiative loop in the web port, so the
  // GM advances rounds manually from the GM board.
  const onTickRound = useCallback(async () => {
    for (const c of characters) {
      const { patch } = tickRoundPatch(c);
      if (Object.keys(patch).length) await updateCharacterNow(CAMPAIGN_ID, c.id, patch);
    }
  }, [characters]);
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
  // Feature catalog (B-61): embed a feature-template copy onto a character.
  const onAddFeature = useCallback(async (charId, entry) => {
    await addFeatureToChar(CAMPAIGN_ID, charId, entry);
  }, []);
  // Persist a roll: merged status-tick + tension patch, then roll-log entry.
  const onCommitRoll = useCallback(async ({ charId, rollData, outcome, exhaustionInstance, charPatch, reroll, fateDebtInstance }) => {
    const snapshot = characters.find(c => c.id === charId) || activeChar;
    if (!snapshot) return;
    try {
      if (reroll) {
        await applyReroll(CAMPAIGN_ID, charId, { rollData, fateDebtInstance });
      } else {
        await applyRollOutcome(CAMPAIGN_ID, charId, snapshot, { outcome, exhaustionInstance, rollData, charPatch, campaignStatuses, campaign });
      }
    } catch (e) { alert("Не удалось сохранить бросок: " + (e?.message || e)); }
  }, [characters, activeChar, campaignStatuses, campaign]);
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
  const onCreateShop = useCallback(async () => {
    await createShop(CAMPAIGN_ID, {}).catch(e => alert("Ошибка: " + (e?.message || e)));
  }, []);
  const onUpdateShop = useCallback(async (shopId, patch) => {
    await updateShop(CAMPAIGN_ID, shopId, patch).catch(console.error);
  }, []);
  const onDeleteShop = useCallback(async (shopId) => {
    await deleteShop(CAMPAIGN_ID, shopId).catch(e => alert("Ошибка: " + (e?.message || e)));
  }, []);
  const onBuyUnique = useCallback(async (shopId, itemId) => {
    if (!activeId) throw new Error("Нет персонажа");
    return purchaseUnique(CAMPAIGN_ID, shopId, itemId, activeId);
  }, [activeId]);
  const onBuyStackable = useCallback(async (shopId, stockIndex, qty) => {
    if (!activeId) throw new Error("Нет персонажа");
    return purchaseStackable(CAMPAIGN_ID, shopId, stockIndex, activeId, qty);
  }, [activeId]);
  // B-50/D1: players file a sell request instead of selling directly.
  const onSellItem = useCallback(async (shopId, item, price) => {
    if (!activeId) throw new Error("Нет персонажа");
    return requestSell(CAMPAIGN_ID, shopId, activeId, user.uid, item, price);
  }, [activeId, user.uid]);
  const onApproveSell = useCallback(async (req, finalPrice) => {
    return approveSell(CAMPAIGN_ID, req, finalPrice);
  }, []);
  const onRejectSell = useCallback(async (reqId) => {
    return rejectSell(CAMPAIGN_ID, reqId);
  }, []);
  // ── Library (FEAT-04 reshaped) + daemon links + portrait ──
  const onCreateLibrary = useCallback(async (kind) => {
    await createLibraryEntry(CAMPAIGN_ID, { kind, name: "Новая запись", ...libraryDefaultsFor(kind) })
      .catch((e) => alert("Ошибка: " + (e?.message || e)));
  }, []);
  const onUpdateLibrary = useCallback(async (id, patch) => {
    await updateLibraryEntry(CAMPAIGN_ID, id, patch).catch(console.error);
  }, []);
  const onDeleteLibrary = useCallback(async (id) => {
    await deleteLibraryEntry(CAMPAIGN_ID, id).catch((e) => alert("Ошибка: " + (e?.message || e)));
  }, []);
  const onSeedLibrary = useCallback(async (kind) => {
    const data = LIBRARY_SEED[kind];
    if (!data) return;
    try {
      const added = await seedLibrary(CAMPAIGN_ID, kind, data);
      alert(added > 0 ? `Добавлено записей: ${added}` : "Все записи уже в библиотеке.");
    } catch (e) { alert("Ошибка: " + (e?.message || e)); }
  }, []);
  // GM: spawn a live board NPC from an existing Library entry.
  const onAddNpcFromLibrary = useCallback(async (entry) => {
    try { return await createNpcFromLibrary(CAMPAIGN_ID, entry); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
  }, []);
  const onLinkDaemon = useCallback(async (charId, daemonId) => {
    await linkDaemonToChar(CAMPAIGN_ID, charId, daemonId).catch((e) => alert("Ошибка: " + (e?.message || e)));
  }, []);
  const onUnlinkDaemon = useCallback(async (charId, daemonId) => {
    await unlinkDaemonFromChar(CAMPAIGN_ID, charId, daemonId).catch(console.error);
  }, []);
  const onUpdatePortrait = useCallback(async (charId, config) => {
    await updatePortraitConfig(CAMPAIGN_ID, charId, config).catch(console.error);
  }, []);
  // Игрок меняет активную эмоцию только у своего персонажа (gated allowPlayerEmotions).
  const onSetOwnEmotion = useCallback(async (charId, emoId) => {
    const ch = characters.find((c) => c.id === charId);
    if (!ch || ch.ownerUid !== user.uid) return;
    await updatePortraitConfig(CAMPAIGN_ID, charId, { ...(ch.portraitConfig || {}), activeEmotion: emoId }).catch(console.error);
  }, [characters, user.uid]);
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
    else if (id === "adv" && activeId && !isGM && role !== "demo") navigate(`/card/${activeId}/advance`);
    else if (id === "log" && activeId && isGM) navigate(`/card/${activeId}/log`);
    else if (id === "set" && role !== "demo") navigate("/settings");
    else if (id === "scene") navigate("/scene");
    else if (id === "gm" && isGM) navigate("/board");
    else if (id === "journal") navigate("/journal");
    else if (id === "guide" && role !== "demo") navigate("/guide");
    else if (id === "lk" && campaign?.lk?.projectUrl) window.open(campaign.lk.projectUrl, "_blank", "noopener,noreferrer");
    else if (id === "items" && isGM) navigate("/items");
    else if (id === "import" && isGM) navigate("/import");
    else if (id === "orgs" && role !== "demo") navigate("/orgs");
    else if (id === "rolls" && role !== "demo") navigate("/rolls");
    else if (id === "shop" && role !== "demo") navigate("/shop");
    else if (id === "library" && role !== "demo") navigate("/library");
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
    : view === "shop" ? "shop"
    : view === "library" ? "library"
    : view === "import" ? "import"
    : view === "items" ? "items" : "card";
  const actAs = useCallback((r) => { setActingAs(r); setMenu(false); setEditing(false); navigate("/"); }, [navigate]);
  // Сменить кампанию: сбросить выбор и вернуться на экран выбора кампании.
  const onSwitchCampaign = useCallback(() => { setMenu(false); clearActiveCampaign(); navigate("/select"); }, [navigate]);
  const partyRefs = useMemo(() => new Set(campaign?.partyRefs || []), [campaign?.partyRefs]);
  const partyMembers = useMemo(() => characters.filter(c => partyRefs.has(c.id)), [characters, partyRefs]);
  // Портал игрока всегда показывает ВСЕ его карточки, даже если ГМ не добавил их
  // в отряд, — иначе игрок с несколькими персонажами видит только часть.
  const playerParty = useMemo(() => {
    const inParty = new Set(partyMembers.map(c => c.id));
    return [...partyMembers, ...myChars.filter(c => !inParty.has(c.id))];
  }, [partyMembers, myChars]);
  // DEC-01: portrait zones can hold NPCs too. PortraitLayer only renders actors
  // whose portraitConfig.zone is set, so passing all NPCs is safe — only zoned
  // ones appear. The GM dock (below) is where zones get assigned.
  const portraitActors = useMemo(() => [...partyMembers, ...npcs], [partyMembers, npcs]);
  const cl = campaign !== null;
  const themeClass = theme !== "original" ? ` te-theme-${theme}` : "";
  // BUG-02 — demo is a public, chrome-free scene preview. No topbar; the burger
  // + menu are shown only to an admin so they can switch back out of demo mode.
  if (ready && cl && role === "demo") {
    return (
      <div className={`kk-root${themeClass}`}>
        <div className="kk-bg" aria-hidden/>
        <ScenePlayerView/>
        <PortraitLayer characters={portraitActors} intensity={portraitIntensity} />
        {isAdmin && (
          <button className="kk-burger kk-burger-fixed" onClick={() => setMenu(true)} aria-label="Меню">
            <span/><span/><span/>
          </button>
        )}
        {isAdmin && <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs} onSwitchCampaign={onSwitchCampaign} isDemo hasChar={!!activeId} hasLk={!!campaign?.lk?.projectUrl}/>}
      </div>
    );
  }
  if (view === "scene" && ready && cl) {
    return (
      <div className={`kk-root${themeClass}`}>
        <div className="kk-bg" aria-hidden/>
        <ScenePlayerView isGM={isGM} onBack={() => navigate("/")}/>
        {/* FEAT-19 — portraits overlay the scene only; GM dock on top */}
        <PortraitLayer
          characters={portraitActors}
          intensity={portraitIntensity}
          myUid={user.uid}
          allowPlayerEmotions={campaign?.scene?.allowPlayerEmotions ?? false}
          onSetEmotion={onSetOwnEmotion}
        />
        {isGM && <PortraitDock characters={partyMembers} npcs={npcs} onUpdate={onUpdatePortrait} />}
        {!isGM && (
          <button className="kk-burger kk-burger-fixed" onClick={() => setMenu(true)} aria-label="Меню">
            <span/><span/><span/>
          </button>
        )}
        <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs} onSwitchCampaign={onSwitchCampaign} isDemo={role === "demo"} hasChar={!!activeId} hasLk={!!campaign?.lk?.projectUrl}/>
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
        {ready && cl && role === "player" && (!myChar || myChar.characterCreated === false) && (
          <CharacterCreationWizard user={user} myChar={myChar} campaign={campaign} />
        )}
        {ready && cl && role === "player" && gmModeData?.active && view === "card" && <div className="kk-gmmode-block"><div className="kk-gmmode-block-inner"><div className="kk-gmmode-block-icon">🎬</div><div className="kk-gmmode-block-title">ГМ настраивает сцену</div><div className="kk-gmmode-block-sub">Подождите, скоро продолжим</div></div></div>}
        {ready && cl && view === "portal" && isGM && <LiveSession campaign={campaign} party={partyMembers} activeScene={activeScene} role={baseRole} isGM onOpen={openCard} canOpen={() => true} onSettings={() => navigate("/settings")}/>}
        {ready && cl && view === "board" && isGM && <GmBoard campaign={campaign} characters={characters} partyMembers={partyMembers} gmModeData={gmModeData} userUid={user.uid} onOpenChar={openCard} onSettings={() => navigate("/settings")} npcs={npcs} library={library} onAddNpcFromLibrary={onAddNpcFromLibrary} campaignStatuses={campaignStatuses} onTickRound={onTickRound}/>}
        {ready && cl && view === "journal" && baseRole && <JournalView isGM={isGM} campaign={campaign}/>}
        {ready && cl && view === "orgs" && baseRole && role !== "demo" && <OrganizationsView orgs={orgsForView} isGM={isGM} characters={characters} onCreate={onCreateOrg} onUpdate={onUpdateOrg} onDelete={onDeleteOrg} onUnlinkChar={onUnlinkOrg} onOpenChar={openCard}/>}
        {ready && cl && view === "rolls" && baseRole && role !== "demo" && <RollLogView campaignId={CAMPAIGN_ID} isGM={isGM}/>}
        {ready && cl && view === "shop" && baseRole && role !== "demo" && isGM && <ShopManager shops={shops} allItems={allItems} sellRequests={sellRequests} characters={characters} onCreate={onCreateShop} onUpdate={onUpdateShop} onDelete={onDeleteShop} onApproveSell={onApproveSell} onRejectSell={onRejectSell}/>}
        {ready && cl && view === "shop" && baseRole && role !== "demo" && !isGM && <ShopView shops={shops} char={activeChar || myChar} ownedItems={activeItems} allItems={allItems} defaultItemPrice={campaign?.shop?.defaultItemPrice ?? 0} onBuyUnique={onBuyUnique} onBuyStackable={onBuyStackable} onSell={onSellItem}/>}
        {ready && cl && view === "guide" && baseRole && role !== "demo" && <GuideView campaign={campaign} canEdit={isGM || isAdmin} onSave={saveGuide}/>}
        {ready && cl && view === "guide" && role === "demo" && <div className="kk-empty">Раздел недоступен в демо-режиме.</div>}
        {ready && cl && view === "items" && isGM && <ItemsView items={allItems} characters={[...characters, ...npcs]} statuses={campaignStatuses} onCreateItem={onCreateCatalogItem} onDeleteItem={onDeleteCatalogItem} onUpdateItem={onUpdateItem} onAssign={onAssignItem} onUnassign={onUnassignItem} onAddLanguage={onAddLanguage} onAddFeature={onAddFeature}/>}
        {ready && cl && view === "import" && isGM && <FoundryImportView onOpenChar={openCard} members={campaign?.members || {}}/>}
        {ready && cl && view === "library" && baseRole && role !== "demo" && <LibraryView entries={library} isGM={isGM} onCreate={onCreateLibrary} onUpdate={onUpdateLibrary} onDelete={onDeleteLibrary} onSeed={onSeedLibrary} seedable={Object.keys(LIBRARY_SEED)}/>}
        {ready && cl && view === "portal" && role === "player" && myChar?.characterCreated && <LiveSession campaign={campaign} party={playerParty} activeScene={activeScene} role={baseRole} onOpen={openCard} canOpen={(ch) => ch.ownerUid === user.uid}/>}
        {ready && cl && view === "settings" && role !== "demo" && advConfigReady && <CampaignSettings campaign={campaign} advancementConfig={advancementConfig} onSave={saveSettings} onClose={() => navigate("/")} campaignId={CAMPAIGN_ID} campaignStatuses={campaignStatuses} isGM={isGM} theme={theme} onThemeChange={saveTheme}/>}
        {ready && view === "card" && viewCh && !editing && !(role === "player" && gmModeData?.active) && <CharacterCard ch={viewCh} save={save} isGM={isGM} user={user} canAdv={canAdv} onEdit={() => setEditing(true)} onEditBio={() => setEditingBio(true)} onAdvance={() => navigate(`/card/${activeId}/advance`)} onLog={() => navigate(`/card/${activeId}/log`)} campaignId={CAMPAIGN_ID} campaignStatuses={campaignStatuses} items={activeItems} onCreateItem={onCreateItem} onDeleteItem={onDeleteItem} onUpdateItem={onUpdateItem} peers={peers} orgs={orgsForView} campaign={campaign} canRoll={canRoll} onCommitRoll={onCommitRoll} onLinkOrg={onLinkOrg} onUnlinkOrg={onUnlinkOrg} onSetOrgLevel={onSetOrgLevel} daemonLib={daemonLib} onLinkDaemon={onLinkDaemon} onUnlinkDaemon={onUnlinkDaemon} roster={roster} onAttack={onAttack}/>}
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
      <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs} onSwitchCampaign={onSwitchCampaign} isDemo={role === "demo"} hasChar={!!activeId} hasLk={!!campaign?.lk?.projectUrl}/>
      {/* Pending attack→resist toasts (B-54) — defender resolves soak on self. */}
      {pendingAttacks.length > 0 && (
        <div className="kk-attack-toasts">
          {pendingAttacks.map((a) => {
            const targetCh = characters.find((c) => c.id === a.targetCharId)
              || npcs.find((c) => c.id === a.targetCharId);
            if (!targetCh) return null;
            const targetItems = allItems.filter((it) => it.ownerCharacterId === a.targetCharId);
            return (
              <AttackResolvePanel
                key={a.id}
                attack={a}
                ch={targetCh}
                items={targetItems}
                campaignStatuses={campaignStatuses}
                isGM={isGM}
                onResolve={(plan) => onResolveAttack(a, plan)}
                onDismiss={() => onDismissAttack(a)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
