// ============================================================
// КК9 — чистые функции для вычисления производных значений.
//
// D-05 trigger contract:
//   Derived values are stored and overwritten only when a source input changes.
//   Triggers wired via enrichPatch():
//   - spirit.die changes → health.physical.toughness, energy.max
//   - spirit.die or Concentration skill changes → tension.max
//   - age changes → energy.max, tension.max
//   - skills array changes → tension.max (Concentration die/modifier may have changed)
// ============================================================

export const CONCENTRATION_SKILL = "Концентрация";

// Attribute → health-track membership. Physical track scales off endurance,
// mental track off spirit. Magic is dependent on BOTH tracks.
// Ported from docs/OldCode/kk9/module/documents.mjs (PHYS_ATTRS / MENTAL_ATTRS).
const PHYS_ATTRS = new Set(["agility", "endurance", "magic"]);
const MENTAL_ATTRS = new Set(["smarts", "spirit", "magic"]);

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
 * Formula (Foundry data-models.mjs:243): spirit.die + Concentration die
 *   + Concentration modifier + floor(age / 2).
 * @param {object} ch - character document
 * @returns {number}
 */
export function deriveTensionMax(ch) {
  const spiritDie = ch.attributes?.spirit?.die ?? 4;
  const conc = (ch.skills ?? []).find((s) => s.name === CONCENTRATION_SKILL);
  const concDie = conc?.die ?? 4;
  const concMod = conc?.modifier ?? 0;
  return spiritDie + concDie + concMod + Math.floor((ch.age ?? 15) / 2);
}

/**
 * Index (1-5) of the last started pip on a health track, or 0 if untouched.
 * A pip is "started" when the track value exceeds the pip's lower boundary.
 * Physical track scales off endurance, mental track off spirit.
 * Ported from documents.mjs `_activePipIndex` (buffer-free, matches
 * derivePhysical/mental pip sizing).
 * @param {object} ch    - character document
 * @param {"physical"|"mental"} track
 * @returns {number} 0..5
 */
export function deriveActivePip(ch, track) {
  const attrKey = track === "mental" ? "spirit" : "endurance";
  const die = ch.attributes?.[attrKey]?.die ?? 4;
  const sizes = _attrPipSizes(die);
  const value = track === "mental"
    ? (ch.health?.mental?.value ?? 0)
    : (ch.health?.physical?.value ?? 0);
  let cumulative = 0;
  let last = 0;
  for (let i = 0; i < 5; i++) {
    if (value > cumulative) last = i + 1; // value > lower boundary of pip i+1
    cumulative += sizes[i];
  }
  return last;
}

/**
 * Raw per-track health penalties, computed from both tracks together.
 * Mirrors Foundry `_getHealthPenalties` (documents.mjs:108).
 * @param {object} ch - character document
 * @returns {{ physPenalty:number, mentalPenalty:number,
 *             physHalf:boolean, mentalHalf:boolean, onlyToughness:boolean }}
 */
export function deriveHealthPenalties(ch) {
  const phys = deriveActivePip(ch, "physical");
  const mental = deriveActivePip(ch, "mental");

  const none = {
    physPenalty: 0, mentalPenalty: 0,
    physHalf: false, mentalHalf: false, onlyToughness: false,
  };
  if (phys === 0 && mental === 0) return none;

  // Пип 5: только стойкость, результат пополам.
  if (phys >= 5 || mental >= 5) {
    return { ...none, onlyToughness: true, physHalf: phys >= 5, mentalHalf: mental >= 5 };
  }

  // Пип 4: своя шкала → результат/2, чужая → -4.
  if (phys >= 4 || mental >= 4) {
    return {
      physPenalty:   mental >= 4 && phys < 4 ? -4 : 0,
      mentalPenalty: phys   >= 4 && mental < 4 ? -4 : 0,
      physHalf:   phys   >= 4,
      mentalHalf: mental >= 4,
      onlyToughness: false,
    };
  }

  // Пип 3: своя шкала → -3, чужая → -1.
  if (phys >= 3 || mental >= 3) {
    return {
      physPenalty:   phys   >= 3 ? -3 : (mental >= 3 ? -1 : 0),
      mentalPenalty: mental >= 3 ? -3 : (phys   >= 3 ? -1 : 0),
      physHalf: false, mentalHalf: false, onlyToughness: false,
    };
  }

  // Пип 2: своя шкала → -2.
  if (phys >= 2 || mental >= 2) {
    return {
      physPenalty:   phys   >= 2 ? -2 : 0,
      mentalPenalty: mental >= 2 ? -2 : 0,
      physHalf: false, mentalHalf: false, onlyToughness: false,
    };
  }

  // Пип 1: своя шкала → -1.
  return {
    physPenalty:   phys   >= 1 ? -1 : 0,
    mentalPenalty: mental >= 1 ? -1 : 0,
    physHalf: false, mentalHalf: false, onlyToughness: false,
  };
}

/**
 * Health modifier for a specific attribute roll.
 * Mirrors Foundry `_getHealthModForAttr` (documents.mjs:161).
 * @param {object} ch          - character document
 * @param {string} attrKey     - agility|smarts|spirit|endurance|magic (or null)
 * @param {boolean} isToughness - true for a toughness (стойкость) roll
 * @returns {{ mod:number, halfResult:boolean, blocked:boolean, reasons:string[] }}
 */
export function deriveHealthModForAttr(ch, attrKey, isToughness = false) {
  const p = deriveHealthPenalties(ch);
  const isPhys = PHYS_ATTRS.has(attrKey);
  const isMental = MENTAL_ATTRS.has(attrKey);

  // Пип 5: только стойкость, результат/2.
  if (p.onlyToughness) {
    if (!isToughness) {
      return { mod: 0, halfResult: false, blocked: true, reasons: ["последний пип — только стойкость"] };
    }
    return { mod: 0, halfResult: true, blocked: false, reasons: ["результат пополам (пип 5)"] };
  }

  // Пип 4: своя шкала → halfResult, чужая → -4.
  if (p.physHalf || p.mentalHalf) {
    const myHalf = (p.physHalf && isPhys) || (p.mentalHalf && isMental)
      || (attrKey === "magic" && (p.physHalf || p.mentalHalf));
    if (myHalf) {
      return { mod: 0, halfResult: true, blocked: false, reasons: ["результат пополам (пип 4)"] };
    }
    const crossPenalty = (p.physHalf && isMental) ? -4
      : (p.mentalHalf && isPhys) ? -4
      : 0;
    const reasons = crossPenalty !== 0 ? [`штраф здоровья ${crossPenalty}`] : [];
    return { mod: crossPenalty, halfResult: false, blocked: false, reasons };
  }

  // Пип 1-3: штраф по типу атрибута (магия — наихудший из двух).
  let finalMod = 0;
  if (attrKey === "magic") finalMod = Math.min(p.physPenalty, p.mentalPenalty);
  else if (isPhys) finalMod = p.physPenalty;
  else if (isMental) finalMod = p.mentalPenalty;

  const reasons = [];
  if (finalMod < 0) reasons.push(`штраф здоровья ${finalMod}`);
  return { mod: finalMod, halfResult: false, blocked: false, reasons };
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

  // spirit.die or Concentration skill (die/modifier) or age → tension.max
  if (spiritDieChanged || skillsChanged || ageChanged) {
    const conc = skills.find((s) => s.name === CONCENTRATION_SKILL);
    const concDie = conc?.die ?? 4;
    const concMod = conc?.modifier ?? 0;
    result["tension.max"] = spiritDie + concDie + concMod + Math.floor(age / 2);
  }

  return result;
}

// Legacy compatibility object — used by db.js; components should import directly.
export const derive = {
  toughness: derivePhysicalToughness,
  energyMax: deriveEnergyMax,
};
