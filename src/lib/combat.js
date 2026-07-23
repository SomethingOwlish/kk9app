// Combat producer helpers (Tier 9 / B-54).
//
// The web port has no Foundry chat/socket layer, so the attack→resist flow is
// modelled as: an attack ROLL (RollDialog) produces `attackData`; the attacker
// picks target(s) from the roster; one pending-attack doc is written per target
// (db.createAttacks); each target's owner (or the GM for NPCs) resolves soak on
// their own character via src/lib/soak.js and applies the damage to themselves.
//
// This module is the PRODUCER half only (pure, no Firestore, no soak): decide
// whether an item is an attack, and turn a roll result into Foundry-shaped
// `attackData`. The DEFENDER half lives in soak.js + the resolve UI.

export const DAMAGE_LEVELS = { light: 1, heavy: 2, lethal: 3 };
export const DAMAGE_ORDER = ["light", "heavy", "lethal"];
export const DAMAGE_LEVEL_LABEL = { light: "Лёгкий", heavy: "Тяжёлый", lethal: "Летальный" };
export const DAMAGE_TYPE_LABEL = { physical: "Физический", mental: "Ментальный" };

// Which item subtypes deal damage (mirror ItemList `isRollable`/Foundry attack items).
export function isAttackItem(item) {
  if (!item) return false;
  switch (item.type) {
    case "weapon":   return true;
    case "gear":     return item.gearType === "attack";
    case "artifact": return item.artifactType === "attack";
    case "spell":    return item.spellType === "attack";
    case "device":   return item.deviceType === "weapon";
    default:         return false;
  }
}

export function attackSourceOf(item) {
  return item?.type || "weapon";
}

// Foundry `_calcAttackRaises`: raises = successes − 1; extraPips = ⌊raises/3⌋.
// The port's roll model exposes { success:boolean, raises:number }; the Foundry
// "successes" count = success ? 1 + raises : 0 (this is what soak compares against).
export function attackSuccessesFromRoll({ success, raises = 0 }) {
  return success ? 1 + Math.max(0, raises) : 0;
}
export function attackExtraPips({ raises = 0 } = {}) {
  return Math.floor(Math.max(0, raises) / 3);
}

// Foundry `calcSpellDamage` (weapon-combat.mjs:1915-1929): an ATTACK spell's
// damage level + bonus pips derive from its energy `cost`, not a stored
// damage_level, and AoE spells use a softer curve. Ported 1-1.
export function calcSpellDamage(cost = 0, isAoe = false) {
  const c = Number(cost) || 0;
  if (isAoe) {
    if (c <= 4)  return { level: "light",  extraPips: 0 };
    if (c <= 8)  return { level: "heavy",  extraPips: 0 };
    if (c <= 14) return { level: "lethal", extraPips: 0 };
    return { level: "lethal", extraPips: Math.floor((c - 14) / 8) };
  }
  if (c <= 2)  return { level: "light",  extraPips: 0 };
  if (c <= 6)  return { level: "heavy",  extraPips: 0 };
  if (c <= 12) return { level: "lethal", extraPips: 0 };
  return { level: "lethal", extraPips: Math.floor((c - 12) / 6) };
}

// Build the Foundry-shaped attackData from an attack item + the roll result.
//   item: the catalog/owned item being rolled
//   roll: { success, raises, total } from RollDialog's mainRoll (total = the
//         final, health-halved roll total, used for soak success tie-breaks)
// Spell-only flags (bypassSoak/unresistable/isAoe) default false on other types.
export function buildAttackData(item, roll) {
  const attackSuccesses = attackSuccessesFromRoll(roll);
  // Spell attacks: damage level & bonus pips come from `cost` (+AoE curve).
  // Weapons/gear/artifacts/devices keep their stored damageLevel. Raise-pips
  // (⌊raises/3⌋) add on top of the spell's cost-derived pips — Foundry order.
  const spellDmg = item.type === "spell" ? calcSpellDamage(item.cost, !!item.isAoe) : null;
  return {
    attackSource:  attackSourceOf(item),
    attackSuccesses,
    // Raw (already health-halved) attack total — the defender's soak resolver
    // uses it to break success ties: equal successes but higher attackTotal
    // still lands a status. See soak.resolveSoak's outcome table.
    attackTotal:   Math.max(0, Number(roll.total) || 0),
    damageType:    item.damageType || "physical",
    damageLevel:   spellDmg ? spellDmg.level : (item.damageLevel || "light"),
    extraPips:     attackExtraPips(roll) + (spellDmg ? spellDmg.extraPips : 0),
    isAreaAttack:  !!item.isAoe,
    hasStatus:     !!item.hasStatus,
    statusName:    item.hasStatus ? (item.statusName || "") : "",
    bypassSoak:    !!item.bypassSoak,
    unresistable:  !!item.unresistable,
  };
}

// Short human summary for the attack log / resolve prompt.
export function attackSummary(ad) {
  const bits = [DAMAGE_LEVEL_LABEL[ad.damageLevel] || ad.damageLevel, DAMAGE_TYPE_LABEL[ad.damageType] || ad.damageType];
  if (ad.extraPips) bits.push(`+${ad.extraPips} пип`);
  if (ad.isAreaAttack) bits.push("площадь");
  if (ad.hasStatus && ad.statusName) bits.push(`» ${ad.statusName}`);
  if (ad.unresistable) bits.push("неотразимо");
  else if (ad.bypassSoak) bits.push("только абс.");
  return bits.filter(Boolean).join(" · ");
}
