// Spell overcast (превозмогание) — port of Foundry `spendSpellEnergy`
// (weapon-combat.mjs:1379-1470). Pure helpers, no Firestore/React.
//
// When a caster lacks the energy to pay a spell's cost, they may PUSH THROUGH:
// energy drops to 0, they take ⌈deficit/2⌉ health pips (on the spell's damage
// track, overflowing to the other track then to overflow_damage), and roll Spirit.
// Spirit ≥ success → the spell proceeds; failure → it fizzles but the cost (energy
// + health) is still paid. If the primary track is already full, overcast is
// impossible (nothing left to burn).

// Health-pip capacity per attribute die — mirrors HealthTrack.computeHealthPips.
function attrPipSizes(die) {
  switch (die) {
    case 20: return [2, 2, 2, 2, 1];
    case 12: return [1, 2, 2, 2, 1];
    case 10: return [1, 1, 2, 2, 1];
    case 8:  return [1, 1, 1, 2, 1];
    default: return [1, 1, 1, 1, 1];
  }
}
export function healthMaxPips(attrDie) {
  return attrPipSizes(attrDie).reduce((a, b) => a + b, 0);
}

// Physical track scales with endurance, mental with spirit (see CharacterCard).
export function physCap(ch) { return healthMaxPips(ch?.attributes?.endurance?.die ?? 4); }
export function mentCap(ch) { return healthMaxPips(ch?.attributes?.spirit?.die ?? 4); }

// The energy deficit for casting `spell` at the character's current energy.
export function energyDeficit(ch, spell) {
  const cost = Number(spell?.cost || 0);
  const cur = ch?.energy?.value ?? 0;
  return Math.max(0, cost - cur);
}

// Can this character overcast this spell? False when there's no deficit (no need)
// or the primary damage track is already full (nothing left to burn) — matching
// the Foundry `primaryVal >= primaryMax → blocked` guard.
export function canOvercast(ch, spell) {
  const deficit = energyDeficit(ch, spell);
  if (deficit <= 0) return false;
  const damType = spell?.damageType === "mental" ? "mental" : "physical";
  const val = damType === "mental" ? (ch?.health?.mental?.value ?? 0) : (ch?.health?.physical?.value ?? 0);
  const cap = damType === "mental" ? mentCap(ch) : physCap(ch);
  return val < cap;
}

// Build the character patch for paying an overcast: energy → 0 and ⌈deficit/2⌉
// health pips distributed primary-track → other-track → overflow_damage.
// `spiritSuccess` (from an inline Spirit roll) decides whether the spell proceeds.
// Returns { deficit, pips, damType, patch, spellProceeds }.
export function computeOvercast(ch, spell, spiritSuccess) {
  const deficit = energyDeficit(ch, spell);
  const pips = Math.ceil(deficit / 2);
  const damType = spell?.damageType === "mental" ? "mental" : "physical";

  const capPhys = physCap(ch), capMent = mentCap(ch);
  let phys = ch?.health?.physical?.value ?? 0;
  let ment = ch?.health?.mental?.value ?? 0;
  const phys0 = phys, ment0 = ment;
  let remaining = pips;

  const bite = (isMental) => {
    if (isMental) { const d = Math.min(remaining, capMent - ment); ment += d; remaining -= d; }
    else          { const d = Math.min(remaining, capPhys - phys); phys += d; remaining -= d; }
  };
  if (damType === "mental") { bite(true);  if (remaining > 0) bite(false); }
  else                      { bite(false); if (remaining > 0) bite(true); }

  const patch = { "energy.value": 0 };
  if (phys !== phys0) patch["health.physical.value"] = phys;
  if (ment !== ment0) patch["health.mental.value"] = ment;
  if (remaining > 0) patch["overflow_damage"] = (ch?.overflow_damage ?? 0) + remaining;

  return { deficit, pips, damType, patch, spellProceeds: !!spiritSuccess };
}
