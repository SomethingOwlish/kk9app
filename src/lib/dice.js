// ============================================================
// КК9 — Dice Engine (B-17)
// Pure module — no imports, no Firestore. Matches Foundry Roll math.
// ============================================================

export const DIE_SCALE = [4, 6, 8, 10, 12, 20];

// Ability names that trigger a tension check on a failed roll.
// Ported from docs/OldCode/kk9/module/relations.mjs
export const TENSION_ABILITIES = new Set([
  "Концентрация", "Анализ", "Криптография", "Программирование",
  "Профайлинг", "Прорицание", "Сопротивление ментальному давлению",
  "Big Data", "Инженерия", "Матрициология", "Техномантия",
  "Самоконтроль", "Ведение допросов", "Хладнокровие",
  "Ритуалистика", "Пытки и казни", "Ментальная магия",
]);

// Heavy tension abilities — failed roll gives tensionHeavyIncrement instead of 1.
export const TENSION_HEAVY = new Set([
  "Ритуалистика", "Ментальная магия", "Матрициология",
  "Техномантия", "Прорицание", "Сопротивление ментальному давлению",
]);

// Restore abilities — successful roll removes tension × 2.
export const TENSION_RESTORE = new Set([
  "Медитация", "Секс",
]);

/**
 * Roll a single exploding die, returning the full breakdown of faces.
 * If a face equals `sides`, add `sides` and roll again (repeat).
 * @returns {{ total: number, faces: number[] }} — faces is the sequence of
 *   individual die faces, e.g. d4 exploding once → { total: 5, faces: [4, 1] }.
 */
export function rollExplodingDetailed(sides) {
  const faces = [];
  let total = 0;
  let roll;
  do {
    roll = Math.floor(Math.random() * sides) + 1;
    faces.push(roll);
    total += roll;
  } while (roll === sides);
  return { total, faces };
}

/**
 * Roll a single exploding die.
 * If the result equals `sides`, add `sides` and roll again (repeat).
 * Returns the cumulative total.
 */
export function rollExploding(sides) {
  return rollExplodingDetailed(sides).total;
}

/**
 * Roll the skill die and the Wild Die (d6 by default), both exploding.
 * Returns { skill, wild, kept, isWild, skillNatural, wildNatural, skillFaces, wildFaces, keptFaces }.
 * skillNatural/wildNatural are the first (pre-explosion) faces for snake-eyes detection.
 * skillFaces/wildFaces are the full explosion breakdowns (e.g. [4, 1] for a d4 → 5).
 */
export function rollPool(skillDie, wildDieSides = 6) {
  const skillRoll = rollExplodingDetailed(skillDie);
  const wildRoll = rollExplodingDetailed(wildDieSides);
  const skillNatural = skillRoll.faces[0];
  const wildNatural = wildRoll.faces[0];
  const skillTotal = skillRoll.total;
  const wildTotal = wildRoll.total;

  const isWild = wildTotal > skillTotal;
  return {
    skill: skillTotal,
    wild: wildTotal,
    kept: isWild ? wildTotal : skillTotal,
    isWild,
    skillNatural,
    wildNatural,
    skillFaces: skillRoll.faces,
    wildFaces: wildRoll.faces,
    keptFaces: isWild ? wildRoll.faces : skillRoll.faces,
  };
}

/**
 * Format an explosion breakdown for display.
 * [4, 1] → "4 + 1 = 5"; [3] → "3".
 */
export function formatFaces(faces = []) {
  if (!faces || faces.length === 0) return "";
  if (faces.length === 1) return String(faces[0]);
  const total = faces.reduce((a, b) => a + b, 0);
  return `${faces.join(" + ")} = ${total}`;
}

/**
 * Snake eyes: both natural (pre-explosion) faces are 1 → critical failure.
 */
export function rollSnakeEyes(skillNatural, wildNatural) {
  return skillNatural === 1 && wildNatural === 1;
}

/**
 * Step a die value up or down the scale [4,6,8,10,12,20].
 * Clamped so it never goes below 4 or above 20.
 */
export function stepDie(currentDie, steps) {
  const idx = DIE_SCALE.indexOf(currentDie);
  if (idx === -1) return currentDie;
  const newIdx = Math.max(0, Math.min(DIE_SCALE.length - 1, idx + steps));
  return DIE_SCALE[newIdx];
}

/**
 * Calculate success degree from a final total.
 * If halfHealth is true, halve the total before the check (pip-4 penalty).
 * Returns { success, raises }.
 */
export function calcSuccessDegree(total, halfHealth = false) {
  const effective = halfHealth ? Math.floor(total / 2) : total;
  if (effective < 5) {
    return { success: false, raises: 0 };
  }
  const raises = Math.floor((effective - 5) / 4);
  return { success: true, raises };
}

/**
 * Full single-roll pipeline: apply modifier to raw total, then calcSuccessDegree.
 * Returns { total, success, raises }.
 */
export function buildRollResult(raw, modifier = 0, halfHealth = false) {
  const total = raw + modifier;
  const degree = calcSuccessDegree(total, halfHealth);
  return { total, ...degree };
}

/** Returns true if the ability name triggers tension checks on failure. */
export function isTensionAbility(abilityName) {
  return TENSION_ABILITIES.has(abilityName);
}

/** Returns true if the ability is heavy tension (larger increment on failure). */
export function isHeavyTensionAbility(abilityName) {
  return TENSION_HEAVY.has(abilityName);
}

/** Returns true if the ability restores tension on success. */
export function isRestoreTensionAbility(abilityName) {
  return TENSION_RESTORE.has(abilityName);
}
