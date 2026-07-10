// ============================================================
// КК9 — Player Requests (Tier 10 / B-64).
// Single source of truth for the request-form fields and the
// entity builders. The form (RequestForm), the GM edit modal
// (RequestEditModal), and the approval engine (db.approveRequest)
// all consume these descriptors, so a request payload and the
// entity it becomes on approval can never drift.
//
// Field descriptor: { path, label, type, options?, default, min?, max? }
//   type: "text" | "textarea" | "number" | "checkbox" | "select"
//         | "skill"  — select of skill names (form supplies options)
//         | "status" — select of campaign status names (form supplies options)
// `path` may be dotted ("bonuses.toughness", "modifier.target_all") — the
// helpers below read/write nested payload maps.
// ============================================================
import { ATTR_ORDER, ATTR_LABEL, CAT_ORDER, CAT_LABEL, DICE } from "./constants";

// ── Kinds / subtypes / statuses ─────────────────────────────
export const REQUEST_KINDS = ["item", "skill", "feature", "info-plot"];
export const KIND_LABEL = {
  item: "Предмет",
  skill: "Навык",
  feature: "Черта",
  "info-plot": "Инфо-сюжет",
};

export const ITEM_SUBTYPES = ["weapon", "gear", "spell", "device"];
export const ITEM_SUBTYPE_LABEL = {
  weapon: "Оружие",
  gear: "Снаряжение",
  spell: "Заклинание",
  device: "Устройство",
};

export const REQUEST_STATUS_LABEL = {
  in_process: "На рассмотрении",
  applied: "Применено",
  denied: "Отклонено",
};

// ── Option maps (enum value → RU label) ─────────────────────
const DAMAGE_LEVEL_OPTS = [
  { value: "light", label: "Лёгкий" },
  { value: "heavy", label: "Тяжёлый" },
  { value: "lethal", label: "Летальный" },
];
const DAMAGE_TYPE_OPTS = [
  { value: "physical", label: "Физический" },
  { value: "mental", label: "Ментальный" },
];
const GEAR_TYPE_OPTS = [
  { value: "attack", label: "Атака" },
  { value: "defense", label: "Защита" },
  { value: "utility", label: "Утилита" },
];
const SOAK_TYPE_OPTS = [
  { value: "none", label: "Нет" },
  { value: "absolute", label: "Абсолютное" },
  { value: "bonus", label: "Бонусное" },
];
const TRACK_OPTS = [
  { value: "physical", label: "Физическая" },
  { value: "mental", label: "Ментальная" },
  { value: "both", label: "Обе" },
];
const SPELL_TYPE_OPTS = [
  { value: "attack", label: "Атака" },
  { value: "defense", label: "Защита" },
  { value: "buff", label: "Усиление" },
  { value: "health_buff", label: "Лечение" },
  { value: "binding", label: "Контроль" },
  { value: "spatial", label: "Пространство" },
  { value: "transforming", label: "Трансформация" },
  { value: "prophetic", label: "Прорицание" },
  { value: "utility", label: "Утилита" },
];
const DEVICE_TYPE_OPTS = [
  { value: "gadget", label: "Гаджет" },
  { value: "weapon", label: "Оружие" },
  { value: "drone", label: "Дрон" },
  { value: "computer", label: "Компьютер" },
  { value: "medical", label: "Медицина" },
  { value: "other", label: "Другое" },
];
const ATTR_OPTS = ATTR_ORDER.map((a) => ({ value: a, label: ATTR_LABEL[a] }));
const CAT_OPTS = CAT_ORDER.map((c) => ({ value: c, label: CAT_LABEL[c] }));
const DIE_OPTS = DICE.map((d) => ({ value: d, label: `d${d}` }));

// ── Field descriptors per kind / item subtype ───────────────
// Every mechanical field is optional (the player supplies only name +
// description); defaults mirror the seed-*.js shapes so an approved entity
// is well-formed even when the player left everything blank.
const ITEM_FIELDS = {
  weapon: [
    { path: "skillName", label: "Навык атаки", type: "skill", default: "" },
    { path: "damageLevel", label: "Уровень урона", type: "select", options: DAMAGE_LEVEL_OPTS, default: "light" },
    { path: "damageType", label: "Тип урона", type: "select", options: DAMAGE_TYPE_OPTS, default: "physical" },
    { path: "range", label: "Дальность (м)", type: "number", default: 0, min: 0 },
    { path: "ap", label: "Бронепробитие", type: "number", default: 0, min: 0 },
    { path: "rof", label: "Скорострельность", type: "number", default: 1, min: 0 },
    { path: "attackModifier", label: "Мод к атаке", type: "number", default: 0 },
    { path: "conditionChance", label: "Шанс износа (%)", type: "number", default: 0, min: 0, max: 100 },
    { path: "hasStatus", label: "Накладывает статус", type: "checkbox", default: false },
    { path: "statusName", label: "Статус при попадании", type: "status", default: "" },
  ],
  gear: [
    { path: "gearType", label: "Тип снаряжения", type: "select", options: GEAR_TYPE_OPTS, default: "utility" },
    { path: "soakType", label: "Тип поглощения", type: "select", options: SOAK_TYPE_OPTS, default: "none" },
    { path: "soakAbsoluteCapacity", label: "Абс. поглощение (макс)", type: "number", default: 0, min: 0 },
    { path: "soakAbsoluteCurrent", label: "Абс. поглощение (тек)", type: "number", default: 0, min: 0 },
    { path: "soakBonusDie", label: "Бонусный кубик", type: "number", default: 0, min: 0 },
    { path: "soakBonusModifier", label: "Бонусный мод", type: "number", default: 0 },
    { path: "soakUses", label: "Заряды абс. поглощения", type: "number", default: 0, min: 0 },
    { path: "soakBonusUses", label: "Заряды бонуса", type: "number", default: 0, min: 0 },
    { path: "energyRestore", label: "Восстановление энергии", type: "number", default: 0, min: 0 },
    { path: "healthBufferPip", label: "Буфер здоровья (пипы)", type: "number", default: 0, min: 0 },
    { path: "healthBufferTrack", label: "Шкала буфера", type: "select", options: TRACK_OPTS, default: "physical" },
    { path: "damageLevel", label: "Уровень урона", type: "select", options: DAMAGE_LEVEL_OPTS, default: "light" },
    { path: "damageType", label: "Тип урона", type: "select", options: DAMAGE_TYPE_OPTS, default: "physical" },
    { path: "skillName", label: "Навык атаки", type: "skill", default: "" },
    { path: "attackModifier", label: "Мод к атаке", type: "number", default: 0 },
    { path: "conditionChance", label: "Шанс износа (%)", type: "number", default: 0, min: 0, max: 100 },
    { path: "hasStatus", label: "Накладывает статус", type: "checkbox", default: false },
    { path: "statusName", label: "Статус при попадании", type: "status", default: "" },
  ],
  spell: [
    { path: "spellType", label: "Тип заклинания", type: "select", options: SPELL_TYPE_OPTS, default: "utility" },
    { path: "cost", label: "Стоимость (энергия)", type: "number", default: 0, min: 0 },
    { path: "range", label: "Дальность (м)", type: "number", default: 0, min: 0 },
    { path: "duration", label: "Длительность (0=миг, -1=длит.)", type: "number", default: 0 },
    { path: "durationHours", label: "Длительность (часы)", type: "number", default: 0, min: 0 },
    { path: "uses", label: "Использований", type: "number", default: 1, min: 0 },
    { path: "upkeepCost", label: "Поддержание (энергия/раунд)", type: "number", default: 0, min: 0 },
    { path: "skillName", label: "Навык", type: "skill", default: "" },
    { path: "noWandNeeded", label: "Без посоха", type: "checkbox", default: false },
    { path: "isAoe", label: "Область (AoE)", type: "checkbox", default: false },
    { path: "hasStatus", label: "Накладывает статус", type: "checkbox", default: false },
    { path: "statusName", label: "Статус", type: "status", default: "" },
    { path: "snakeEyesStatusName", label: "Статус при провале (1-1)", type: "status", default: "" },
    { path: "contestedSkillName", label: "Противодействующий навык", type: "skill", default: "" },
    { path: "bonuses.toughness", label: "Бонус к стойкости", type: "number", default: 0 },
  ],
  device: [
    { path: "deviceType", label: "Тип устройства", type: "select", options: DEVICE_TYPE_OPTS, default: "gadget" },
    { path: "charges", label: "Заряды (-1 = ∞)", type: "number", default: -1 },
    { path: "maxCharges", label: "Макс. зарядов (-1 = ∞)", type: "number", default: -1 },
    { path: "worksUpper", label: "Работает в Верхнем городе", type: "checkbox", default: false },
    { path: "worksLower", label: "Работает в Нижнем городе", type: "checkbox", default: true },
    { path: "bonusSkillName", label: "Бонусный навык", type: "skill", default: "" },
    { path: "bonusValue", label: "Значение бонуса", type: "number", default: 0 },
    { path: "folder", label: "Папка", type: "text", default: "" },
  ],
};

const SKILL_FIELDS = [
  { path: "attr", label: "Атрибут", type: "select", options: ATTR_OPTS, default: "smarts" },
  { path: "categ", label: "Категория", type: "select", options: CAT_OPTS, default: "learned" },
  { path: "die", label: "Кубик", type: "select", options: DIE_OPTS, default: 4 },
  { path: "modifier", label: "Модификатор", type: "number", default: -2 },
  { path: "whenToRoll", label: "Когда бросать", type: "textarea", default: "" },
];

// Feature modifier fields mirror the ItemsView «Черты» editor and stay
// snake_case (statusEngine.modifierHits reads features + campaign statuses
// through the SAME reader — see Tier 9 decision).
const FEATURE_FIELDS = [
  { path: "is_weakness", label: "Слабость", type: "checkbox", default: false },
  { path: "modifier.target_all", label: "Все броски", type: "checkbox", default: false },
  { path: "modifier.target_toughness", label: "Стойкость", type: "checkbox", default: false },
  ...ATTR_ORDER.map((a) => ({ path: `modifier.target_${a}`, label: ATTR_LABEL[a], type: "checkbox", default: false })),
  { path: "modifier.modifier", label: "К броску", type: "number", default: 0 },
  { path: "modifier.die_change", label: "Ступени кубика", type: "number", default: 0 },
  { path: "modifier.success_modifier", label: "Успехи", type: "number", default: 0 },
];

// Return the descriptor list for a kind (+ item subtype). info-plot has no
// mechanical fields (name + description + top-level gmAnswer only).
export function descriptorsFor(kind, subtype) {
  if (kind === "item") return ITEM_FIELDS[subtype] || [];
  if (kind === "skill") return SKILL_FIELDS;
  if (kind === "feature") return FEATURE_FIELDS;
  return [];
}

// ── Dotted-path get/set on a payload map ────────────────────
export function getFieldVal(payload, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), payload);
}
export function setFieldVal(payload, path, val) {
  const keys = path.split(".");
  const next = { ...(payload || {}) };
  let o = next;
  for (let i = 0; i < keys.length - 1; i++) {
    o[keys[i]] = { ...(o[keys[i]] || {}) };
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = val;
  return next;
}

function setInto(target, path, val) {
  const keys = path.split(".");
  let o = target;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = val;
}

// Build a fully-defaulted, type-coerced field object from a (possibly sparse)
// payload — used by the approval engine so the created entity is well-formed
// no matter which fields the player/GM left blank.
export function buildFields(kind, subtype, payload = {}) {
  const out = {};
  for (const d of descriptorsFor(kind, subtype)) {
    let v = getFieldVal(payload, d.path);
    if (v === undefined || v === null || v === "") v = d.default;
    if (d.type === "number" || d.type === "select") {
      // select values that are numeric (die) coerce; string selects pass through
      if (typeof d.default === "number") v = Number(v);
      if (Number.isNaN(v)) v = d.default;
    }
    if (d.type === "checkbox") v = !!v;
    setInto(out, d.path, v);
  }
  return out;
}
