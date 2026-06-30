// ============================================================
// КК9 — Библиотека (FEAT-04 reshaped). Метаданные видов записей и
// полная схема Даймона (TASK-074, D-09 — портирована 1:1 из Foundry
// DaemonActorDataModel: docs/OldCode/kk9/module/data-models.mjs).
// ============================================================

// Порядок и подписи видов записей библиотеки.
export const LIBRARY_KINDS = [
  { kind: "npc-light", label: "Лёгкие НПС" },
  { kind: "npc-hard",  label: "Тяжёлые НПС" },
  { kind: "npc-boss",  label: "Боссы" },
  { kind: "curator",   label: "Кураторы" },
  { kind: "faculty",   label: "Факультеты" },
  { kind: "companion", label: "Спутники" },
  { kind: "daemon",    label: "Даймоны" },
];

export const LIBRARY_KIND_LABEL = Object.fromEntries(LIBRARY_KINDS.map((k) => [k.kind, k.label]));

// ── Даймон: словари выбора (из data-models.mjs DaemonActorDataModel) ──
export const DAEMON_CORPORATIONS = [
  ["taro", "Таро"], ["rainbow", "Радуга"], ["new", "Новые"],
];
export const DAEMON_SUITS = [
  ["cups", "Кубки"], ["wands", "Жезлы"], ["swords", "Мечи"], ["pentacles", "Пентакли"],
];
export const DAEMON_COLORS = [
  ["black", "Чёрный"], ["white", "Белый"], ["gold", "Золотой"], ["silver", "Серебряный"],
  ["red", "Красный"], ["orange", "Оранжевый"], ["green", "Зелёный"], ["blue", "Синий"],
  ["purple", "Фиолетовый"], ["yellow", "Жёлтый"], ["pink", "Розовый"], ["pearl", "Жемчужный"],
  ["grey", "Серый"],
];
export const CONDITIONS = [
  ["broken", "Сломан"], ["worn", "Потрёпан"], ["good", "В норме"], ["perfect", "Идеален"],
];
// Старшие арканы Таро (major_arcana) — 22 штуки.
export const MAJOR_ARCANA = [
  "Дурак", "Маг", "Жрица", "Императрица", "Император", "Иерофант", "Влюблённые",
  "Колесница", "Сила", "Отшельник", "Колесо Фортуны", "Справедливость", "Повешенный",
  "Смерть", "Умеренность", "Дьявол", "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир",
];

const ATTR5 = () => ({
  agility:   { die: 6, modifier: 0 },
  smarts:    { die: 6, modifier: 0 },
  spirit:    { die: 6, modifier: 0 },
  endurance: { die: 6, modifier: 0 },
  magic:     { die: 6, modifier: 0 },
});

// Полная схема Даймона (D-09). Совпадает по полям с DaemonActorDataModel.
// Стойкость (toughness) = 2 + floor(spirit.die / 2) — вычисляется в карточке.
export function daemonDefaults() {
  return {
    description: "",
    is_orb: true,           // режим: шарик (true) или свободен (false)
    true_name: "",          // настоящее имя
    corporation: "taro",    // корпорация
    daemon_class: "1",      // класс
    major_arcana: "Дурак",  // старший аркан (Таро)
    suit: "cups",           // масть (Таро)
    color: "white",         // цвет
    appearance: "",
    dream: "",
    fear: "",
    desire: "",
    captor: "",             // режим шарик: владелец-ловец
    used: false,            // шарик уже использован
    gone: false,            // режим свободный: ушёл
    attributes: ATTR5(),
    health: { physical: { value: 0 }, mental: { value: 0 } },
    condition: "good",
    owner_id: "",           // UUID/ref владельца (персонаж/контейнер)
    toughness: 5,
    tension: { current: 0, overcap: 0, energy_penalty: 0 },
  };
}

// Лёгкий стат-блок НПС (для kind npc-*). Полнее всего у boss/hard, но
// единый дефолт держит форму простой.
export function npcDefaults() {
  return {
    attributes: ATTR5(),
    skills: [],
    health: { physical: { value: 0, toughness: 4 }, mental: { value: 0 } },
    notes: "",
  };
}

// Спутник (companion) — из seed-companions.
export function companionDefaults() {
  return {
    species: "", age: 0, bond: 1,
    attributes: ATTR5(),
    condition: "good",
  };
}

// Дефолты по виду записи — чем создаётся новая карточка.
export function libraryDefaultsFor(kind) {
  if (kind === "daemon") return daemonDefaults();
  if (kind === "companion") return companionDefaults();
  if (kind === "curator") return { facultyKey: "", facultyName: "" };
  if (kind === "faculty") return { key: "", color: "#888888", abilities: [], dormitory: "", date_founded: "", traits_fit: "", traits_unfit: "", special_rules: "" };
  return npcDefaults(); // npc-light / npc-hard / npc-boss
}
