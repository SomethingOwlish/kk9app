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
  arrayUnion, arrayRemove, deleteField,
} from "firebase/firestore";
import { db } from "./firebase";
import { buildBaseSkills, SKILLS_DATA } from "./seed-skills";
import { derivePhysicalToughness, deriveEnergyMax, deriveTensionMax } from "./derive";
import { tickStatuses } from "./statusEngine";
import { tensionSettings } from "./tension";
import { buildFields as buildRequestFields } from "./requestFields";
import { buildMagicTalents } from "./constants";

// Навык по имени — для подтягивания attr/categ при добавлении.
const SKILL_BY_NAME = Object.fromEntries(SKILLS_DATA.map((s) => [s.name, s]));

export const SCHEMA_VERSION = 1;

// FEAT-19 — empty portrait config. zone:"" = not on the portrait layer.
// emotions[] = [{ id, name, image, effects:[fxId] }] (per-character, like Foundry).
export const PORTRAIT_DEFAULTS = {
  portraitImage: "",
  portraitHeight: 0,
  zone: "",
  emotions: [],
  activeEmotion: "",
  intensityOverride: "",
};

// ── Подписки (живое обновление) ─────────────────────────────
// Shared onSnapshot error handler. Without it, a listener failure (permission
// denied, transport failure on Safari, etc.) is swallowed silently and the UI
// hangs on a loading placeholder forever. `onError`, when supplied by a caller,
// runs after logging so UI-level error surfacing still works.
const snapErr = (label, onError) => (err) => {
  console.error(`${label} snapshot error`, err);
  onError?.(err);
};

export function watchCharacter(campaignId, characterId, cb) {
  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    snapErr("watchCharacter"));
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
  }, snapErr("watchCampaign"));
}
export function watchCharacterList(campaignId, cb) {
  const ref = collection(db, "campaigns", campaignId, "characters");
  return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    snapErr("watchCharacterList"));
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

// ── Кампании — создание / список / удаление (мастер=gm и admin) ──
// Документ кампании: { name, members:{uid:role}, memberUids:[uid], schemaVersion,
//   createdAt, … настройки }. memberUids дублирует ключи members — Firestore не
// умеет искать по наличию динамического ключа в map, поэтому список «мои кампании»
// строится запросом array-contains по memberUids.

// Создать новую кампанию. Создатель становится мастером (gm) новой кампании.
// Доступ «только мастер и admin» гарантируется на уровне UI (кнопка видна лишь
// gm/admin) и правил Firestore (members[создатель] ∈ {gm,admin}). Возвращает id.
export async function createCampaign({ ownerUid, name = "Новая кампания", role = "gm" }) {
  if (!ownerUid) throw new Error("Не указан владелец кампании");
  if (!["gm", "admin"].includes(role)) throw new Error("Создатель должен быть мастером или админом");
  const ref = await addDoc(collection(db, "campaigns"), {
    name,
    members: { [ownerUid]: role },
    memberUids: [ownerUid],
    schemaVersion: SCHEMA_VERSION,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Живой список кампаний, в которых состоит пользователь (для переключателя/входа).
export function watchCampaignsForUser(uid, cb, onError) {
  const q = query(collection(db, "campaigns"), where("memberUids", "array-contains", uid));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchCampaignsForUser", onError));
}
// Разовое чтение того же списка.
export async function listCampaignsForUser(uid) {
  const q = query(collection(db, "campaigns"), where("memberUids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
// Все кампании (для глобального админа на экране выбора). Доступ даёт isGlobalAdmin
// в правилах — обычному игроку/ГМу этот запрос будет отклонён.
export function watchAllCampaigns(cb, onError) {
  return onSnapshot(collection(db, "campaigns"), (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    cb(rows);
  }, snapErr("watchAllCampaigns", onError));
}

// Архивация кампании (пока просто флаг — экран «архив» показывает их заголовками).
export async function setCampaignArchived(campaignId, archived) {
  await updateDoc(doc(db, "campaigns", campaignId), { archived: !!archived });
}

// Добавить/переназначить пользователя в кампанию с ролью membership-уровня
// ("gm" | "player" | "demo"). Пишет и members-map, и memberUids (для запроса).
export async function assignUserToCampaign(campaignId, uid, role = "player") {
  await updateDoc(doc(db, "campaigns", campaignId), {
    [`members.${uid}`]: role,
    memberUids: arrayUnion(uid),
  });
}
// Починка доступа: memberUids должен содержать ВСЕ ключи members-мапы. Если старый
// код (или ручная правка) добавил игрока в members, но не в memberUids, он не
// виден запросу «мои кампании» (array-contains по memberUids) и не попадает на
// экран выбора. Досыпаем недостающие uid. Возвращает true, если что-то починили.
export async function backfillMemberUids(campaign) {
  const members = campaign?.members || {};
  const keys = Object.keys(members);
  const have = new Set(campaign?.memberUids || []);
  const missing = keys.filter((k) => !have.has(k));
  if (missing.length === 0) return false;
  await updateDoc(doc(db, "campaigns", campaign.id), { memberUids: arrayUnion(...missing) });
  return true;
}
// Убрать пользователя из кампании (снимает и members-запись, и memberUids).
export async function removeUserFromCampaign(campaignId, uid) {
  await updateDoc(doc(db, "campaigns", campaignId), {
    [`members.${uid}`]: deleteField(),
    memberUids: arrayRemove(uid),
  });
}
// Привязать карточку персонажа к пользователю (ownerUid). Админ/ГМ-путь.
// Владение персонажем ПОДРАЗУМЕВАЕТ членство: игрока, которому назначили
// персонажа, добавляем в кампанию (members + memberUids), иначе он не увидит её
// на экране выбора и получит «вы не участник». Существующую роль не понижаем.
export async function assignCharacterToUser(campaignId, charId, uid) {
  await updateDoc(doc(db, "campaigns", campaignId, "characters", charId), { ownerUid: uid || null });
  if (!uid) return;
  const campRef = doc(db, "campaigns", campaignId);
  const snap = await getDoc(campRef);
  const members = snap.exists() ? (snap.data().members || {}) : {};
  const patch = { memberUids: arrayUnion(uid) };
  if (!members[uid]) patch[`members.${uid}`] = "player";
  await updateDoc(campRef, patch);
}
// Разовый список карточек кампании (для выпадашки «назначить персонажа»).
export async function listCharacters(campaignId) {
  const snap = await getDocs(collection(db, "campaigns", campaignId, "characters"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ── Пользователи — глобальный реестр (users/{uid}) ───────────
// Документ: { role: "admin"|"gm"|"player", displayName, email, photoURL,
//   createdAt, updatedAt }. Глобальная роль — источник правды для экрана выбора
// и управления пользователями. Первый админ ставится вручную в консоли Firebase;
// правила запрещают самоназначение роли выше "player".

// Гарантировать наличие своего users-дока при входе (только для не-анонимов).
// Роль не перезаписываем — лишь освежаем профиль. Возвращает актуальные данные.
export async function ensureUserDoc(user) {
  if (!user || user.isAnonymous) return null;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data = {
      role: "player",
      displayName: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, data);
    return { id: user.uid, ...data };
  }
  // Освежаем профиль (не роль) — best-effort.
  await updateDoc(ref, {
    displayName: user.displayName || snap.data().displayName || "",
    email: user.email || snap.data().email || "",
    photoURL: user.photoURL || snap.data().photoURL || "",
    updatedAt: serverTimestamp(),
  }).catch(() => {});
  return { id: snap.id, ...snap.data() };
}
export function watchUserDoc(uid, cb, onError) {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (e) => { console.error("watchUserDoc", e); if (onError) onError(e); else cb(null); },
  );
}
// Все пользователи (только глобальный админ — enforced правилами).
export function watchAllUsers(cb) {
  return onSnapshot(collection(db, "users"), (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
    cb(rows);
  }, snapErr("watchAllUsers"));
}
// Сменить глобальную роль пользователя (только админ).
export async function setUserRole(uid, role) {
  if (!["admin", "gm", "player"].includes(role)) throw new Error("Недопустимая роль");
  await updateDoc(doc(db, "users", uid), { role, updatedAt: serverTimestamp() });
}
// Удалить пользователя из системы: снять его из members всех кампаний, где он
// состоит, затем удалить users-док. (Аккаунт Firebase Auth клиент удалить не может.)
export async function deleteUser(uid) {
  const camps = await getDocs(query(collection(db, "campaigns"), where("memberUids", "array-contains", uid)));
  for (const c of camps.docs) {
    await updateDoc(c.ref, { [`members.${uid}`]: deleteField(), memberUids: arrayRemove(uid) }).catch(() => {});
  }
  await deleteDoc(doc(db, "users", uid));
}

// Удалить кампанию (только gm/admin — enforced правилами). Клиент не умеет
// рекурсивно удалять подколлекции, поэтому сначала best-effort чистим известные
// подколлекции пачками (лимит батча 500), затем удаляем сам документ кампании.
export async function deleteCampaign(campaignId) {
  if (!campaignId) throw new Error("Не указана кампания");
  const subcollections = [
    "characters", "items", "scenes", "organizations", "shops",
    "statuses", "library", "sellRequests", "rolls", "chargen_requests",
  ];
  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, "campaigns", campaignId, sub));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, "campaigns", campaignId));
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
    magicTalents: buildMagicTalents(),
    customSkills: [],
    languages: [],
    features: [],
    skills: baseSkills,
    relations: [],
    refs: { artifacts: [], companions: [], daemons: [], contacts: [] },
    // FEAT-19 — portrait layer config (per-character). Missing → all defaults.
    portraitConfig: { ...PORTRAIT_DEFAULTS },
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

// ── Импорт карточки из Foundry (FEAT-20 in-app) ─────────────
// Пишет разобранный документ персонажа (parseFoundryActor) с досчётом
// производных полей, gm-док с заметками и встроенные предметы.
// `parsed` = { doc, gmNotes, items } из lib/foundryImport.js.
export async function createCharacterFromImport(campaignId, characterId, parsed, { ownerUid = null } = {}) {
  const { doc: mapped, gmNotes = "", items = [] } = parsed;

  // Досчитываем производные, если Foundry их не передал (0 = не задано).
  const toughness = mapped.health?.physical?.toughness || derivePhysicalToughness(mapped);
  const energyMax = mapped.energy?.max || deriveEnergyMax(mapped);
  const tensionMax = mapped.tension?.max || deriveTensionMax(mapped);

  const docData = {
    ...mapped,
    schemaVersion: SCHEMA_VERSION,
    ownerUid,
    characterCreated: true,
    health: {
      physical: { value: mapped.health?.physical?.value ?? 0, toughness },
      mental: { value: mapped.health?.mental?.value ?? 0 },
    },
    energy: { value: mapped.energy?.value || energyMax, max: energyMax },
    tension: { ...mapped.tension, max: tensionMax },
    magicTalents: mapped.magicTalents?.length ? mapped.magicTalents : buildMagicTalents(),
    portraitConfig: { ...PORTRAIT_DEFAULTS, portraitImage: mapped.portrait || "" },
    createdAt: serverTimestamp(),
  };

  const ref = doc(db, "campaigns", campaignId, "characters", characterId);
  await setDoc(ref, docData);

  // private/gm — заметки ГМа.
  const gmRef = doc(db, "campaigns", campaignId, "characters", characterId, "private", "gm");
  await setDoc(gmRef, { gmNotes });

  // Встроенные предметы Foundry → коллекция items, привязанные к новой карточке.
  await Promise.all(items.map((it) =>
    addDoc(collection(db, "campaigns", campaignId, "items"),
      { ...it, ownerCharacterId: characterId, createdAt: serverTimestamp() })
  ));

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
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchCharacterLog"));
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
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null), snapErr("watchAdvancementConfig"));
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
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchScenes"));
}
export function watchActiveScene(campaignId, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "scenes"),
    where("isActive", "==", true),
    limit(1),
  );
  return onSnapshot(q, (snap) => cb(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }), snapErr("watchActiveScene"));
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
  return onSnapshot(ref, (snap) => cb(snap.exists() ? snap.data() : null), snapErr("watchGmMode"));
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

// ── Time Rewind (B-56, Foundry parity) ───────────────────────
// Ported from docs/OldCode/kk9/module/gm-board.mjs (_calcProposed +
// _calcNewSemesterAndGrade). Sleep coefficient k=0.8 → sleeps = floor(days*k).
const REWIND_SLEEP_K = 0.8;
const REWIND_DEFAULT_IDLE_XP = 0.5;
const REWIND_DEFAULT_GRADUATE_EXPENSE = 10;

// Whole days between two "YYYY-MM-DD" strings (never negative).
export function rewindDaysBetween(from, to) {
  if (!from || !to) return 0;
  const a = new Date(from);
  const b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

// Semester/grade recompute across all break dates strictly after `from` and
// ≤ `to`. Ported verbatim from _calcNewSemesterAndGrade. Both dates are
// "YYYY-MM-DD" strings. semesterBreak1 → sem 1→2; semesterBreak2 → sem 2→1
// AND grade++ (unless "graduate"). Returns null if no crossing.
export function computeSemesterAndGrade(fromStr, toStr, curSemester, curGrade, campaign) {
  const b1 = campaign?.semesterBreak1 || "06-01";
  const b2 = campaign?.semesterBreak2 || "12-01";
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  const [m1, d1] = b1.split("-").map(Number);
  const [m2, d2] = b2.split("-").map(Number);
  if ([m1, d1, m2, d2].some((n) => !Number.isFinite(n))) return null;

  const crossings = [];
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
    const brk1 = new Date(y, m1 - 1, d1);
    if (brk1 > from && brk1 <= to) crossings.push({ date: brk1, type: "b1" });
    const brk2 = new Date(y, m2 - 1, d2);
    if (brk2 > from && brk2 <= to) crossings.push({ date: brk2, type: "b2" });
  }
  crossings.sort((x, y) => x.date - y.date);

  let sem = curSemester ?? 1;
  let grade = curGrade ?? null;
  for (const { type } of crossings) {
    if (type === "b1") {
      sem = 2;
    } else {
      sem = 1;
      if (grade !== null && grade !== "graduate") {
        const n = parseInt(grade, 10);
        if (!isNaN(n)) grade = String(n + 1);
      }
    }
  }
  return crossings.length > 0 ? { semester: sem, grade } : null;
}

// Device charge restorations for one character. A device is restored to its
// `maxCharges` when it has a finite max (>= 0) and current `charges` is below it.
// NOTE: this app's device schema stores only `charges` (with -1 = infinite);
// `maxCharges`/`max_charges` are optional. Items missing a max are skipped
// (there is no known full value). Returns [{ itemId, name, from, toCharges }].
export async function fetchDeviceRestorations(campaignId, charId) {
  const q = query(
    collection(db, "campaigns", campaignId, "items"),
    where("ownerCharacterId", "==", charId),
  );
  const snap = await getDocs(q);
  const out = [];
  snap.docs.forEach((d) => {
    const it = d.data();
    if (it.type !== "device") return;
    const max = it.maxCharges ?? it.max_charges;
    if (max == null || max < 0) return;      // infinite / unknown → skip
    const cur = it.charges ?? max;
    if (cur >= max) return;                   // already full
    out.push({ itemId: d.id, name: it.name || "устройство", from: cur, toCharges: max });
  });
  return out;
}

// Computes per-character proposals for N idle days at Foundry fidelity.
// Every numeric field is a proposed ABSOLUTE value the GM may edit before apply
// (except xp/money which are deltas — accumulated, not clamped).
// `campaign` provides settings; `currentGameDate`/`targetDate` drive semester math.
export function buildTimeRewindProposals(chars, days, campaign, currentGameDate, targetDate, orgs = []) {
  const orgNameById = new Map((orgs || []).map((o) => [o.id, o.name]));
  const k = REWIND_SLEEP_K;
  const sleeps = Math.floor(days * k);
  const idleExpPerDay = campaign?.idleExpPerDay ?? REWIND_DEFAULT_IDLE_XP;
  const graduateExpense = campaign?.graduateDailyExpense ?? REWIND_DEFAULT_GRADUATE_EXPENSE;
  const salaryMap = campaign?.salaryByGrade || {};

  return chars.map((ch) => {
    const step = ch.type === "npc-light" ? 2 : 1;
    const physCur = ch.health?.physical?.value ?? 0;
    const mentCur = ch.health?.mental?.value ?? 0;
    const energyCur = ch.energy?.value ?? 0;
    const energyMax = ch.energy?.max ?? 0;
    const tensionCur = ch.tension?.current ?? 0;

    const xpDelta = Math.floor(days * idleExpPerDay);

    // Money: graduate spends; enrolled with a monthly stipend earns; else unchanged.
    const grade = ch.academyYear ?? null;
    const money = ch.money ?? 0;
    let moneyTo = money;
    let moneyDelta = 0;
    if (grade === "graduate") {
      moneyTo = Math.max(0, money - Math.floor(days * graduateExpense));
      moneyDelta = moneyTo - money;
    } else if (grade != null && salaryMap[grade] !== undefined) {
      moneyTo = money + Math.floor(days * ((salaryMap[grade] || 0) / 30));
      moneyDelta = moneyTo - money;
    }

    // Semester/grade crossing (may be null → no change).
    const semCalc = computeSemesterAndGrade(
      currentGameDate, targetDate, ch.semester ?? 1, grade, campaign,
    );

    // Relations (companions) — editable proposed levels, default = current.
    const relations = Array.isArray(ch.relations) ? ch.relations : [];
    const companionLevels = relations.map((r) => ({
      id: r.id, name: r.name || "—", from: r.level ?? 0, to: r.level ?? 0,
    }));

    // Contacts — editable proposed levels, default = current.
    const contacts = Array.isArray(ch.refs?.contacts) ? ch.refs.contacts : [];
    const contactLevels = contacts.map((c) => ({
      orgId: c.orgId,
      orgName: orgNameById.get(c.orgId) ?? c.orgId, // GAP-01: human-readable name, fallback to id
      from: c.level ?? 0, to: c.level ?? 0,
    }));

    return {
      charId: ch.id,
      name: ch.name || "—",
      isExtra: false,
      xpDelta,
      moneyDelta,
      moneyTo,
      energyTo: Math.min(energyMax, energyCur + sleeps * 8),
      healthPhysTo: Math.max(0, physCur - sleeps * step),
      healthMentTo: Math.max(0, mentCur - sleeps * step),
      tensionTo: Math.max(0, tensionCur - sleeps),
      semesterTo: semCalc ? semCalc.semester : (ch.semester ?? 1),
      academyYearTo: semCalc ? (semCalc.grade ?? grade) : grade,
      semesterChanged: !!semCalc,
      restoreDevices: true,      // toggle for device recharge
      deviceRestorations: [],    // filled async by the dialog
      companionLevels,
      contactLevels,
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
// Returns array of { charId, ok, error, applied }. `applied` echoes what was
// written so the caller can build an accurate journal summary.
// targetDate: explicit new game date string (YYYY-MM-DD); takes precedence over
// computing it from currentGameDate+days.
export async function applyTimeRewind(campaignId, proposals, days, currentGameDate, targetDate, weather) {
  const results = await Promise.allSettled(
    proposals.map((p) => _applyRewindToChar(campaignId, p)),
  );

  const campaignPatch = {};
  const newDate = targetDate || _advanceDate(currentGameDate, days);
  if (newDate) campaignPatch.gameDate = newDate;
  if (weather !== undefined) campaignPatch.weather = weather;
  if (Object.keys(campaignPatch).length) {
    await updateDoc(doc(db, "campaigns", campaignId), campaignPatch);
  }

  return proposals.map((p, i) => ({
    charId: p.charId,
    name: p.name,
    ok: results[i].status === "fulfilled",
    error: results[i].reason?.message,
    applied: results[i].status === "fulfilled" ? results[i].value : null,
  }));
}

// Writes one character's rewind. Returns an `applied` summary object.
async function _applyRewindToChar(campaignId, p) {
  const ref = doc(db, "campaigns", campaignId, "characters", p.charId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("персонаж не найден");
  const ch = snap.data();

  // Statuses: tick counter-duration (decrement/remove at 0) AND drop charge-mode.
  const statuses = ch.activeStatuses || [];
  const nextStatuses = statuses
    .filter((s) => s.durationMode !== "charges" && s.duration?.mode !== "charges")
    .map((s) => (s.durationMode === "counter" && s.durationRemaining != null
      ? { ...s, durationRemaining: s.durationRemaining - 1 }
      : s))
    .filter((s) => !(s.durationMode === "counter" && (s.durationRemaining ?? 1) <= 0));

  const patch = {
    experience: (ch.experience ?? 0) + (p.xpDelta ?? 0),
    money: (ch.money ?? 0) + (p.moneyDelta ?? 0),
    "energy.value": p.energyTo,
    "health.physical.value": p.healthPhysTo,
    "health.mental.value": p.healthMentTo,
    "tension.current": p.tensionTo,
    activeStatuses: nextStatuses,
  };
  if (p.semesterTo != null) patch.semester = p.semesterTo;
  if (p.academyYearTo != null) patch.academyYear = p.academyYearTo;

  // Companion (relation) levels: overwrite matching entries by id.
  const companionEdits = (p.companionLevels || []).filter((c) => c.to !== c.from);
  if (companionEdits.length && Array.isArray(ch.relations)) {
    const byId = new Map(companionEdits.map((c) => [c.id, c.to]));
    patch.relations = ch.relations.map((r) =>
      byId.has(r.id) ? { ...r, level: byId.get(r.id) } : r);
  }

  // Contact levels (char side): overwrite matching entries by orgId.
  const contactEdits = (p.contactLevels || []).filter((c) => c.to !== c.from);
  if (contactEdits.length && Array.isArray(ch.refs?.contacts)) {
    const byOrg = new Map(contactEdits.map((c) => [c.orgId, c.to]));
    patch["refs.contacts"] = ch.refs.contacts.map((c) =>
      byOrg.has(c.orgId) ? { ...c, level: byOrg.get(c.orgId) } : c);
  }

  await updateDoc(ref, patch);

  // Device recharges — one write per device item.
  const deviceEdits = p.restoreDevices ? (p.deviceRestorations || []) : [];
  await Promise.allSettled(deviceEdits.map((d) =>
    updateDoc(doc(db, "campaigns", campaignId, "items", d.itemId), { charges: d.toCharges })));

  // Contact org-side mirror (organizations/{orgId}.actorRefs[].level).
  await Promise.allSettled(contactEdits.map((c) =>
    _mirrorContactLevelToOrg(campaignId, p.charId, c.orgId, c.to)));

  return {
    xpDelta: p.xpDelta ?? 0,
    moneyDelta: p.moneyDelta ?? 0,
    healthPhysTo: p.healthPhysTo,
    healthMentTo: p.healthMentTo,
    energyTo: p.energyTo,
    tensionTo: p.tensionTo,
    semesterTo: patch.semester,
    academyYearTo: patch.academyYear,
    semesterChanged: p.semesterChanged,
    devices: deviceEdits.map((d) => d.name),
    companions: companionEdits,
    contacts: contactEdits,
  };
}

// Best-effort org-side update of a contact level (mirrors setCharOrgLevel's org half).
async function _mirrorContactLevelToOrg(campaignId, charId, orgId, level) {
  if (!orgId) return;
  const orgRef = doc(db, "campaigns", campaignId, "organizations", orgId);
  const orgSnap = await getDoc(orgRef);
  if (!orgSnap.exists()) return;
  const actorRefs = orgSnap.data().actorRefs || [];
  const next = actorRefs.map((a) => (a.charId === charId ? { ...a, level } : a));
  await updateDoc(orgRef, { actorRefs: next });
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
    // Foundry parity (gm-board.mjs:_writeToJournal): archive once the page count
    // reaches the threshold, keeping the newest `threshold - 1` pages visible.
    if (pages.length >= threshold) {
      const batch = writeBatch(db);
      pages.slice(threshold - 1).forEach((p) => {
        batch.update(doc(db, "campaigns", campaignId, "journal", stream, "pages", p.id), { isArchived: true });
      });
      batch.commit().catch(console.error);
    }
  }, snapErr("watchJournalPages"));
}

// Read-only newest non-archived page of a stream (for the landing Session block).
// Unlike watchJournalPages it never writes archive flags — safe for players.
export function watchLatestJournalPage(campaignId, stream, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "journal", stream, "pages"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => {
    const first = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .find((p) => !p.isArchived) || null;
    cb(first);
  }, snapErr("watchLatestJournalPage"));
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
  return onSnapshot(ref, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchStatuses"));
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
// Instance includes: { _uid, definitionId, name, status_types, apply_stun,
//   durationMode, durationRemaining, effects[], progresses, progress_every,
//   progress_into_names, progressCount, tickCount, source }
export async function applyStatus(campaignId, charId, instance) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  const patch = { activeStatuses: arrayUnion(instance) };
  if (instance.apply_stun) patch.is_stunned = true; // B-53: apply_stun → stun
  await updateDoc(ref, patch);
}

// Removes a specific status instance from character.activeStatuses[].
// Must pass the exact same object that was stored (arrayRemove uses deep equality).
// Pass activeStatuses to recompute is_stunned (stun drops when the last apply_stun
// status leaves). Omit it to leave is_stunned untouched (back-compat).
export async function removeStatus(campaignId, charId, instance, activeStatuses = null) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  const patch = { activeStatuses: arrayRemove(instance) };
  if (Array.isArray(activeStatuses)) {
    // Stun holds while any OTHER apply_stun status remains on the character.
    patch.is_stunned = activeStatuses.some((s) => s.apply_stun && s._uid !== instance._uid);
  }
  await updateDoc(ref, patch);
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
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchNpcs"));
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
// Place an existing Library NPC on the board WITHOUT copying its statblock.
// The board doc holds only a reference (libraryRef + kind) plus live per-board
// state; attributes/toughness/skills are resolved from the Library entry at read
// time (see resolveNpc in lib/npc.js). Light NPCs are excluded by the caller.
export async function createNpcFromLibrary(campaignId, entry = {}) {
  const ref = doc(collection(db, "campaigns", campaignId, "characters"));
  await setDoc(ref, {
    isNpc: true,
    libraryRef: entry.id || null,
    kind: entry.kind || "npc-hard",
    name: entry.name || "Новый НПС",
    img: entry.img || "",
    // Live-only state — statblock AND relations stay in the Library entry.
    health: { physical: { value: 0 } },
    overflow_damage: 0,
    activeStatuses: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Bidirectional relation mirror. After actor A's relations are saved, diff the
// previous vs next ref-links and write the reverse relation onto each added
// target, or strip it from each removed target — but only for targets the
// caller may write (canWriteTarget). A target is resolved as a character doc or,
// failing that, a Library entry (Library NPCs carry relations too). Targets that
// resolve to neither are silently skipped → one-directional.
export async function mirrorRelations(campaignId, prevRels, nextRels, self, canWriteTarget) {
  const refsOf = (arr) => new Set((arr || []).filter((r) => r.ref).map((r) => r.ref));
  const prev = refsOf(prevRels);
  const next = refsOf(nextRels);
  const added   = [...next].filter((r) => !prev.has(r) && r !== self.id);
  const removed = [...prev].filter((r) => !next.has(r) && r !== self.id);

  const resolveRef = async (targetId) => {
    for (const col of ["characters", "library"]) {
      const ref = doc(db, "campaigns", campaignId, col, targetId);
      const snap = await getDoc(ref).catch(() => null);
      if (snap && snap.exists()) return { ref, snap };
    }
    return null;
  };

  const writeTarget = async (targetId, mutate) => {
    if (canWriteTarget && !canWriteTarget(targetId)) return;
    const found = await resolveRef(targetId);
    if (!found) return; // no actor/library doc — nothing to mirror onto
    const cur = Array.isArray(found.snap.data().relations) ? found.snap.data().relations : [];
    const nextArr = mutate(cur);
    if (nextArr) await updateDoc(found.ref, { relations: nextArr }).catch(() => {});
  };

  for (const targetId of added) {
    await writeTarget(targetId, (cur) => {
      if (cur.some((r) => r.ref === self.id)) return null; // already linked
      return [...cur, {
        id: Math.random().toString(36).slice(2, 10),
        name: self.name || "", ref: self.id, portrait: self.portrait || "",
        level: 0, tags: [], notes: "",
      }];
    });
  }
  for (const targetId of removed) {
    await writeTarget(targetId, (cur) => {
      const filtered = cur.filter((r) => r.ref !== self.id);
      return filtered.length === cur.length ? null : filtered;
    });
  }
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
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchItemsByOwner"));
}
export async function createItem(campaignId, data) {
  const ref = collection(db, "campaigns", campaignId, "items");
  return addDoc(ref, { ...data, createdAt: serverTimestamp() });
}
export async function updateItem(campaignId, itemId, data) {
  await updateDoc(doc(db, "campaigns", campaignId, "items", itemId), data);
}
// Toggle an item's activation (active) or equipped flag. Used by item roller.
export async function setItemFlag(campaignId, itemId, field, value) {
  await updateDoc(doc(db, "campaigns", campaignId, "items", itemId), { [field]: value });
}
export async function deleteItem(campaignId, itemId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "items", itemId));
}
export function watchItemsByType(campaignId, type, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "items"),
    where("type", "==", type)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchItemsByType"));
}
export function watchAllItems(campaignId, cb) {
  return onSnapshot(collection(db, "campaigns", campaignId, "items"), (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a.type || "").localeCompare(b.type || "") || (a.name || "").localeCompare(b.name || ""));
    cb(items);
  }, snapErr("watchAllItems"));
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

// Refresh DEFINITIONAL fields on every OWNED item from the seed catalogs (matched
// by type + name), preserving per-instance state. Items handed to a character are
// copied at assign time (or, for artifacts, are the catalog doc); a later seed
// update therefore never reaches those already-assigned copies, leaving them on
// the old, thin schema (e.g. spells missing hasStatus/damageType/soakType). This
// re-syncs them so buffs/soak/damage work. seedByType: { spell: SPELLS_DATA, ... }.
export async function resyncOwnedItems(campaignId, seedByType) {
  const col = collection(db, "campaigns", campaignId, "items");
  const snap = await getDocs(col);
  const owned = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((it) => it.ownerCharacterId != null);
  // Never overwrite identity or per-instance state on the owned copy.
  const KEEP = new Set([
    "type", "name", "ownerCharacterId", "createdAt",
    "active", "equipped", "condition", "charges", "maxCharges",
    "soakAbsoluteCurrent", "quantity", "destroyed", "usesRemaining",
  ]);
  const batch = writeBatch(db);
  let updated = 0;
  for (const it of owned) {
    const arr = seedByType[it.type];
    if (!Array.isArray(arr)) continue;
    const tmpl = arr.find((t) => t.name === it.name);
    if (!tmpl) continue; // custom / renamed item — leave as-is
    const patch = {};
    for (const [k, v] of Object.entries(tmpl)) {
      if (KEEP.has(k)) continue;
      if (JSON.stringify(it[k]) !== JSON.stringify(v)) patch[k] = v;
    }
    if (Object.keys(patch).length) { batch.update(doc(col, it.id), patch); updated++; }
  }
  if (updated > 0) await batch.commit();
  return updated;
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
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchRolls"));
}

// Applies post-roll character mutations (status tick + tension) as ONE merged
// patch to avoid races, then writes the roll-log entry.
//   outcome: result of computeTensionOutcome (or null)
//   exhaustionInstance: status instance to add when outcome.addExhaustion
export async function applyRollOutcome(campaignId, charId, ch, { outcome, exhaustionInstance, spellStatusInstance, rollData, charPatch, campaignStatuses, campaign }) {
  const tickPatch = tickStatuses(ch, {
    campaignStatuses: campaignStatuses || [],
    settings: tensionSettings(campaign),
    chargesPerTrigger: campaign?.statusChargesPerTrigger,
  }) || {};
  const merged = { ...tickPatch };

  if (outcome?.tensionPatch) Object.assign(merged, outcome.tensionPatch);
  // Extra character patch from the roll (e.g. spell energy cost). Applied last so
  // it overrides any tick-derived energy change for the same field.
  if (charPatch && typeof charPatch === "object") Object.assign(merged, charPatch);

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
  // Self-buff status from a successful spell cast (RollDialog builds the instance).
  if (spellStatusInstance && !statuses.some((s) => s.name === spellStatusInstance.name)) {
    statuses = [...statuses, spellStatusInstance];
  }
  if (tickPatch.activeStatuses || outcome?.removeExhaustion || outcome?.addExhaustion || spellStatusInstance) {
    merged.activeStatuses = statuses;
  }

  if (Object.keys(merged).length > 0) {
    await updateCharacterNow(campaignId, charId, merged);
  }
  if (rollData) await addRollEntry(campaignId, rollData);
}

// Reroll (B-57, жетон судьбы / «Долг судьбы»): spends one bennie, appends the
// fate-debt status, and logs the replayed roll. NO status tick and NO tension —
// the original roll already consumed those (Foundry: no status-charge recharge).
// The player self-decrements their own bennies (rules allow decrease-only, so no
// GM approval is needed — unlike sells).
export async function applyReroll(campaignId, charId, { rollData, fateDebtInstance }) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("not found");
  const ch = snap.data();
  const bennies = ch.bennies ?? 0;
  if (bennies < 1) throw new Error("Нет жетонов судьбы");
  const statuses = ch.activeStatuses || [];
  await updateDoc(ref, {
    bennies: Math.max(0, bennies - 1),
    activeStatuses: fateDebtInstance ? [...statuses, fateDebtInstance] : statuses,
  });
  if (rollData) await addRollEntry(campaignId, rollData);
}

// ── Combat: attacks (Tier 9 / B-54, defender-resolves) ───────
// Path: campaigns/{id}/attacks/{attackId}. One doc per (attacker → target).
// The attacker (or GM) writes a pending attack; the target's owner (or GM for
// NPC targets) resolves soak on their OWN character via src/lib/soak.js and
// commits the resulting plan through resolveAttackOnSelf. The doc is a pure
// coordination signal — the privileged health/item writes are the defender's.
//
// attack doc shape:
//   { attackerCharId, attackerName, targetCharId, targetName, targetKind,
//     attackData: { attackSuccesses, damageType, damageLevel, extraPips,
//                   isAreaAttack, hasStatus, statusName, bypassSoak, unresistable,
//                   attackSource }, resolved: bool, at }
export async function createAttack(campaignId, attack) {
  const ref = collection(db, "campaigns", campaignId, "attacks");
  return addDoc(ref, { resolved: false, ...attack, at: serverTimestamp() });
}
// One write per target — AoE writes N docs so each defender resolves independently
// (and the per-target-owner rule stays enforceable). Returns the created ids.
export async function createAttacks(campaignId, attacks) {
  const ids = [];
  for (const a of attacks) {
    const d = await createAttack(campaignId, a);
    ids.push(d.id);
  }
  return ids;
}
export function watchAttacks(campaignId, cb, n = 30) {
  const q = query(
    collection(db, "campaigns", campaignId, "attacks"),
    orderBy("at", "desc"),
    limit(n),
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchAttacks"));
}
// Mark handled without applying damage (miss already filtered, GM override, or
// an unresistable/dismissed attack). GM or the target owner only (rules).
export async function dismissAttack(campaignId, attackId, note = "") {
  const ref = doc(db, "campaigns", campaignId, "attacks", attackId);
  await updateDoc(ref, { resolved: true, dismissed: true, resolveNote: note, resolvedAt: serverTimestamp() });
}
// Commit the defender's soak resolution: apply the computed plan to the target's
// OWN character (health pips + status instances) and their OWN items (soak
// resource consumption), then mark the attack resolved. All writes are the
// defender's own docs, so this runs under the player (or GM) credential.
//   plan: { healthPatch:{["health.physical.value"]?, ["health.mental.value"]?},
//           statusInstances:[<runtime status instance>],
//           itemPatches:[{ itemId, fields:{...} }],
//           soakSuccesses, degree, resolveNote }
export async function resolveAttackOnSelf(campaignId, charId, ch, attackId, plan = {}) {
  const { healthPatch = {}, statusInstances = [], itemPatches = [], activeSpellsPatch, resolveNote = "" } = plan;

  // 1) Character patch (health pips + any added statuses), merged into one write.
  const charPatch = { ...healthPatch };
  if (statusInstances.length) {
    const existing = ch.activeStatuses || [];
    // De-dupe by name so re-resolves don't stack the same bleed twice.
    const toAdd = statusInstances.filter((s) => !existing.some((e) => e.name === s.name));
    if (toAdd.length) charPatch.activeStatuses = [...existing, ...toAdd];
  }
  // SKIP-03: a depleted defensive spell rewrites the whole activeSpells[] array.
  if (Array.isArray(activeSpellsPatch)) charPatch.activeSpells = activeSpellsPatch;
  if (Object.keys(charPatch).length) {
    await updateCharacterNow(campaignId, charId, charPatch);
  }

  // 2) Item soak-resource consumption (absolute-protection current / bonus uses).
  for (const p of itemPatches) {
    if (p?.itemId && p.fields && Object.keys(p.fields).length) {
      await updateItem(campaignId, p.itemId, p.fields);
    }
  }

  // 3) Mark the coordination doc resolved.
  if (attackId) {
    const ref = doc(db, "campaigns", campaignId, "attacks", attackId);
    await updateDoc(ref, {
      resolved: true,
      resolveNote,
      soakSuccesses: plan.soakSuccesses ?? null,
      degree: plan.degree ?? null,
      resolvedAt: serverTimestamp(),
    });
  }
}

// ── Organizations / Contacts (FEAT-14, reshaped) ─────────────
// NOT items. Collection: campaigns/{id}/organizations/{orgId}.
// Schema (IMP-16, Foundry ContactDataModel parity):
//   { name, description, orgType, accessLevel, leader, representative, goals,
//     notes, members: [{charId,charName}], formerMembers: [{charName,comment}],
//     events[], visibleToPlayers: bool, actorRefs: [{ charId, charName, level }] }
// Character side mirror: character.refs.contacts[] = [{ orgId, level }].

// Lazy migration: old org.members were plain strings; normalize to objects.
export function normalizeMembers(members) {
  return (Array.isArray(members) ? members : [])
    .map((m) => (typeof m === "string" ? { charId: null, charName: m } : m))
    .filter((m) => m && (m.charName || m.charId));
}
// onlyVisible: players MUST constrain the query to visibleToPlayers==true, else
// the collection listener is denied wholesale (a GM-only doc fails the read rule).
export function watchOrganizations(campaignId, cb, onlyVisible = false) {
  const col = collection(db, "campaigns", campaignId, "organizations");
  const ref = onlyVisible ? query(col, where("visibleToPlayers", "==", true)) : col;
  return onSnapshot(ref, (snap) => {
    const orgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    orgs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    cb(orgs);
  }, snapErr("watchOrganizations"));
}
export async function createOrganization(campaignId, data) {
  const ref = collection(db, "campaigns", campaignId, "organizations");
  return addDoc(ref, {
    name: "Новая организация", description: "", orgType: "other", accessLevel: "open",
    leader: "", representative: "", goals: "", notes: "",
    members: [], formerMembers: [], events: [], visibleToPlayers: false, actorRefs: [],
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

// ── Shop (FEAT-17 / B-19) ────────────────────────────────────
// Collection: campaigns/{id}/shops/{shopId}
// Schema: { name, mode: "buy"|"sell", allowSellBack, uniqueStock: [{ itemId, price }],
//           stackableStock: [{ itemData:{…snapshot}, quantity, price }],
//           journals: [{ itemName, soldPrice, at }], defaultPrices: { [type]: number } }
//
// D-22: players purchase/sell directly (no GM approval). The purchase/sell helpers
// run as Firestore transactions so stock decrement + money change + item transfer
// either all commit or none do. Security: GM writes any shop field; a player may
// only touch the stock/journal arrays (the restricted purchase path) and may only
// claim/release/create items tied to their own character (firestore.rules).
export function watchShopList(campaignId, cb) {
  const col = collection(db, "campaigns", campaignId, "shops");
  return onSnapshot(col, (snap) => {
    const shops = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    shops.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    cb(shops);
  }, snapErr("watchShopList"));
}
export async function createShop(campaignId, data = {}) {
  const col = collection(db, "campaigns", campaignId, "shops");
  return addDoc(col, {
    name: "Новый магазин", mode: "buy", allowSellBack: false, isOpen: true,
    uniqueStock: [], stackableStock: [], journals: [], defaultPrices: {},
    ...data, createdAt: serverTimestamp(),
  });
}
export async function updateShop(campaignId, shopId, data) {
  await updateDoc(doc(db, "campaigns", campaignId, "shops", shopId), data);
}
export async function deleteShop(campaignId, shopId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "shops", shopId));
}

// Strip non-template fields off a snapshot before it is stored/re-created.
function _cleanItemSnapshot(data = {}) {
  // eslint-disable-next-line no-unused-vars
  const { id: _id, createdAt: _ca, ownerCharacterId: _oc, ...rest } = data;
  return rest;
}

// Atomic stackable purchase: decrement shop stock, debit buyer money, create the
// item copy for the buyer — all or nothing. Throws on stock-gone / insufficient money.
export async function purchaseStackable(campaignId, shopId, stockIndex, buyerCharId, quantity) {
  const shopRef = doc(db, "campaigns", campaignId, "shops", shopId);
  const charRef = doc(db, "campaigns", campaignId, "characters", buyerCharId);
  const itemRef = doc(collection(db, "campaigns", campaignId, "items"));
  return runTransaction(db, async (tx) => {
    const [shopSnap, charSnap] = await Promise.all([tx.get(shopRef), tx.get(charRef)]);
    if (!shopSnap.exists()) throw new Error("Магазин не найден");
    if (!charSnap.exists()) throw new Error("Персонаж не найден");
    const stock = Array.isArray(shopSnap.data().stackableStock) ? [...shopSnap.data().stackableStock] : [];
    const entry = stock[stockIndex];
    if (!entry) throw new Error("Товара больше нет");
    const qty = Math.max(1, Math.floor(quantity || 1));
    if (qty > (entry.quantity ?? 0)) throw new Error("Недостаточно на складе");
    const total = (entry.price ?? 0) * qty;
    const money = charSnap.data().money ?? 0;
    if (money < total) throw new Error("Недостаточно денег");

    // B-50/D1: the player may not write the shop doc. Self-service buy only
    // debits the buyer's money and mints the owned item copy. (Stackable
    // quantity is therefore not decremented on a player buy — a documented
    // free-tier limitation; GM restock/edit remains authoritative.)
    tx.update(charRef, { money: money - total });
    tx.set(itemRef, {
      ..._cleanItemSnapshot(entry.itemData || {}),
      quantity: qty,
      ownerCharacterId: buyerCharId,
      createdAt: serverTimestamp(),
    });
    return { name: entry.itemData?.name || "товар", price: total };
  });
}

// Atomic unique purchase: remove the entry from uniqueStock, debit buyer money,
// reassign the existing catalog item's ownerCharacterId to the buyer.
export async function purchaseUnique(campaignId, shopId, itemId, buyerCharId) {
  const shopRef = doc(db, "campaigns", campaignId, "shops", shopId);
  const charRef = doc(db, "campaigns", campaignId, "characters", buyerCharId);
  const itemRef = doc(db, "campaigns", campaignId, "items", itemId);
  return runTransaction(db, async (tx) => {
    const [shopSnap, charSnap, itemSnap] = await Promise.all([tx.get(shopRef), tx.get(charRef), tx.get(itemRef)]);
    if (!shopSnap.exists()) throw new Error("Магазин не найден");
    if (!charSnap.exists()) throw new Error("Персонаж не найден");
    if (!itemSnap.exists()) throw new Error("Предмет не найден");
    const uniqueStock = Array.isArray(shopSnap.data().uniqueStock) ? shopSnap.data().uniqueStock : [];
    const idx = uniqueStock.findIndex((u) => u.itemId === itemId);
    if (idx === -1) throw new Error("Предмет уже продан");
    if (itemSnap.data().ownerCharacterId != null) throw new Error("Предмет уже занят");
    const total = uniqueStock[idx].price ?? 0;
    const money = charSnap.data().money ?? 0;
    if (money < total) throw new Error("Недостаточно денег");

    // B-50/D1: no shop-doc write on a player buy. Claiming the catalog item
    // (null→buyer) is what marks it sold; the stale uniqueStock entry is pruned
    // by the GM, and a re-buy is blocked by the ownerCharacterId precondition
    // above ("Предмет уже занят").
    tx.update(charRef, { money: money - total });
    tx.update(itemRef, { ownerCharacterId: buyerCharId });
    return { name: itemSnap.data().name || "предмет", price: total };
  });
}

// B-50/D1: selling requires GM approval. A player cannot credit their own money
// (the character rule forbids money increases), so instead they file a sell
// request. The GM reviews it, sets the final price, and commits the payout.

// Player files a request to sell an owned item. Writes no money/stock.
// `suggestedPrice` is the player's asking price; the GM may change it on approval.
export async function requestSell(campaignId, shopId, charId, ownerUid, item, suggestedPrice) {
  const col = collection(db, "campaigns", campaignId, "sellRequests");
  await addDoc(col, {
    shopId,
    charId,
    ownerUid,
    itemId: item.id,
    itemName: item.name || "предмет",
    itemType: item.type || "",
    suggestedPrice: Math.max(0, Math.floor(suggestedPrice || 0)),
    status: "pending",
    at: serverTimestamp(),
  });
  return { name: item.name || "предмет", price: Math.max(0, Math.floor(suggestedPrice || 0)) };
}

// GM lists pending sell requests (newest first).
export function watchSellRequests(campaignId, cb) {
  const q = query(collection(db, "campaigns", campaignId, "sellRequests"), orderBy("at", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), snapErr("watchSellRequests"));
}

// GM approves a sell request at `finalPrice`: release the item back to the
// catalog, credit the seller's money, log the sale to the shop journal, and
// delete the request — all atomically. Runs on the GM path (rules-exempt).
export async function approveSell(campaignId, req, finalPrice) {
  const reqRef = doc(db, "campaigns", campaignId, "sellRequests", req.id);
  const charRef = doc(db, "campaigns", campaignId, "characters", req.charId);
  const itemRef = doc(db, "campaigns", campaignId, "items", req.itemId);
  const shopRef = req.shopId ? doc(db, "campaigns", campaignId, "shops", req.shopId) : null;
  return runTransaction(db, async (tx) => {
    const reads = [tx.get(charRef), tx.get(itemRef)];
    if (shopRef) reads.push(tx.get(shopRef));
    const [charSnap, itemSnap, shopSnap] = await Promise.all(reads);
    if (!charSnap.exists()) throw new Error("Персонаж не найден");
    if (!itemSnap.exists()) throw new Error("Предмет не найден");
    if (itemSnap.data().ownerCharacterId !== req.charId) throw new Error("Предмет больше не принадлежит игроку");
    const proceeds = Math.max(0, Math.floor(finalPrice ?? req.suggestedPrice ?? 0));
    const money = charSnap.data().money ?? 0;

    tx.update(itemRef, { ownerCharacterId: null });
    tx.update(charRef, { money: money + proceeds });
    if (shopSnap && shopSnap.exists()) {
      const journals = Array.isArray(shopSnap.data().journals) ? shopSnap.data().journals : [];
      // serverTimestamp() is not allowed inside array elements — use an ISO stamp.
      tx.update(shopRef, { journals: [...journals, { itemName: req.itemName || "предмет", soldPrice: proceeds, at: new Date().toISOString() }] });
    }
    tx.delete(reqRef);
    return { name: req.itemName || "предмет", price: proceeds };
  });
}

// GM (or the requesting player) cancels a sell request without paying out.
export async function rejectSell(campaignId, reqId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "sellRequests", reqId));
}

// ── Player Requests (Tier 10 / B-64 + B-65) ─────────────────
// A player files a request for an item/skill/feature/info-plot; the GM reviews
// a per-character queue and approves (creates the real entity on the target
// card) or denies. Mirrors the sellRequests queue/approval pattern. Enum values
// stay ASCII; RU labels live in requestFields.js. Path:
//   campaigns/{cid}/requests/{requestId}
const reqMillis = (r) => (r?.createdAt?.toMillis ? r.createdAt.toMillis() : 0);

// Player files a new request. `history.submitted` is frozen at first submit and
// never overwritten; approval later reads the LAST-saved payload (GM wins).
export async function createRequest(campaignId, { kind, requesterUid, targetCharacterId, targetCharacterName, payload = {}, gmAnswer = "" }) {
  const col = collection(db, "campaigns", campaignId, "requests");
  const now = new Date().toISOString();
  return addDoc(col, {
    schemaVersion: 1,
    kind,
    requesterUid,
    targetCharacterId,
    targetCharacterName: targetCharacterName || "",
    status: "in_process",
    payload,
    gmAnswer,
    includePlayerDescription: false,
    history: { submitted: { at: now, byUid: requesterUid, payload } },
    createdEntity: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Edit an in-process request (player edits own; GM edits any). Never touches
// status/routing or history.submitted. `patch` carries payload/gmAnswer/
// includePlayerDescription.
export async function updateRequest(campaignId, requestId, patch) {
  await updateDoc(doc(db, "campaigns", campaignId, "requests", requestId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

// Player withdraws own in-process request — hard delete (O-3 default).
export async function withdrawRequest(campaignId, requestId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "requests", requestId));
}

// Player: live list of OWN requests (any status). Rules allow a member to read
// only requests where requesterUid == their uid, so the query must be scoped.
export function watchMyRequests(campaignId, uid, cb) {
  const q = query(
    collection(db, "campaigns", campaignId, "requests"),
    where("requesterUid", "==", uid),
  );
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => reqMillis(b) - reqMillis(a));
    cb(rows);
  }, snapErr("watchMyRequests"));
}

// GM: live list of ALL requests (queue).
export function watchRequests(campaignId, cb) {
  return onSnapshot(collection(db, "campaigns", campaignId, "requests"), (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => reqMillis(b) - reqMillis(a));
    cb(rows);
  }, snapErr("watchRequests"));
}

// GM denies a request: lock it, no entity created.
export async function denyRequest(campaignId, requestId, resolvedByUid) {
  await updateDoc(doc(db, "campaigns", campaignId, "requests", requestId), {
    status: "denied",
    resolvedAt: serverTimestamp(),
    resolvedByUid: resolvedByUid || null,
    updatedAt: serverTimestamp(),
  });
}

// GM approves a request. Atomically (one transaction):
//   1. builds the entity from the LAST-saved values (payload/gmAnswer):
//        item       → new campaigns/{cid}/items doc, ownerCharacterId = target
//        skill      → append to character.skills[]
//        feature    → append to character.features[]
//        info-plot  → append to character.notes[] (markdown body)
//   2. marks the request applied + freezes history.applied + records createdEntity
//   3. writes a provenance entry to the character's log subcollection
// so a half-applied request can never exist. `final` = { payload, gmAnswer,
// includePlayerDescription, resolvedByUid }.
export async function approveRequest(campaignId, req, final = {}) {
  const payload = final.payload || req.payload || {};
  const gmAnswer = final.gmAnswer ?? req.gmAnswer ?? "";
  const includePlayerDescription = !!final.includePlayerDescription;
  const resolvedByUid = final.resolvedByUid || null;
  const charId = req.targetCharacterId;
  const name = (payload.name || "").trim() || "Без названия";
  const description = payload.description || "";

  if (req.kind === "info-plot" && !gmAnswer.trim()) {
    throw new Error("Для инфо-сюжета обязателен ответ ГМ");
  }

  const reqRef = doc(db, "campaigns", campaignId, "requests", req.id);
  const charRef = doc(db, "campaigns", campaignId, "characters", charId);
  const logRef = doc(collection(db, "campaigns", campaignId, "characters", charId, "log"));
  const itemRef = req.kind === "item"
    ? doc(collection(db, "campaigns", campaignId, "items"))
    : null;
  const nowIso = new Date().toISOString();

  return runTransaction(db, async (tx) => {
    const [reqSnap, charSnap] = await Promise.all([tx.get(reqRef), tx.get(charRef)]);
    if (!reqSnap.exists()) throw new Error("Заявка не найдена");
    if (reqSnap.data().status !== "in_process") throw new Error("Заявка уже обработана");
    if (!charSnap.exists()) throw new Error("Персонаж не найден");
    const ch = charSnap.data();

    let createdEntity;
    let logDetail;

    if (req.kind === "item") {
      const subtype = payload.itemType || "gear";
      const fields = buildRequestFields("item", subtype, payload);
      tx.set(itemRef, {
        type: subtype,
        name,
        description,
        ownerCharacterId: charId,
        condition: "good",
        equipped: "home",
        ...fields,
        createdAt: serverTimestamp(),
      });
      createdEntity = { type: "item", itemId: itemRef.id, key: name };
      logDetail = `Предмет: ${name}`;
    } else if (req.kind === "skill") {
      const fields = buildRequestFields("skill", null, payload);
      const entry = { name, description, ...fields };
      const skills = Array.isArray(ch.skills) ? ch.skills : [];
      tx.update(charRef, { skills: [...skills, entry] });
      createdEntity = { type: "skill", key: name };
      logDetail = `Навык: ${name}`;
    } else if (req.kind === "feature") {
      const fields = buildRequestFields("feature", null, payload);
      const entry = {
        name,
        description,
        is_weakness: !!fields.is_weakness,
        modifier: fields.modifier || {},
        folder: fields.is_weakness ? "Слабости" : "Силы",
      };
      const features = Array.isArray(ch.features) ? ch.features : [];
      tx.update(charRef, { features: [...features, entry] });
      createdEntity = { type: "feature", key: name };
      logDetail = `Черта: ${name}`;
    } else {
      // info-plot → formatted note: **player desc** (optional) then *GM answer*.
      const body =
        (includePlayerDescription && description ? `**${description}**\n\n` : "") +
        `*${gmAnswer}*`;
      const note = { title: name, body, at: nowIso, uid: req.requesterUid || "" };
      const notes = Array.isArray(ch.notes) ? ch.notes : [];
      tx.update(charRef, { notes: [...notes, note] });
      createdEntity = { type: "note", key: nowIso };
      logDetail = `Инфо-сюжет: ${name}`;
    }

    tx.update(reqRef, {
      status: "applied",
      payload,
      gmAnswer,
      includePlayerDescription,
      resolvedAt: serverTimestamp(),
      resolvedByUid,
      createdEntity,
      "history.applied": { at: nowIso, byUid: resolvedByUid, payload, createdRef: createdEntity },
      updatedAt: serverTimestamp(),
    });
    tx.set(logRef, { type: "request_applied", kind: req.kind, detail: logDetail, at: serverTimestamp() });

    return createdEntity;
  });
}

// ── FEAT-19 · Portrait config (per character) ────────────────
// Stored on the character doc under portraitConfig. GM-written from the dock;
// every member reads it (it rides on the character read rule). The "presence"
// (which zone a portrait is in) is just portraitConfig.zone persisted to
// Firestore — this is the web-native replacement for the Foundry socket layer,
// so every client's portrait layer stays in sync via watchCharacterList.
export async function updatePortraitConfig(campaignId, charId, config) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  const merged = { ...PORTRAIT_DEFAULTS, ...(config || {}) };
  await updateDoc(ref, { portraitConfig: merged });
}

// ── FEAT-04 (reshaped) · Library — GM reference collection ───
// Path: campaigns/{id}/library/{entryId}. GM-curated bestiary/reference for
// NPCs (all weights), faculty curators, faculties, companions, and daemons.
// Mirrors the organizations visibility model: each card has visibleToPlayers
// (default false → GM-only). Players MUST query visible-only or the whole
// collection listener is denied (a GM-only doc fails the per-doc read rule).
// kind: "npc-light" | "npc-hard" | "npc-boss" | "curator" | "faculty"
//       | "companion" | "daemon"
export function watchLibrary(campaignId, cb, onlyVisible = false) {
  const col = collection(db, "campaigns", campaignId, "library");
  const ref = onlyVisible ? query(col, where("visibleToPlayers", "==", true)) : col;
  return onSnapshot(ref, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (a.kind || "").localeCompare(b.kind || "") || (a.name || "").localeCompare(b.name || ""));
    cb(rows);
  }, snapErr("watchLibrary"));
}
export async function createLibraryEntry(campaignId, data) {
  const ref = collection(db, "campaigns", campaignId, "library");
  return addDoc(ref, {
    kind: "npc-light", name: "Новая запись", img: "", description: "",
    visibleToPlayers: false,
    ...data,
    createdAt: serverTimestamp(),
  });
}
export async function updateLibraryEntry(campaignId, entryId, patch) {
  await updateDoc(doc(db, "campaigns", campaignId, "library", entryId), patch);
}
export async function deleteLibraryEntry(campaignId, entryId) {
  await deleteDoc(doc(db, "campaigns", campaignId, "library", entryId));
}
// Batch-seed one kind from a static data array. Idempotent by (kind,name):
// existing entries of that kind are left untouched. Returns count added.
export async function seedLibrary(campaignId, kind, dataArr = []) {
  const col = collection(db, "campaigns", campaignId, "library");
  const snap = await getDocs(query(col, where("kind", "==", kind)));
  const existing = new Set(snap.docs.map((d) => d.data().name));
  const batch = writeBatch(db);
  let added = 0;
  for (const entry of dataArr) {
    if (existing.has(entry.name)) continue;
    batch.set(doc(col), {
      kind, visibleToPlayers: false, img: "", description: "",
      ...entry, createdAt: serverTimestamp(),
    });
    added++;
  }
  if (added > 0) await batch.commit();
  return added;
}

// ── TASK-074 · Daemon links (character.refs.daemons[]) ───────
// Daemons are full-schema Library entries (kind:"daemon"). A character
// references the Library entry id; the sheet's Daemons section resolves it.
export async function linkDaemonToChar(campaignId, charId, daemonId) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  await updateDoc(ref, { "refs.daemons": arrayUnion(daemonId) });
}
export async function unlinkDaemonFromChar(campaignId, charId, daemonId) {
  const ref = doc(db, "campaigns", campaignId, "characters", charId);
  await updateDoc(ref, { "refs.daemons": arrayRemove(daemonId) });
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
