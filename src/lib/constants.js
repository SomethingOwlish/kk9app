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

export const MENU = [
  { id: "portal", label: "Портал", on: true },
  { id: "card", label: "Карточка", on: true },
  { id: "adv", label: "Прокачка" },
  { id: "magic", label: "Магия" },
  { id: "log", label: "Лог сессий" },
  { id: "scene", label: "Сцена" },
  { id: "board", label: "Доска ГМ", gmOnly: true },
  { id: "items", label: "Снаряжение", gmOnly: true },
  { id: "shop", label: "Магазин" },
  { id: "journal", label: "Журнал кампании", on: true },
  { id: "orgs", label: "Организации" },
  { id: "rolls", label: "Лог бросков" },
  { id: "guide", label: "Правила" },
  { id: "lk", label: "Legend Keeper ↗" },
  { id: "gm", label: "ГМ Борд" },
  { id: "print", label: "Печать карточки" },
  { id: "set", label: "Настройки" },
];

export const dieStr = (die, mod) =>
  `d${die}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ""}`;

export const SKILL_BY_NAME = Object.fromEntries(SKILLS_DATA.map((s) => [s.name, s]));
