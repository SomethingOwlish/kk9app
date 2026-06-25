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
  doc, collection, onSnapshot, setDoc, updateDoc, serverTimestamp,
  addDoc, getDocs, query, orderBy, writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { buildBaseSkills, SKILLS_DATA } from "./seed-skills";

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
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  await setDoc(ref, {
    schemaVersion: SCHEMA_VERSION,
    ownerUid,
    type: "character",
    name,
    portrait: "",
    age,
    gender: "",
    faculty: { id: null, name: "", key: "", color: "#c8a14e" },
    academyYear: "1",
    semester: 1,
    attributes: {
      agility:   { die: 4, modifier: 0 },
      smarts:    { die: 4, modifier: 0 },
      spirit:    { die: 4, modifier: 0 },
      endurance: { die: 4, modifier: 0 },
      magic:     { die: 4, modifier: 0 },
    },
    health: { physical: { value: 0 }, mental: { value: 0 } },
    energy: { value: 0 },
    bennies: 3,
    money: 0,
    experience: 0,
    notes: "",
    skills: buildBaseSkills(),     // массив
    relations: [],                 // заглушка под вкладку «Связи»
    refs: { artifacts: [], companions: [], daemons: [], contacts: [] },
    createdAt: serverTimestamp(),
  });
  // Секретный gm-док (напряжение + gm-заметки) — отдельно, под gm-only правило.
  const gmRef = doc(db, "campaigns", campaignId, "characters", characterId, "private", "gm");
  await setDoc(gmRef, {
    tension: { current: 0, overcap: 0, energyPenalty: 0 },
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
    faculty: { id: null, name: fac.name, key: fac.key, color: fac.color },
    skills: [...currentSkills, ...additions],
  });
}
// ── Ручная редактура (ГМ): одно сохранение по конфирму ──────
export async function updateCharacterNow(campaignId, characterId, patch) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  await updateDoc(ref, patch);
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

export const derive = {
  toughness: (ch) => 2 + Math.floor(ch.attributes.spirit.die / 2),
  energyMax: (ch) => ch.age + ch.attributes.spirit.die,
  initiative: (ch) => ({
    agility: ch.attributes.agility.die,
    smarts: ch.attributes.smarts.die,
    wild: 6,
    modifier: ch.attributes.agility.modifier + ch.attributes.smarts.modifier,
  }),
};
