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
  addDoc, getDocs, query, orderBy, where, writeBatch, deleteDoc, limit,
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
