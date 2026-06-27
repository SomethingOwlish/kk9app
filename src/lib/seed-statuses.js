// Predefined status list — ported from Foundry effects.mjs
// Each status: { id, name, icon, type, value, durationMode }
// type: "roll_modifier" | "attribute_modifier" | "special"
// durationMode: "permanent" | "counter" | "scene"

export const STATUSES = [
  // ── Кровотечение / физические ────────────────────────────
  { id: "bleed",        name: "Кровотечение",     icon: "🩸", type: "special",        value: 0,  durationMode: "counter" },
  { id: "burn",         name: "Ожог",              icon: "🔥", type: "special",        value: 0,  durationMode: "counter" },
  { id: "acid",         name: "Кислота",           icon: "🧪", type: "special",        value: 0,  durationMode: "counter" },
  { id: "electric",     name: "Электричество",     icon: "⚡", type: "special",        value: 0,  durationMode: "counter" },
  { id: "cold",         name: "Холод",             icon: "❄️",  type: "roll_modifier", value: -1, durationMode: "counter" },
  { id: "poison",       name: "Яд",                icon: "☠️",  type: "special",        value: 0,  durationMode: "counter" },
  { id: "infection",    name: "Заражение",         icon: "🦠", type: "special",        value: 0,  durationMode: "counter" },
  { id: "disease",      name: "Болезнь",           icon: "🤒", type: "special",        value: 0,  durationMode: "counter" },

  // ── Психические ──────────────────────────────────────────
  { id: "shock_mental", name: "Ментальный шок",   icon: "💀", type: "special",        value: 0,  durationMode: "counter" },
  { id: "fear",         name: "Страх",             icon: "😱", type: "roll_modifier", value: -2, durationMode: "scene"   },
  { id: "confused",     name: "Спутанность",       icon: "🌀", type: "roll_modifier", value: -1, durationMode: "scene"   },
  { id: "stunned",      name: "Оглушён",           icon: "⭐", type: "roll_modifier", value: -2, durationMode: "scene"   },

  // ── Баффы / дебаффы ──────────────────────────────────────
  { id: "inspired",     name: "Вдохновение",       icon: "✨", type: "roll_modifier", value:  2, durationMode: "scene"   },
  { id: "focused",      name: "Сосредоточенность", icon: "🎯", type: "roll_modifier", value:  1, durationMode: "scene"   },
  { id: "exhausted",    name: "Изнеможение",       icon: "😴", type: "roll_modifier", value: -1, durationMode: "permanent" },
  { id: "weakened",     name: "Ослаблен",          icon: "💫", type: "roll_modifier", value: -1, durationMode: "counter" },
  { id: "strengthened", name: "Усилен",            icon: "💪", type: "roll_modifier", value:  1, durationMode: "counter" },
  { id: "invisible",    name: "Невидимость",       icon: "👻", type: "special",        value: 0,  durationMode: "scene"   },
  { id: "shielded",     name: "Щит",               icon: "🛡️",  type: "special",        value: 0,  durationMode: "scene"   },
  { id: "marked",       name: "Метка ГМ",          icon: "📍", type: "special",        value: 0,  durationMode: "permanent" },
];

export const STATUS_BY_ID = Object.fromEntries(STATUSES.map(s => [s.id, s]));
