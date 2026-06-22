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
} from "firebase/firestore";
import { db } from "./firebase";
import { buildBaseSkills } from "./seed-skills";

export const SCHEMA_VERSION = 1;

// ── Подписки (живое обновление) ─────────────────────────────
export function watchCharacter(campaignId, characterId, cb) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null));
}
export function watchCampaign(campaignId, cb) {
  const ref = doc(db, "campaigns", campaignId);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null));
}
export function watchCharacterList(campaignId, cb) {
  const ref = collection(db, "campaigns", campaignId, "characters");
  return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// ── Запись с дебаунсом (чтобы не писать на каждый символ) ───
const _timers = new Map();
export function saveCharacterDebounced(campaignId, characterId, patch, ms = 700) {
  const key = `${campaignId}/${characterId}`;
  clearTimeout(_timers.get(key));
  _timers.set(key, setTimeout(() => {
    const ref = doc(db, "campaigns", campaignId, "characters", characterId);
    updateDoc(ref, patch).catch((e) => console.error("save error", e));
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

// ── Деривативы (считаем на клиенте, не храним) ──────────────
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
