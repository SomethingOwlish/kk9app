// ============================================================
// КК9 — чистые функции для вычисления производных значений.
//
// D-05 trigger contract (BLOCKING — architect must confirm):
//   Derived values are stored and overwritten only when a source input changes.
//   Pending specification of which writes trigger each recalculation.
//   Until D-05 is resolved, these functions are called on every render (safe)
//   and NOT written back to Firestore automatically.
//
// Triggers that WILL be wired once D-05 is resolved:
//   - spirit.die changes → derivePhysicalToughness, deriveEnergyMax
//   - spirit.die or Concentration skill changes → deriveTensionMax
//   - activeStatuses[] changes → deriveEnergyMax
//   - health.physical.value changes → derivePipHealthPenalty
// ============================================================

/**
 * Physical toughness: damage threshold per pip.
 * Formula: 2 + floor(spirit.die / 2)
 * @param {object} ch - character document
 * @returns {number}
 */
export function derivePhysicalToughness(ch) {
  return 2 + Math.floor(ch.attributes.spirit.die / 2);
}

/**
 * Maximum energy pool.
 * Formula: age + spirit.die (status modifiers apply but are not yet wired — D-06).
 * @param {object} ch - character document
 * @returns {number}
 */
export function deriveEnergyMax(ch) {
  return ch.age + ch.attributes.spirit.die;
}

/**
 * Maximum psychic tension threshold.
 * Formula: spirit.die + Concentration skill die + floor(age / 2) — pending D-05.
 * Returns 0 as a safe stub until trigger contract is resolved.
 * @param {object} ch - character document
 * @returns {number}
 */
export function deriveTensionMax(ch) {
  // TODO: implement once D-05 trigger contract is confirmed.
  // Foundry formula: spirit.die + Concentration.die + floor(age / 2)
  void ch;
  return 0;
}

/**
 * Whether pip 4 of health is filled (halves roll results).
 * Returns true when physical health value exceeds the threshold for pip 4.
 * Stub — exact pip boundary depends on deriveHealthPips (HealthTrack logic).
 * @param {object} ch - character document
 * @returns {boolean}
 */
export function derivePipHealthPenalty(ch) {
  // TODO: implement using HealthTrack pip boundary logic once D-05 is confirmed.
  void ch;
  return false;
}

// Legacy compatibility object — used by db.js; components should import directly.
export const derive = {
  toughness: derivePhysicalToughness,
  energyMax: deriveEnergyMax,
};
