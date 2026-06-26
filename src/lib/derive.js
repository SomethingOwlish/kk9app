// ============================================================
// КК9 — чистые функции для вычисления производных значений.
//
// D-05 trigger contract:
//   Derived values are stored and overwritten only when a source input changes.
//   Triggers wired via enrichPatch():
//   - spirit.die changes → health.physical.toughness, energy.max
//   - spirit.die or Concentration skill changes → tension.max
//   - age changes → energy.max, tension.max
//   - skills array changes → tension.max (Concentration die may have changed)
// ============================================================

export const CONCENTRATION_SKILL = "Концентрация";

function _attrPipSizes(die) {
  switch (die) {
    case 20: return [2, 2, 2, 2, 1];
    case 12: return [1, 2, 2, 2, 1];
    case 10: return [1, 1, 2, 2, 1];
    case 8:  return [1, 1, 1, 2, 1];
    default: return [1, 1, 1, 1, 1];
  }
}

/**
 * Physical toughness: damage threshold per pip.
 * Formula: 2 + floor(spirit.die / 2)
 * @param {object} ch - character document
 * @returns {number}
 */
export function derivePhysicalToughness(ch) {
  return 2 + Math.floor((ch.attributes?.spirit?.die ?? 4) / 2);
}

/**
 * Maximum energy pool.
 * Formula: age + spirit.die
 * Status modifiers (D-06) applied separately via tension.energyPenalty.
 * @param {object} ch - character document
 * @returns {number}
 */
export function deriveEnergyMax(ch) {
  return (ch.age ?? 15) + (ch.attributes?.spirit?.die ?? 4);
}

/**
 * Maximum psychic tension threshold.
 * Formula: spirit.die + Concentration skill die + floor(age / 2)
 * @param {object} ch - character document
 * @returns {number}
 */
export function deriveTensionMax(ch) {
  const spiritDie = ch.attributes?.spirit?.die ?? 4;
  const conc = (ch.skills ?? []).find((s) => s.name === CONCENTRATION_SKILL);
  const concDie = conc?.die ?? 4;
  return spiritDie + concDie + Math.floor((ch.age ?? 15) / 2);
}

/**
 * Whether pip 4 of physical health is started (halves roll results).
 * Pip 4 starts when physical health value exceeds the cumulative first-3-pip threshold.
 * @param {object} ch - character document
 * @returns {boolean}
 */
export function derivePipHealthPenalty(ch) {
  const die = ch.attributes?.endurance?.die ?? 4;
  const sizes = _attrPipSizes(die);
  const pip4Threshold = sizes[0] + sizes[1] + sizes[2];
  return (ch.health?.physical?.value ?? 0) > pip4Threshold;
}

/**
 * Enrich a Firestore patch with derived-value recalculations triggered by the changes.
 * Handles both dot-notation patches (e.g. "attributes.spirit.die": 8)
 * and nested object patches (e.g. attributes: { spirit: { die: 8 } }).
 * Call this before saveCharacterDebounced / updateCharacterNow to keep stored derived
 * fields in sync with their sources.
 *
 * @param {object} ch - current effective character document
 * @param {object} patch - the patch being written
 * @returns {object} enriched patch with derived fields added where triggered
 */
export function enrichPatch(ch, patch) {
  const result = { ...patch };

  // Detect spirit.die change from either patch style
  const spiritDieFromDot = patch["attributes.spirit.die"];
  const spiritDieFromNested = patch.attributes?.spirit?.die;
  const spiritDieChanged = spiritDieFromDot !== undefined || spiritDieFromNested !== undefined;

  const ageChanged = "age" in patch;
  const skillsChanged = "skills" in patch;

  const spiritDie = spiritDieFromDot ?? spiritDieFromNested ?? (ch.attributes?.spirit?.die ?? 4);
  const age = ageChanged ? (Number(patch.age) || 15) : (ch.age ?? 15);
  const skills = skillsChanged ? patch.skills : (ch.skills ?? []);

  // spirit.die → toughness
  if (spiritDieChanged) {
    result["health.physical.toughness"] = 2 + Math.floor(spiritDie / 2);
  }

  // spirit.die or age → energy.max
  if (spiritDieChanged || ageChanged) {
    result["energy.max"] = age + spiritDie;
  }

  // spirit.die or Concentration skill or age → tension.max
  if (spiritDieChanged || skillsChanged || ageChanged) {
    const conc = skills.find((s) => s.name === CONCENTRATION_SKILL);
    const concDie = conc?.die ?? 4;
    result["tension.max"] = spiritDie + concDie + Math.floor(age / 2);
  }

  return result;
}

// Legacy compatibility object — used by db.js; components should import directly.
export const derive = {
  toughness: derivePhysicalToughness,
  energyMax: deriveEnergyMax,
};
