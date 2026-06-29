// ============================================================
// КК9 — слой данных Firestore.
// Навыки — МАССИВ внутри документа персонажа (решено).
// Напряжение и ГМ-заметки живут в ОТДЕЛЬНОМ gm-доке:
//   characters/{id}/private/gm   — читает/пишет только ГМ.
// Причина: правила Firestore не умеют прятать ОДНО поле при чтении —
// если игрок читает документ, он читает и tension. Поэтому секретное
// выносим в отдельный документ под gm-only правило.
// ============================================================
import {
  doc, collection, onSnapshot, setDoc, updateDoc, getDoc, serverTimestamp,
  addDoc, getDocs, query, orderBy, where, writeBatch, deleteDoc, limit, runTransaction,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";
import { buildBaseSkills, SKILLS_DATA } from "./seed-skills";
import { derivePhysicalToughness, deriveEnergyMax, deriveTensionMax } from "./derive";
import { tickStatuses } from "./statusEngine";

// Навык по имени — для подтягивания attr/categ при добавлении.
const SKILL_BY_NAME = Object.fromEntries(SKILLS_DATA.map((s) => [s.name, s]));

export const SCHEMA_VERSION = 1;

// ── Подписки (живое обновление) ─────────────────────────────
export function watchCharacter(campaignId, characterId, cb) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null));
}
export function watchCampaign(campaignId, cb) {
  const ref = doc(db, "campaigns", campaignId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) { cb(null); return; }
    const data = snap.data();
    if (data.schemaVersion == null) {
      updateDoc(ref, { schemaVersion: SCHEMA_VERSION }).catch((e) => console.error("schemaVersion patch", e));
    }
    cb({ id: snap.id, ...data });
  });
}
export function watchCharacterList(campaignId, cb) {
  const ref = collection(db, "campaigns", campaignId, "characters");
  return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// ── Запись с дебаунсом (чтобы не писать на каждый символ) ───
// Накапливаем патчи разных полей и шлём одним updateDoc после паузы.
const _timers = new Map();
const _pending = new Map();
export function saveCharacterDebounced(campaignId, characterId, patch, ms = 700) {
  const key = `${campaignId}/${characterId}`;
  _pending.set(key, { ...(_pending.get(key) || {}), ...patch });
  clearTimeout(_timers.get(key));
  _timers.set(key, setTimeout(() => {
    const merged = _pending.get(key) || {};
    _pending.delete(key);
    const ref = doc(db, "campaigns", campaignId, "characters", characterId);
    updateDoc(ref, merged).catch((e) => console.error("save error", e));
  }, ms));
}

// ── Создание персонажа (чистая карточка + сид базовых навыков) ──
export async function createCharacter(campaignId, characterId, { name, ownerUid, age = 15 }) {
  const baseSkills = buildBaseSkills();
  const baseAttrs = {
    agility:   { die: 4, modifier: 0 },
    smarts:    { die: 4, modifier: 0 },
    spirit:    { die: 4, modifier: 0 },
    endurance: { die: 4, modifier: 0 },
    magic:     { die: 4, modifier: 0 },
  };
  const stub = { attributes: baseAttrs, skills: baseSkills, age };
  const toughness = derivePhysicalToughness(stub);
  const energyMax = deriveEnergyMax(stub);
  const tensionMax = deriveTensionMax(stub);

  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  await setDoc(ref, {
    schemaVersion: SCHEMA_VERSION,
    ownerUid,
    type: "character",
    characterCreated: false,
    name,
    portrait: "",
    age,
    gender: "",
    birthplace: "",
    dormitory: "",
    height: "",
    build: "",
    allergies: "",
    weaknesses: "",
    biography: "",
    faculty: { name: "", key: "", color: "#c8a14e" },
    academyYear: "1",
    semester: 1,
    attributes: baseAttrs,
    health: {
      physical: { value: 0, toughness: toughness },
      mental:   { value: 0 },
    },
    energy: { value: energyMax, max: energyMax },
    tension: { current: 0, overcap: 0, energyPenalty: 0, max: tensionMax },
    overflow_damage: 0,
    bennies: 3,
    money: 0,
    experience: 0,
    notes: [],
    activeSpells: [],
    activeStatuses: [],
    magicLevels: [],
    customSkills: [],
    languages: [],
    features: [],
    skills: baseSkills,
    relations: [],
    refs: { artifacts: [], companions: [], daemons: [], contacts: [] },
    createdAt: serverTimestamp(),
  });
  // Every character starts with fists as a default weapon
  await addDoc(collection(db, "campaigns", campaignId, "items"), {
    type: "weapon", name: "Кулаки", ownerCharacterId: characterId,
    skillName: "Рукопашный бой", damageLevel: "light", damageType: "physical",
    range: 0, ap: 0, rof: 1, attackModifier: 0, condition: "perfect",
    equipped: true, description: "", createdAt: serverTimestamp(),
  });
  // private/gm — GM-only notes (tension moved to main doc per B-07)
  const gmRef = doc(db, "campaigns", campaignId, "characters", characterId, "private", "gm");
  await setDoc(gmRef, {
    gmNotes: "",
  });
  return characterId;
}

// ── Выбор факультета ────────────────────────────────────────
// Пишет faculty{} и ДОКИДЫВАЕТ недостающие навыки факультета в skills[]
// (нетренированными d4-2). Существующие навыки не трогает — прокачку не теряем.
// Навыки прошлого факультета НЕ удаляем (смена факультета = только добавление).
export async function setFaculty(campaignId, characterId, fac, currentSkills = []) {
  const have = new Set(currentSkills.map((s) => s.name));
  const additions = (fac.abilities || [])
    .filter((n) => !have.has(n))
    .map((n) => {
      const ref = SKILL_BY_NAME[n];
      return { name: n, attr: ref?.attr || "smarts", categ: ref?.categ || "learned", die: 4, modifier: -2 };
    });
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  await updateDoc(ref, {
    faculty: { name: fac.name, key: fac.key, color: fac.color },
    skills: [...currentSkills, ...additions],
  });
}
// ── Ручная редактура (ГМ): одно сохранение по конфирму ──────
export async function updateCharacterNow(campaignId, characterId, patch) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  await updateDoc(ref, patch);
}

// ── GM Notes (B-26) — private/gm sub-document ───────────────
export async function getGmNotes(campaignId, characterId) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId, "private", "gm");
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().gmNotes ?? "") : "";
}
export async function saveGmNotes(campaignId, characterId, text) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId, "private", "gm");
  await updateDoc(ref, { gmNotes: text });
}

// ── Настройки кампании (ГМ): сохранить разом ────────────────
export async function updateCampaignNow(campaignId, patch) {
  const ref = doc(db, "campaigns", campaignId);
  await updateDoc(ref, patch);
}

// ── Лог прокачки (по персонажу) ─────────────────────────────
// Пишется ПЕРВЫМ делом при применении прокачки — чтобы при падении
// апдейта карточки запись о списании опыта осталась для восстановления.
export async function addLogEntry(campaignId, characterId, entry) {
  const ref = collection(db, "campaigns", campaignId, "characters", characterId, "log");
  return addDoc(ref, { ...entry, at: serverTimestamp() });
}
export function watchCharacterLog(campaignId, characterId, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "characters", characterId, "log"),
    orderBy("at", "desc")
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function clearCharacterLog(campaignId, characterId) {
  const ref = collection(db, "campaigns", campaignId, "characters", characterId, "log");
  const snap = await getDocs(ref);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// Bio/anketa edit (IMP-02): write demographic + biography fields to the
// character doc, then append a log entry recording which fields changed.
// `changed` is an array of human-readable labels for LogView display.
export async function saveBioFields(campaignId, characterId, fields, changed = []) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  await updateDoc(ref, fields);
  await addLogEntry(campaignId, characterId, { type: "bio_edit", fields: changed });
}

// Atomic advancement apply: log entry + character update in one transaction.
// Validates server-side XP to prevent double-spend on concurrent tabs.
export async function applyAdvancement(campaignId, characterId, { attributes, skills, spent, changes, newExperience }) {
  const charRef = doc(db, "campaigns", campaignId, "characters", characterId);
  const logRef = doc(collection(db, "campaigns", campaignId, "characters", characterId, "log"));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(charRef);
    if (!snap.exists()) throw new Error("Персонаж не найден");
    const serverXp = snap.data().experience ?? 0;
    if (serverXp < spent) throw new Error(`Недостаточно опыта (сервер: ${serverXp}, нужно: ${spent})`);
    tx.set(logRef, { type: "advancement", spent, changes, at: serverTimestamp() });
    tx.update(charRef, { attributes, skills, experience: newExperience });
  });
}

// ── Настройки прокачки (отдельный документ per D-26) ────────
// Path: campaigns/{id}/config/advancement
export function watchAdvancementConfig(campaignId, cb) {
  const ref = doc(db, "campaigns", campaignId, "config", "advancement");
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
}
export async function saveAdvancementConfig(campaignId, config) {
  const ref = doc(db, "campaigns", campaignId, "config", "advancement");
  await setDoc(ref, config);
}

// ── Scene system (B-08) ─────────────────────────────────────
// Schema: { title, background, text, isActive, createdAt }
export function watchScenes(campaignId, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "scenes"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export function watchActiveScene(campaignId, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "scenes"),
    where("isActive", "==", true),
    limit(1),
  );
  return onSnapshot(q, (snap) => cb(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }));
}
export async function createScene(campaignId, data) {
  const ref = collection(db, "campaigns", campaignId, "scenes");
  return addDoc(ref, { ...data, isActive: false, createdAt: serverTimestamp() });
}
// One-shot read of all scenes (used by FEAT-07 GitHub import for dedup).
export async function listScenes(campaignId) {
  const snap = await getDocs(collection(db, "campaigns", campaignId, "scenes"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function updateScene(campaignId, sceneId, data) {
  await updateDoc(doc(db, "campaigns", campaignId, "scenes", sceneId), data);
}
export async function deleteScene(campaignId, sceneId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "scenes", sceneId));
}
// Batch: deactivate all currently-active scenes, activate target, clear scene-duration statuses from party.
export async function activateScene(campaignId, sceneId) {
  const [activeSnap, campaignSnap] = await Promise.all([
    getDocs(query(collection(db, "campaigns", campaignId, "scenes"), where("isActive", "==", true))),
    getDoc(doc(db, "campaigns", campaignId)),
  ]);
  const batch = writeBatch(db);
  activeSnap.docs.forEach((d) => batch.update(d.ref, { isActive: false }));
  batch.update(doc(db, "campaigns", campaignId, "scenes", sceneId), { isActive: true });
  await batch.commit();

  // Clear durationMode=scene statuses from all party characters.
  const partyIds = campaignSnap.data()?.partyRefs || [];
  if (partyIds.length > 0) {
    await Promise.allSettled(partyIds.map(async (charId) => {
      const ref = doc(db, "campaigns", campaignId, "characters", charId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const statuses = snap.data().activeStatuses || [];
      const cleared = statuses.filter(s => s.durationMode !== "scene");
      if (cleared.length !== statuses.length) {
        await updateDoc(ref, { activeStatuses: cleared });
      }
    }));
  }
}
export async function deactivateAllScenes(campaignId) {
  const activeSnap = await getDocs(
    query(collection(db, "campaigns", campaignId, "scenes"), where("isActive", "==", true)),
  );
  const batch = writeBatch(db);
  activeSnap.docs.forEach((d) => batch.update(d.ref, { isActive: false }));
  await batch.commit();
}

// ── Chargen requests (FEAT-10) — saved when wizard completes ────
// Path: campaigns/{id}/chargen_requests/{charId}
export async function saveChargenRequest(campaignId, charId, data) {
  const ref = doc(db, "campaigns", campaignId, "chargen_requests", charId);
  await setDoc(ref, { ...data, createdAt: serverTimestamp() });
}

// ── Debounced campaign save ──────────────────────────────────
const _campTimers = new Map();
const _campPending = new Map();
export function saveCampaignDebounced(campaignId, patch, ms = 700) {
  _campPending.set(campaignId, { ...(_campPending.get(campaignId) || {}), ...patch });
  clearTimeout(_campTimers.get(campaignId));
  _campTimers.set(campaignId, setTimeout(() => {
    const merged = _campPending.get(campaignId) || {};
    _campPending.delete(campaignId);
    updateDoc(doc(db, "campaigns", campaignId), merged).catch((e) => console.error("camp save error", e));
  }, ms));
}

// ── GM Board — party management (B-11) ──────────────────────
export function watchParty(campaignId, cb) {
  let _refs = [];
  let _chars = [];
  const emit = () => { const s = new Set(_refs); cb(_chars.filter(c => s.has(c.id))); };
  const u1 = watchCampaign(campaignId, (camp) => { _refs = camp?.partyRefs || []; emit(); });
  const u2 = watchCharacterList(campaignId, (chars) => { _chars = chars; emit(); });
  return () => { u1(); u2(); };
}
export async function addToParty(campaignId, charId) {
  await updateDoc(doc(db, "campaigns", campaignId), { partyRefs: arrayUnion(charId) });
}
export async function removeFromParty(campaignId, charId) {
  await updateDoc(doc(db, "campaigns", campaignId), { partyRefs: arrayRemove(charId) });
}

// ── GM Mode broadcast — ephemeral presence doc (D-21) ───────
// Path: campaigns/{id}/presence/gmMode
export function watchGmMode(campaignId, cb) {
  const ref = doc(db, "campaigns", campaignId, "presence", "gmMode");
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null));
}
export async function setGmModeActive(campaignId, uid) {
  await setDoc(doc(db, "campaigns", campaignId, "presence", "gmMode"), { active: true, uid });
}
export async function clearGmMode(campaignId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "presence", "gmMode"));
}
export async function setGmMode(campaignId, uid, active) {
  const ref = doc(db, "campaigns", campaignId, "presence", "gmMode");
  if (active) {
    await setDoc(ref, { active: true, uid, activatedAt: serverTimestamp() });
  } else {
    await deleteDoc(ref);
  }
}

// Quick GM actions on a party member.
export async function addBennie(campaignId, charId) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { bennies: (snap.data().bennies ?? 0) + 1 });
}
export async function addExperience(campaignId, charId, amount) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { experience: (snap.data().experience ?? 0) + amount });
}
export async function addMoney(campaignId, charId, amount) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { money: (snap.data().money ?? 0) + amount });
}

// ── Time Rewind (B-12) ───────────────────────────────────────
// Computes per-character proposals for N idle days.
export function buildTimeRewindProposals(partyMembers, days, campaign) {
  return partyMembers.map((ch) => {
    const idleXp = Math.round((campaign.idleExpPerDay ?? 5) * days);
    const salary = campaign.salaryByGrade?.[ch.academyYear] ?? 0;
    const graduateExpense = Math.round((campaign.graduateDailyExpense ?? 0) * days);
    const moneyDelta = salary - graduateExpense;
    const tensionReduction = Math.min(ch.tension?.current ?? 0, days);
    return {
      charId: ch.id,
      name: ch.name || "—",
      xpDelta: idleXp,
      moneyDelta,
      energyTo: ch.energy?.max ?? 0,
      healthPhysTo: 0,
      healthMentTo: 0,
      tensionDelta: -tensionReduction,
    };
  });
}

function _advanceDate(gameDate, days) {
  if (!gameDate) return null;
  const d = new Date(gameDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Applies time rewind independently per character (D-20: partial failure OK).
// Returns array of { charId, ok, error }.
// targetDate: explicit new game date string (YYYY-MM-DD); takes precedence over
// computing it from currentGameDate+days, which avoids rounding/timezone issues.
export async function applyTimeRewind(campaignId, proposals, days, currentGameDate, targetDate) {
  const results = await Promise.allSettled(
    proposals.map(({ charId, xpDelta, moneyDelta, energyTo, healthPhysTo, healthMentTo, tensionDelta }) => {
      const ref = doc(db, "campaigns", campaignId, "characters", charId);
      return getDoc(ref).then((snap) => {
        if (!snap.exists()) throw new Error("not found");
        const ch = snap.data();
        // Tick counter-duration statuses: decrement durationRemaining, remove at 0.
        const statuses = ch.activeStatuses || [];
        const tickedStatuses = statuses
          .map(s => s.durationMode === "counter" && s.durationRemaining != null
            ? { ...s, durationRemaining: s.durationRemaining - 1 }
            : s)
          .filter(s => !(s.durationMode === "counter" && (s.durationRemaining ?? 1) <= 0));

        return updateDoc(ref, {
          experience: (ch.experience ?? 0) + xpDelta,
          money: (ch.money ?? 0) + moneyDelta,
          "energy.value": energyTo,
          "health.physical.value": healthPhysTo,
          "health.mental.value": healthMentTo,
          "tension.current": Math.max(0, (ch.tension?.current ?? 0) + tensionDelta),
          activeStatuses: tickedStatuses,
        });
      });
    })
  );
  const newDate = targetDate || _advanceDate(currentGameDate, days);
  if (newDate) {
    await updateDoc(doc(db, "campaigns", campaignId), { gameDate: newDate });
  }
  return proposals.map((p, i) => ({
    charId: p.charId,
    ok: results[i].status === "fulfilled",
    error: results[i].reason?.message,
  }));
}

// ── Journal (B-13) ───────────────────────────────────────────
// Streams: "campaign" | "worldNews" | "gmPrivate"
// Path: campaigns/{id}/journal/{stream}/pages/{pageId}
export function watchJournalPages(campaignId, stream, cb, threshold = 20) {
  // No compound filter: avoids requiring a composite Firestore index.
  // isArchived filtering is done client-side.
  const q = query(
    collection(db, "campaigns", campaignId, "journal", stream, "pages"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    const pages = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => !p.isArchived);
    cb(pages);
    if (pages.length > threshold) {
      const batch = writeBatch(db);
      pages.slice(threshold).forEach((p) => {
        batch.update(doc(db, "campaigns", campaignId, "journal", stream, "pages", p.id), { isArchived: true });
      });
      batch.commit().catch(console.error);
    }
  });
}

export async function addJournalPage(campaignId, stream, { title, body }) {
  const ref = collection(db, "campaigns", campaignId, "journal", stream, "pages");
  return addDoc(ref, { title, body: body ?? "", isArchived: false, createdAt: serverTimestamp() });
}

export async function editJournalPage(campaignId, stream, pageId, { title, body }) {
  await updateDoc(doc(db, "campaigns", campaignId, "journal", stream, "pages", pageId), { title, body });
}

export async function deleteJournalPage(campaignId, stream, pageId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "journal", stream, "pages", pageId));
}

// ── Status Effects (B-27) ────────────────────────────────────
// Status DEFINITIONS subcollection: campaigns/{id}/statuses/{statusId}
// Status INSTANCES on characters: character.activeStatuses[]

export function watchStatuses(campaignId, cb) {
  const ref = collection(db, "campaigns", campaignId, "statuses");
  return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function createStatus(campaignId, data) {
  const ref = collection(db, "campaigns", campaignId, "statuses");
  return addDoc(ref, { ...data, createdAt: serverTimestamp() });
}
export async function updateStatus(campaignId, statusId, data) {
  await updateDoc(doc(db, "campaigns", campaignId, "statuses", statusId), data);
}
export async function deleteStatus(campaignId, statusId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "statuses", statusId));
}
// Seeds statuses from STATUSES_DATA if collection is empty.
export async function seedStatuses(campaignId, statusesData) {
  const ref = collection(db, "campaigns", campaignId, "statuses");
  const snap = await getDocs(ref);
  if (!snap.empty) return snap.docs.length; // already seeded
  const batch = writeBatch(db);
  statusesData.forEach((s) => {
    batch.set(doc(ref), { ...s, createdAt: serverTimestamp() });
  });
  await batch.commit();
  return statusesData.length;
}

// Applies a status instance to character.activeStatuses[].
// Instance includes: { _uid, definitionId, name, durationMode, durationRemaining, effects[], source }
export async function applyStatus(campaignId, charId, instance) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  await updateDoc(ref, { activeStatuses: arrayUnion(instance) });
}

// Removes a specific status instance from character.activeStatuses[].
// Must pass the exact same object that was stored (arrayRemove uses deep equality).
export async function removeStatus(campaignId, charId, instance) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  await updateDoc(ref, { activeStatuses: arrayRemove(instance) });
}

// Returns summed numeric roll modifier for a given attribute/context from all active statuses.
// context: { attribute: "agility"|"smarts"|"spirit"|"endurance"|"magic"|"initiative"|null }
export function collectStatusModifiers(activeStatuses = [], context = {}) {
  let modifier = 0;
  let dieChange = 0;
  let successModifier = 0;
  for (const inst of activeStatuses) {
    for (const eff of (inst.effects || [])) {
      if (!eff.enabled || eff.type !== "roll_modifier") continue;
      const rm = eff.roll_modifier || {};
      const hits = rm.target_all
        || (context.attribute === "agility"    && rm.target_agility)
        || (context.attribute === "smarts"     && rm.target_smarts)
        || (context.attribute === "spirit"     && rm.target_spirit)
        || (context.attribute === "endurance"  && rm.target_endurance)
        || (context.attribute === "magic"      && rm.target_magic)
        || (context.attribute === "initiative" && (rm.target_initiative || rm.target_agility || rm.target_smarts));
      if (hits) {
        modifier        += rm.modifier        ?? 0;
        dieChange       += rm.die_change      ?? 0;
        successModifier += rm.success_modifier ?? 0;
      }
    }
  }
  return { modifier, dieChange, successModifier };
}

// ── NPC Sheet (B-29) ────────────────────────────────────────
export function watchNpcs(campaignId, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "characters"),
    where("isNpc", "==", true)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function createNpc(campaignId, { name = "Новый НПС" } = {}) {
  const ref = doc(collection(db, "campaigns", campaignId, "characters"));
  await setDoc(ref, {
    isNpc: true,
    name,
    attributes: {
      agility:   { die: 6, mod: 0 },
      smarts:    { die: 6, mod: 0 },
      spirit:    { die: 6, mod: 0 },
      endurance: { die: 6, mod: 0 },
    },
    skills: [],
    health: { physical: { value: 0, toughness: 4 } },
    overflow_damage: 0,
    activeStatuses: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
export async function deleteNpc(campaignId, charId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "characters", charId));
}

// ── Items (B-14 / B-15) ──────────────────────────────────────
// Path: campaigns/{campaignId}/items/{itemId}
// type: weapon | gear | artifact | spell | device | vehicle | language | feature
// weapon: skillName, damageLevel (light/heavy/lethal), damageType (physical/mental), range, ap, rof, attackModifier, hasStatus, statusName
// gear: gearType, quantity, energyRestore, soakType, soakAbsoluteCapacity, soakAbsoluteCurrent, soakBonusDie, soakBonusModifier, healthBufferPip
// artifact: artifactType (9), rarity, ringMaterial, ringStone, bonuses{}, skillBonuses[], active, destroyed, energyRestore
// spell: spellType (9), cost, upkeepCost, range, duration, durationHours, uses, skillName, noWandNeeded, isAoe, hasStatus, statusName, bonuses{}, skillBonuses[]
// device: deviceType, condition, charges, bonusSkillName, bonusValue
// vehicle: speed, toughness, capacity
export function watchItemsByOwner(campaignId, charId, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "items"),
    where("ownerCharacterId", "==", charId)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export async function createItem(campaignId, data) {
  const ref = collection(db, "campaigns", campaignId, "items");
  return addDoc(ref, { ...data, createdAt: serverTimestamp() });
}
export async function updateItem(campaignId, itemId, data) {
  await updateDoc(doc(db, "campaigns", campaignId, "items", itemId), data);
}
export async function deleteItem(campaignId, itemId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "items", itemId));
}
export function watchItemsByType(campaignId, type, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "items"),
    where("type", "==", type)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}
export function watchAllItems(campaignId, cb) {
  return onSnapshot(collection(db, "campaigns", campaignId, "items"), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a.type || "").localeCompare(b.type || "") || (a.name || "").localeCompare(b.name || ""));
    cb(items);
  });
}

// Artifact: single owner, ownerCharacterId set directly on the item doc.
// All other types (weapon/gear/spell/device/vehicle): copy-per-character.
//   assign = create a new copy doc with ownerCharacterId; unassign = delete that copy doc.
// Language: adds { name, itemId } to character.languages[].
export async function assignItem(campaignId, itemId, charId, itemType, itemData = {}) {
  const col = collection(db, "campaigns", campaignId, "items");
  if (itemType === "artifact") {
    await updateDoc(doc(col, itemId), { ownerCharacterId: charId });
  } else {
    // eslint-disable-next-line no-unused-vars
    const { id: _id, createdAt: _ca, ...rest } = itemData;
    await addDoc(col, { ...rest, ownerCharacterId: charId, createdAt: serverTimestamp() });
  }
}
export async function unassignItem(campaignId, itemId, _charId, itemType) {
  if (itemType === "artifact") {
    await updateDoc(doc(db, "campaigns", campaignId, "items", itemId), { ownerCharacterId: null });
  } else {
    await deleteDoc(doc(db, "campaigns", campaignId, "items", itemId));
  }
}

export async function addLanguageToChar(campaignId, charId, entry) {
  // entry: { name, itemId }
  await updateDoc(doc(db, "campaigns", campaignId, "characters", charId), { languages: arrayUnion(entry) });
}
export async function removeLanguageFromChar(campaignId, charId, entry) {
  await updateDoc(doc(db, "campaigns", campaignId, "characters", charId), { languages: arrayRemove(entry) });
}

export async function addFeatureToChar(campaignId, charId, feature) {
  await updateDoc(doc(db, "campaigns", campaignId, "characters", charId), { features: arrayUnion(feature) });
}
export async function removeFeatureFromChar(campaignId, charId, feature) {
  await updateDoc(doc(db, "campaigns", campaignId, "characters", charId), { features: arrayRemove(feature) });
}

export async function seedItems(campaignId, itemsData, type) {
  const col = collection(db, "campaigns", campaignId, "items");
  const snap = await getDocs(query(col, where("type", "==", type)));
  const existing = new Set(snap.docs.map(d => d.data().name));
  const batch = writeBatch(db);
  let added = 0;
  for (const item of itemsData) {
    if (!existing.has(item.name)) {
      batch.set(doc(col), { ...item, type, ownerCharacterId: null, createdAt: serverTimestamp() });
      added++;
    }
  }
  if (added > 0) await batch.commit();
}

// ── Roll log (B-18 / FEAT-16) ────────────────────────────────
// Path: campaigns/{id}/rolls/{rollId}. Members read all; create only own char.
export async function addRollEntry(campaignId, rollData) {
  const ref = collection(db, "campaigns", campaignId, "rolls");
  return addDoc(ref, { ...rollData, at: serverTimestamp() });
}
export function watchRolls(campaignId, cb, n = 50) {
  const q = query(
    collection(db, "campaigns", campaignId, "rolls"),
    orderBy("at", "desc"),
    limit(n),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// Applies post-roll character mutations (status tick + tension) as ONE merged
// patch to avoid races, then writes the roll-log entry.
//   outcome: result of computeTensionOutcome (or null)
//   exhaustionInstance: status instance to add when outcome.addExhaustion
export async function applyRollOutcome(campaignId, charId, ch, { outcome, exhaustionInstance, rollData }) {
  const tickPatch = tickStatuses(ch) || {};
  const merged = { ...tickPatch };

  if (outcome?.tensionPatch) Object.assign(merged, outcome.tensionPatch);

  // Reconcile activeStatuses across tick + exhaustion add/remove.
  let statuses = tickPatch.activeStatuses || ch.activeStatuses || [];
  if (outcome?.removeExhaustion) {
    statuses = statuses.filter((s) => s.name !== "Ментальное истощение");
  }
  if (outcome?.addExhaustion && exhaustionInstance) {
    if (!statuses.some((s) => s.name === "Ментальное истощение")) {
      statuses = [...statuses, exhaustionInstance];
    }
  }
  if (tickPatch.activeStatuses || outcome?.removeExhaustion || outcome?.addExhaustion) {
    merged.activeStatuses = statuses;
  }

  if (Object.keys(merged).length > 0) {
    await updateCharacterNow(campaignId, charId, merged);
  }
  if (rollData) await addRollEntry(campaignId, rollData);
}

// ── Organizations / Contacts (FEAT-14, reshaped) ─────────────
// NOT items. Collection: campaigns/{id}/organizations/{orgId}.
// Schema: { name, description, orgType, accessLevel, members[], events[],
//           visibleToPlayers: bool, actorRefs: [{ charId, charName, level }] }
// Character side mirror: character.refs.contacts[] = [{ orgId, level }].
// onlyVisible: players MUST constrain the query to visibleToPlayers==true, else
// the collection listener is denied wholesale (a GM-only doc fails the read rule).
export function watchOrganizations(campaignId, cb, onlyVisible = false) {
  const col = collection(db, "campaigns", campaignId, "organizations");
  const ref = onlyVisible ? query(col, where("visibleToPlayers", "==", true)) : col;
  return onSnapshot(ref, (snap) => {
    const orgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    orgs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    cb(orgs);
  });
}
export async function createOrganization(campaignId, data) {
  const ref = collection(db, "campaigns", campaignId, "organizations");
  return addDoc(ref, {
    name: "Новая организация", description: "", orgType: "", accessLevel: "",
    members: [], events: [], visibleToPlayers: false, actorRefs: [],
    ...data, createdAt: serverTimestamp(),
  });
}
export async function updateOrganization(campaignId, orgId, data) {
  await updateDoc(doc(db, "campaigns", campaignId, "organizations", orgId), data);
}
export async function deleteOrganization(campaignId, orgId) {
  // Best-effort: strip the org ref from each linked character first.
  const snap = await getDoc(doc(db, "campaigns", campaignId, "organizations", orgId));
  const actorRefs = snap.exists() ? (snap.data().actorRefs || []) : [];
  await Promise.allSettled(actorRefs.map(async ({ charId }) => {
    const cRef = doc(db, "campaigns", campaignId, "characters", charId);
    const cSnap = await getDoc(cRef);
    if (!cSnap.exists()) return;
    const contacts = (cSnap.data().refs?.contacts || []).filter((c) => c.orgId !== orgId);
    await updateDoc(cRef, { "refs.contacts": contacts });
  }));
  await deleteDoc(doc(db, "campaigns", campaignId, "organizations", orgId));
}

// Bidirectional link (GM action): write character.refs.contacts AND org.actorRefs.
// Best-effort, not a transaction (two docs): on second-write failure, roll back.
export async function linkCharToOrg(campaignId, charId, charName, orgId, level = 0) {
  const charRef = doc(db, "campaigns", campaignId, "characters", charId);
  const orgRef = doc(db, "campaigns", campaignId, "organizations", orgId);
  const charSnap = await getDoc(charRef);
  if (!charSnap.exists()) throw new Error("Персонаж не найден");
  const refs = charSnap.data().refs || {};
  const contacts = Array.isArray(refs.contacts) ? refs.contacts : [];
  if (contacts.some((c) => c.orgId === orgId)) return; // already linked
  await updateDoc(charRef, { "refs.contacts": [...contacts, { orgId, level }] });
  try {
    const orgSnap = await getDoc(orgRef);
    if (!orgSnap.exists()) throw new Error("Организация не найдена");
    const actorRefs = Array.isArray(orgSnap.data().actorRefs) ? orgSnap.data().actorRefs : [];
    if (!actorRefs.some((a) => a.charId === charId)) {
      await updateDoc(orgRef, { actorRefs: [...actorRefs, { charId, charName, level }] });
    }
  } catch (e) {
    await updateDoc(charRef, { "refs.contacts": contacts }).catch(() => {});
    console.error("linkCharToOrg rollback", e);
    throw e;
  }
}
export async function unlinkCharToOrg(campaignId, charId, orgId) {
  const charRef = doc(db, "campaigns", campaignId, "characters", charId);
  const orgRef = doc(db, "campaigns", campaignId, "organizations", orgId);
  const charSnap = await getDoc(charRef);
  if (charSnap.exists()) {
    const contacts = (charSnap.data().refs?.contacts || []).filter((c) => c.orgId !== orgId);
    await updateDoc(charRef, { "refs.contacts": contacts });
  }
  const orgSnap = await getDoc(orgRef);
  if (orgSnap.exists()) {
    const actorRefs = (orgSnap.data().actorRefs || []).filter((a) => a.charId !== charId);
    await updateDoc(orgRef, { actorRefs }).catch((e) => console.error("unlink org side", e));
  }
}
// Player-adjustable: set this character's own relation level to an org (own doc only).
export async function setCharOrgLevel(campaignId, charId, orgId, level) {
  const charRef = doc(db, "campaigns", campaignId, "characters", charId);
  const charSnap = await getDoc(charRef);
  if (!charSnap.exists()) return;
  const contacts = (charSnap.data().refs?.contacts || []).map((c) =>
    c.orgId === orgId ? { ...c, level } : c);
  await updateDoc(charRef, { "refs.contacts": contacts });
}

export const derive = {
  toughness: derivePhysicalToughness,
  energyMax: deriveEnergyMax,
  initiative: (ch) => ({
    agility: ch.attributes.agility.die,
    smarts: ch.attributes.smarts.die,
    wild: 6,
    modifier: ch.attributes.agility.modifier + ch.attributes.smarts.modifier,
  }),
};
