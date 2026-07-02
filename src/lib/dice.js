// ============================================================
// КК9 — Dice Engine (B-17)
// Pure module — no imports, no Firestore. Matches Foundry Roll math.
// ============================================================

// Roll-time die-step scale. Includes d100 at the top so a +die-step status/feature
// can push d20 → d100 (mirrors Foundry _applyDieChange SCALE = [4,6,8,10,12,20,100]).
// NB: character-advancement scales (advancement.js/chargen.js) stay capped at d20.
export const DIE_SCALE = [4, 6, 8, 10, 12, 20, 100];

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
 * Roll `count` plain (non-exploding) dice of `faces` and return their summed total.
 * Extra dice from statuses/features are added straight into the roll total, before
 * the half-result and success checks. Mirrors Foundry's `new Roll("1d{faces}")` per
 * extra die (non-exploding).
 *
 * Legacy numeric form — kept for the count-only extra-die shape. New per-die
 * faces/mode entries go through rollExtraDiceList (B-53).
 */
export function rollExtraDice(count, faces = 6) {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * faces) + 1;
  }
  return total;
}

/**
 * Roll a list of per-die extra dice and return their signed summed total.
 * Each entry: { faces, mode } where mode is "add" (default) or "subtract".
 * Mirrors Foundry `collectStatusModifiers` extra_die handling (extra_die_faces,
 * extra_die_mode). Non-exploding, added into the total before the half/success
 * checks. B-53 reconciles the extra_die_* schema with the roll pipeline.
 *
 * @param {Array<{faces:number, mode?:string}>} list
 * @returns {number} signed total (positive for add, negative for subtract)
 */
export function rollExtraDiceList(list = []) {
  let total = 0;
  for (const ed of list) {
    const faces = ed?.faces || 6;
    const sign = ed?.mode === "subtract" ? -1 : 1;
    total += sign * (Math.floor(Math.random() * faces) + 1);
  }
  return total;
}

/**
 * Success degree from a final total — mirrors Foundry `_getSuccessDegreeFromTotal`.
 * Order of operations (must match Foundry exactly):
 *   1. Critical failure ("snake eyes") if `allOnes` (every natural die = 1) OR the
 *      FULL total ≤ 0. Checked on the full total, BEFORE any half-result division.
 *   2. Otherwise apply half-result: total → floor(total / 2).
 *   3. total < 5 → plain failure.
 *   4. total ≥ 5 → success with `successes = 1 + floor((total - 5) / 4)`.
 *
 * @param {number} total - kept die + extra dice + all numeric modifiers (pre-half)
 * @param {{ halfResult?: boolean, allOnes?: boolean }} opts
 * @returns {{ type:"snake_eyes"|"failure"|"success", success:boolean,
 *             successes:number, raises:number }}
 *   `raises` = successes - 1 (the NEW UI counts extra successes as "raises").
 */
export function successDegreeFromTotal(total, { halfResult = false, allOnes = false } = {}) {
  if (allOnes || total <= 0) {
    return { type: "snake_eyes", success: false, successes: 0, raises: 0 };
  }
  const eff = halfResult ? Math.floor(total / 2) : total;
  if (eff < 5) {
    return { type: "failure", success: false, successes: 0, raises: 0 };
  }
  const successes = 1 + Math.floor((eff - 5) / 4);
  return { type: "success", success: true, successes, raises: successes - 1 };
}

/**
 * Apply a success-count modifier (from statuses/features) to a degree.
 * Can DEMOTE a success to a failure when it drops successes to 0 or below.
 * Never affects a snake-eyes result. Mirrors Foundry's post-degree successMod block.
 *
 * @param {object} degree     - result of successDegreeFromTotal
 * @param {number} successMod - signed success modifier
 * @returns {object} new degree (same shape)
 */
export function applySuccessMod(degree, successMod = 0) {
  if (!successMod || degree.type === "snake_eyes") return degree;
  const s = Math.max(0, (degree.successes ?? 0) + successMod);
  if (s === 0) {
    return { type: "failure", success: false, successes: 0, raises: 0 };
  }
  return { type: "success", success: true, successes: s, raises: s - 1 };
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
