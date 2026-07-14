import { SKILLS_DATA } from "./seed-skills";

export const DICE = [4, 6, 8, 10, 12, 20];

export const ATTR_ORDER = ["agility", "smarts", "spirit", "endurance", "magic"];

export const ATTR_LABEL = {
  agility: "Ловкость",
  smarts: "Смекалка",
  spirit: "Дух",
  endurance: "Выносливость",
  magic: "Магия",
};

export const ATTR_SHORT = {
  agility: "Ловк",
  smarts: "Смек",
  spirit: "Дух",
  endurance: "Вын",
  magic: "Магия",
};

export const CAT_LABEL = {
  common: "Общие",
  learned: "Изученные",
  personal: "Личные",
  magic: "Магические",
};

export const CAT_ORDER = ["common", "learned", "personal", "magic"];

// IMP-12: ordered by role/frequency. `magic` (unimplemented) and the duplicate
// GM-board entry (`board`) were removed; the single GM board is `gm` (gmOnly).
export const MENU = [
  { id: "portal", label: "Портал", on: true },
  { id: "card", label: "Карточка", on: true },
  { id: "adv", label: "Прокачка" },
  { id: "log", label: "Лог сессий" },
  { id: "rolls", label: "Лог бросков" },
  { id: "scene", label: "Сцена" },
  { id: "journal", label: "Журнал кампании", on: true },
  { id: "requests", label: "Заявки" },
  { id: "orgs", label: "Организации" },
  { id: "library", label: "Библиотека" },
  { id: "shop", label: "Магазин" },
  { id: "guide", label: "Правила" },
  { id: "print", label: "Печать карточки" },
  { id: "lk", label: "Библиотека ↗" },
  { id: "gm", label: "Доска ГМ", gmOnly: true },
  { id: "requests_gm", label: "Заявки игроков", gmOnly: true },
  { id: "items", label: "Снаряжение", gmOnly: true },
  { id: "import", label: "Импорт из Foundry", gmOnly: true },
  { id: "set", label: "Настройки" },
];

export const dieStr = (die, mod) =>
  `d${die}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ""}`;

export const SKILL_BY_NAME = Object.fromEntries(SKILLS_DATA.map((s) => [s.name, s]));

// ── Магические таланты (шкала −1..5) ────────────────────────────────
// Справочник дисциплин мира = магические навыки (categ === "magic") из
// seed-skills. Талант — отдельная от кубика навыка величина: −1 (провал)
// … 0 (нейтрально) … 5 (мастерство). Хранится на персонаже как
// magicTalents[] {name, value}; у нового персонажа все дисциплины = 0.
export const MAGIC_DISCIPLINES = SKILLS_DATA
  .filter((s) => s.categ === "magic")
  .map((s) => s.name);

export const MAGIC_TALENT_MIN = -1;
export const MAGIC_TALENT_MAX = 5;

// Дефолт для генератора персонажа: все дисциплины со значением 0.
export const buildMagicTalents = () =>
  MAGIC_DISCIPLINES.map((name) => ({ name, value: 0 }));

// Слить справочник с сохранёнными значениями так, чтобы всегда показать все
// дисциплины (в т.ч. для персонажей, созданных до появления поля), не потеряв
// нестандартные записи (напр. из импорта Foundry) — их добавляем в конец.
export function resolveMagicTalents(stored) {
  const out = MAGIC_DISCIPLINES.map((name) => ({ name, value: 0 }));
  const idx = new Map(out.map((t, i) => [t.name, i]));
  for (const t of stored || []) {
    if (!t || !t.name) continue;
    const v = Math.max(MAGIC_TALENT_MIN, Math.min(MAGIC_TALENT_MAX, Number(t.value) || 0));
    if (idx.has(t.name)) out[idx.get(t.name)].value = v;
    else out.push({ name: t.name, value: v });
  }
  return out;
}
