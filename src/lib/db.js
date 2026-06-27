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
    skills: baseSkills,
    relations: [],
    refs: { artifacts: [], companions: [], daemons: [], contacts: [] },
    createdAt: serverTimestamp(),
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
export async function updateScene(campaignId, sceneId, data) {
  await updateDoc(doc(db, "campaigns", campaignId, "scenes", sceneId), data);
}
export async function deleteScene(campaignId, sceneId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "scenes", sceneId));
}
// Batch: deactivate all currently-active scenes, then activate the target.
export async function activateScene(campaignId, sceneId) {
  const activeSnap = await getDocs(
    query(collection(db, "campaigns", campaignId, "scenes"), where("isActive", "==", true)),
  );
  const batch = writeBatch(db);
  activeSnap.docs.forEach((d) => batch.update(d.ref, { isActive: false }));
  batch.update(doc(db, "campaigns", campaignId, "scenes", sceneId), { isActive: true });
  await batch.commit();
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

// ── Time Rewind (B-12) ──────────────────────────────────────
// Applies per-character proposals and advances campaign gameDate.
// Each character is updated independently — partial failure is acceptable (D-20).
export async function applyTimeRewind(campaignId, partyMembers, proposals, newDate, days) {
  for (const ch of partyMembers) {
    const p = proposals[ch.id];
    if (!p) continue;
    const ref = doc(db, "campaigns", campaignId, "characters", ch.id);
    try {
      const patch = {};
      const xpGain = p.idleXp + p.semesterBonus;
      if (xpGain > 0) patch.experience = (ch.experience ?? 0) + xpGain;
      if (p.moneyDelta !== 0) patch.money = Math.max(0, (ch.money ?? 0) + p.moneyDelta);
      // Restore energy to max
      patch["energy.value"] = ch.energy?.max ?? ch.energy?.value ?? 0;
      if (p.healthRegen > 0) {
        patch["health.physical.value"] = Math.max(0, (ch.health?.physical?.value ?? 0) - p.healthRegen);
      }
      if (p.mentalRegen > 0) {
        patch["health.mental.value"] = Math.max(0, (ch.health?.mental?.value ?? 0) - p.mentalRegen);
      }
      if (p.tensionReduce > 0) {
        const newTension = Math.max(0, (ch.tension?.current ?? 0) - p.tensionReduce);
        patch["tension.current"] = newTension;
        if (newTension <= 0) {
          patch["tension.overcap"] = 0;
          patch["tension.energyPenalty"] = 0;
        }
      }
      // Status counter tick — decrement durationRemaining, remove expired statuses
      if (ch.activeStatuses?.length > 0) {
        const ticked = ch.activeStatuses
          .map(s => s.durationMode === "counter"
            ? { ...s, durationRemaining: Math.max(0, (s.durationRemaining ?? 1) - days) }
            : s)
          .filter(s => !(s.durationMode === "counter" && (s.durationRemaining ?? 0) <= 0));
        patch.activeStatuses = ticked;
      }
      await updateDoc(ref, patch);
    } catch (e) {
      console.error(`TimeRewind: skip char ${ch.id}:`, e);
    }
  }
  if (newDate) {
    await updateDoc(doc(db, "campaigns", campaignId), { gameDate: newDate });
  }
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
