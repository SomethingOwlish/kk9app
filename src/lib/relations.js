// ============================================================
// КК9 — Система связей: таксономия тегов и шкала уровня.
// Портировано из docs/OldCode/kk9/module/relations.mjs (FEAT-14).
// Чистый модуль — без Firestore.
// ============================================================

export const RELATION_TAGS = {
  romantic: {
    label: "Романтическое и сексуальное",
    tags: [
      { id: "true_love",      label: "Настоящая любовь" },
      { id: "infatuation",    label: "Влюблённость" },
      { id: "heartbreak",     label: "Разбитое сердце" },
      { id: "secret_admirer", label: "Тайный воздыхатель" },
      { id: "forbidden",      label: "Запретное" },
      { id: "tension",        label: "Напряжение" },
      { id: "fwb",            label: "Без обязательств" },
      { id: "lovers",         label: "Сексуальные отношения" },
      { id: "exes",           label: "Бывшие" },
      { id: "divorced",       label: "Разведены" },
      { id: "married",        label: "Женаты/замужем" },
    ],
  },
  duty: {
    label: "Долг и честь",
    tags: [
      { id: "life_debt",           label: "Долг жизни" },
      { id: "oath",                label: "Клятва" },
      { id: "debt",                label: "Должник" },
      { id: "blood_feud",          label: "Кровная месть" },
      { id: "unfinished_business", label: "Незакрытый счёт" },
      { id: "made_whole",          label: "Долг погашен" },
      { id: "saved_life",          label: "Спас жизнь" },
    ],
  },
  social: {
    label: "Социальное",
    tags: [
      { id: "mentor",     label: "Наставник" },
      { id: "student",    label: "Ученик" },
      { id: "rival",      label: "Соперник" },
      { id: "comrade",    label: "Побратим" },
      { id: "family",     label: "Семья" },
      { id: "old_friend", label: "Старый друг" },
      { id: "vibe",       label: "Общий вайб" },
      { id: "childhood",  label: "Детство" },
      { id: "handler",    label: "Куратор" },
    ],
  },
  dark: {
    label: "Тёмное",
    tags: [
      { id: "obsession",      label: "Одержимость" },
      { id: "fear",           label: "Страх" },
      { id: "blackmail",      label: "Шантаж" },
      { id: "betrayal",       label: "Предательство" },
      { id: "guilt",          label: "Вина" },
      { id: "manipulation",   label: "Манипулирует" },
      { id: "using_covertly", label: "Использует втёмную" },
      { id: "used",           label: "Использовали" },
      { id: "shared_secret",  label: "Общая тайна" },
      { id: "accomplice",     label: "Соучастник" },
      { id: "knows_secret",   label: "Знает тайну" },
      { id: "shared_trauma",  label: "Общая травма" },
      { id: "killed_together",label: "Убили вместе" },
    ],
  },
  mystic: {
    label: "Мистическое",
    tags: [
      { id: "fate_bound",   label: "Связанные судьбой" },
      { id: "soul_link",    label: "Связь душ" },
      { id: "shared_dream", label: "Общие сны" },
      { id: "cursed_them",  label: "Проклял" },
      { id: "was_cursed",   label: "Был проклят" },
      { id: "marked",       label: "Отмечен" },
      { id: "witnessed",    label: "Свидетель" },
    ],
  },
};

// Плоский словарь id → label для быстрого поиска.
export const RELATION_TAG_LABELS = Object.values(RELATION_TAGS)
  .flatMap((cat) => cat.tags)
  .reduce((acc, t) => { acc[t.id] = t.label; return acc; }, {});

// Опции для SearchableSelect (multi): группы свёрнуты в плоский список.
export const RELATION_TAG_OPTIONS = Object.values(RELATION_TAGS).flatMap((cat) =>
  cat.tags.map((t) => ({ value: t.id, label: t.label, hint: cat.label })),
);

// Диапазоны шкалы −100..+100.
export const RELATION_LEVEL_RANGES = [
  { min: 76,   max: 100,  label: "Неразрывная связь" },
  { min: 51,   max: 75,   label: "Близкий" },
  { min: 26,   max: 50,   label: "Друг" },
  { min: 6,    max: 25,   label: "Симпатия" },
  { min: -5,   max: 5,    label: "Нейтрал" },
  { min: -25,  max: -6,   label: "Настороженность" },
  { min: -50,  max: -26,  label: "Неприязнь" },
  { min: -75,  max: -51,  label: "Враждебность" },
  { min: -100, max: -76,  label: "Непримиримый враг" },
];

export function getRelationLabel(level) {
  const n = parseInt(level, 10) || 0;
  for (const r of RELATION_LEVEL_RANGES) {
    if (n >= r.min && n <= r.max) return r.label;
  }
  return "Нейтрал";
}

// Цвет полоски уровня: красный (−100) → серый (0) → зелёный (+100).
export function relationLevelColor(level) {
  const n = Math.max(-100, Math.min(100, parseInt(level, 10) || 0));
  if (n === 0) return "var(--kk-muted, #8a8270)";
  return n > 0 ? "var(--kk-green, #4caf6a)" : "var(--kk-danger, #c0563f)";
}

export function comma(labels) {
  return labels.join(", ");
}
