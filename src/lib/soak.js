// ============================================================
// КК9 — Soak / resistance math (B-54).
//
// Pure, framework-free port of docs/OldCode/kk9/module/soak.mjs
// (Foundry `resolveResistance` pipeline). NO Foundry runtime: no `game`,
// no `ChatMessage`, no `Roll`, no `Dialog`, no `actor.update()`, no sockets.
//
// Everything is pure computation + return values. Side effects are expressed
// as DATA the caller (owner's combat wiring) persists:
//   • health pip damage per track (physical / mental)
//   • item patches (absolute-protection `soakAbsoluteCurrent` decrements,
//     bonus-item `soakUses` / `soakBonusUses` / `charges` decrements, and
//     depletion side-effects: gear→condition:"broken", artifact→active:false,
//     spell→remove from character.activeSpells)
//   • statuses to apply (bleed, attack-carried status)
//
// Reused port helpers (all import-safe — no React/Firebase in their chains):
//   • ./dice          — DIE_SCALE, rollExplodingDetailed, successDegreeFromTotal
//   • ./derive        — deriveHealthModForAttr (health penalty / halfResult)
//   • ./statusEngine  — collectRollModifiers, conditionBonusMult
//
// ────────────────────────────────────────────────────────────
// DATA MODEL (what the caller passes in)
// ────────────────────────────────────────────────────────────
// `target` — the character document (port shape):
//   {
//     id, type: "character"|"companion"|"npc-light"|"npc-hard"|"npc-boss"|"daemon",
//     attributes: { spirit: { die, modifier }, ... },
//     health: { physical:{ value, toughness }, mental:{ value } },
//     activeStatuses: [...],   // for status roll-modifiers (statusEngine)
//     features: [...],         // for feature roll-modifiers (statusEngine)
//     activeSpells: [id, ...], // ids of spell items currently active
//     tensionZone?: "exhausted"|...,  // OPTIONAL — if "exhausted", TENSION
//                              // abilities are flagged unavailable in options
//   }
//
// `items` — flat array of the target's items (gear/artifact/device/spell),
//   camelCase port fields:
//     gear:     { id, type:"gear", name, gearType, soakType, condition,
//                 equipped, soakAbsoluteCapacity, soakAbsoluteCurrent,
//                 soakBonusDie, soakBonusModifier, soakUses }
//     device:   { id, type:"device", name, deviceType, soakType, condition,
//                 equipped, charges, soakBonusDie, soakBonusModifier }
//     artifact: { id, type:"artifact", name, artifactType, soakType, condition,
//                 equipped, active, soakAbsoluteCapacity, soakAbsoluteCurrent,
//                 soakBonusDie, soakBonusModifier, soakBonusUses, bonuses:{spirit} }
//     spell:    { id, type:"spell", name, spellType, soakType, active,
//                 soakAbsoluteCapacity, soakAbsoluteCurrent }
//   NB: `equipped` follows the port: gear/artifact use "equipped" === "equipped".
//       Foundry stored booleans on some items; if a boolean `true` is passed it
//       is treated as equipped too (see _isEquipped).
//
// `abilities` — the target's resistance abilities, port shape:
//     [{ id, name, die, modifier, attr /* linkedAttribute */ }]
//
// `attackData` — from the Foundry header comment:
//   { attackSuccesses, damageType, attackSource, damageLevel, extraPips,
//     isAreaAttack, targetActorId, targetActorName, hasStatus, statusUuid,
//     bypassSoak? }
//
// ────────────────────────────────────────────────────────────
// EXPORTED API
// ────────────────────────────────────────────────────────────
//
// condMult(condition) → number
//   Item-condition multiplier: broken→0, perfect→1.5, worn→0.5, else→1.
//   (Foundry `_condMult`.)
//
// shiftDie(base, steps) → number
//   Step a die along DIE_SCALE [4,6,8,10,12,20,100], clamped. 0 stays 0.
//   (Foundry `shiftDie`.)
//
// shiftDieByCondition(die, condition) → number
//   perfect→+1 step, worn→-1 step, else unchanged. (Foundry `_shiftDieByCondition`.)
//
// getAbsoluteProtectionItems(target, items) → Array<{
//     item, itemId, name, type:"gear"|"artifact"|"spell",
//     current, capacity }>
//   Active absolute-protection entries. `capacity` already folds condition
//   multiplier (gear/artifact). (Foundry `_getAbsoluteProtectionItems`.)
//
// getEligibleAbilities(target, attackData, abilities) → Array<ability>
//   Resistance abilities applicable to this attack context.
//   (Foundry `_getEligibleAbilities`.) Each result also carries
//   `unavailable:true` + `unavailableReason` when the target is exhausted and
//   the ability is a TENSION ability (so the caller can grey it out) — matching
//   the Foundry dialog's `disabled`/`disabledHint`.
//
// collectSoakBonuses(target, attackData, items, opts?) → Array<{
//     item, itemId, name, type, die, modifier, usesLeft, useCost, condNote }>
//   Eligible bonus items (gear/device/artifact with soakType:"bonus").
//   `opts.aoeMultiplier` (default 3) sets AoE charge cost. `usesLeft` may be
//   Infinity (unlimited device charges). (Foundry `_collectSoakBonuses`.)
//
// tryAbsoluteProtection(target, attackData, items, rng?) → {
//     absorbed:boolean, chosen?, damageUnits?, newCurrent?, depleted?,
//     itemPatches:[...], statusesToApply:[...], log:[...] }
//   Foundry `_tryAbsoluteProtection`, but returns a PLAN instead of writing.
//   • damageUnits = attackSuccesses (×2 for AoE).
//   • Lazily initialises current=capacity when current===0 && capacity>0
//     (emits an itemPatch for that too).
//   • Picks a random viable entry via `rng` (default Math.random).
//   • itemPatches decrement soakAbsoluteCurrent and, on depletion, set the
//     depletion side-effect (gear condition:"broken", artifact active:false,
//     spell → activeSpells patch).
//
// resolveSoak({ target, attackData, items, abilities,
//               selectedAbilityIds, selectedBonusIds, rng }) → SoakResult
//   Main resolver. Mirrors `_processSoakForActor` → `_rollSoak` →
//   `_applyResistOutcome`. Pure: never writes. Returns:
//   {
//     outcome: "absorbed" | "companion-stun" | "bypass-auto-damage"
//            | "resisted" | "bleed" | "half-damage" | "full-damage",
//     soakSuccesses: number,
//     attackSuccesses: number,
//     degree: { type, label, successes },   // soak roll degree
//     rollTotal: number,
//     damageApplied: { physical: number, mental: number },  // pip counts
//     itemPatches: [{ itemId, field, value }],
//     statusesToApply: [ "bleed" | { attackStatusUuid } ],
//     reasons: string[],
//     log: string[],
//   }
//   `selectedBonusIds` — omit/empty to use ALL eligible bonuses (Foundry
//   auto-applies every collected bonus). Pass an explicit id list to restrict.
//
// rollStandaloneSoak({ target, items, abilities, selectedAbilityIds, rng })
//   → { soakSuccesses, degree, rollTotal, reasons, itemPatches, log }
//   Foundry `rollStandaloneSoak` — a soak roll with NO attack comparison and
//   no damage. Consumes bonus charges (returned as itemPatches). Abilities are
//   NOT filtered by attack type (all resistance abilities eligible).
//
// halfDamageLevel(level) → "light"|"heavy"|"lethal"
//   Steps a damage level down one (min "light"). (Foundry `_halfDamageLevel`.)
//
// DAMAGE_LEVELS — { light:1, heavy:2, lethal:3 } pip counts (Foundry).
// RESIST_ABILITY_NAMES — the five resistance-ability names.
// ============================================================

import { DIE_SCALE, successDegreeFromTotal } from "./dice";
import { deriveHealthModForAttr } from "./derive";
import { collectRollModifiers } from "./statusEngine";
import { collectActiveToughnessMods } from "./activeSpells";

// Exploding die with an injectable RNG. dice.js `rollExplodingDetailed` matches
// this math exactly but hard-codes Math.random; we re-implement locally (a tiny,
// 8-line helper) so the roll pipeline is deterministically testable — the port
// requires an injectable RNG. Identical explosion rule: face === sides → add and
// reroll. Returns { total, faces } like the dice.js version.
function _rollExplodingDetailed(sides, rng) {
  const faces = [];
  let total = 0;
  let roll;
  do {
    roll = Math.floor(rng() * sides) + 1;
    faces.push(roll);
    total += roll;
  } while (roll === sides);
  return { total, faces };
}

// Resistance ability names — must match compendium names (Foundry RESIST_ABILITY_NAMES).
export const RESIST_ABILITY_NAMES = [
  "Сопротивление боли",
  "Сопротивление магии",
  "Сопротивление ментальному давлению",
  "Самоконтроль",
  "Выживание",
];

// TENSION abilities become unavailable while the target is mentally exhausted
// (Foundry _soakDialog imports TENSION_ABILITIES from relations.mjs). Kept as a
// local set so soak.js has no dependency on the tension module (import-safe).
const TENSION_ABILITIES = new Set([
  "Концентрация", "Анализ", "Криптография", "Программирование",
  "Профайлинг", "Прорицание", "Сопротивление ментальному давлению",
  "Big Data", "Инженерия", "Матрициология", "Техномантия",
  "Самоконтроль", "Ведение допросов", "Хладнокровие",
  "Ритуалистика", "Пытки и казни", "Ментальная магия",
]);

// Damage level → pip count (Foundry weapon-combat.mjs DAMAGE_LEVELS).
export const DAMAGE_LEVELS = { light: 1, heavy: 2, lethal: 3 };

// Damage-level ordering for the "half" step-down (Foundry DAMAGE_ORDER).
const DAMAGE_ORDER = ["light", "heavy", "lethal"];
const DAMAGE_LABELS = { light: "Лёгкий (1 ур.)", heavy: "Тяжёлый (2 ур.)", lethal: "Летальный (3 ур.)" };

const DEFAULT_AOE_MULTIPLIER = 3; // Foundry soakAreaUseMultiplier default.

// ── condition helpers (Foundry _condMult / shiftDie / _shiftDieByCondition) ──

/** Item-condition multiplier: broken=0, perfect=1.5, worn=0.5, else=1. */
export function condMult(condition) {
  if (condition === "broken") return 0;
  if (condition === "perfect") return 1.5;
  if (condition === "worn") return 0.5;
  return 1;
}

/** Step a die along DIE_SCALE, clamped [4..100]. 0 stays 0. */
export function shiftDie(base, steps) {
  if (!base || base === 0) return 0;
  const idx = DIE_SCALE.indexOf(base);
  if (idx === -1) return base;
  return DIE_SCALE[Math.max(0, Math.min(DIE_SCALE.length - 1, idx + steps))];
}

/** perfect→+1 die step, worn→-1, else unchanged. */
export function shiftDieByCondition(die, condition) {
  if (!die || die === 0) return 0;
  if (condition === "perfect") return shiftDie(die, 1);
  if (condition === "worn") return shiftDie(die, -1);
  return die;
}

// Foundry uses `equipped === "equipped"`; the port also stores booleans on some
// items. Treat boolean true / "equipped" as equipped.
function _isEquipped(equipped) {
  return equipped === "equipped" || equipped === true;
}

// ── Step 1: absolute protection ──────────────────────────────

/**
 * Active absolute-protection entries on the target.
 * Port of Foundry `_getAbsoluteProtectionItems`. `capacity` folds the
 * condition multiplier for gear/artifact (spell uses raw capacity).
 */
export function getAbsoluteProtectionItems(target, items = []) {
  const result = [];
  const activeSpells = target?.activeSpells ?? [];

  for (const item of items) {
    const t = item.type;

    if (t === "gear" && item.gearType === "defense" && item.soakType === "absolute") {
      if (!_isEquipped(item.equipped)) continue;
      if (item.condition === "broken") continue;
      const mult = condMult(item.condition);
      result.push({
        item, itemId: item.id, name: item.name, type: "gear",
        current: item.soakAbsoluteCurrent ?? 0,
        capacity: Math.floor((item.soakAbsoluteCapacity ?? 0) * mult),
      });
    } else if (t === "spell" && item.spellType === "defense" && item.soakType === "absolute") {
      if (!activeSpells.includes(item.id)) continue;
      result.push({
        item, itemId: item.id, name: item.name, type: "spell",
        current: item.soakAbsoluteCurrent ?? 0,
        capacity: item.soakAbsoluteCapacity ?? 0,
      });
    } else if (t === "artifact" && item.artifactType === "defense" && item.soakType === "absolute") {
      if (!_isEquipped(item.equipped)) continue;
      if (!item.active || item.condition === "broken") continue;
      const mult = condMult(item.condition);
      result.push({
        item, itemId: item.id, name: item.name, type: "artifact",
        current: item.soakAbsoluteCurrent ?? 0,
        capacity: Math.floor((item.soakAbsoluteCapacity ?? 0) * mult),
      });
    }
  }

  return result;
}

/**
 * Depletion side-effect patches for an absolute-protection item hitting 0.
 * gear→condition:"broken", artifact→active:false, spell→activeSpells minus id.
 * Returns an array of { itemId, field, value } (spell emits a target-doc patch
 * with itemId:null and field:"activeSpells").
 */
function _absDepletionPatches(entry, target) {
  if (entry.type === "gear") {
    return [{ itemId: entry.itemId, field: "condition", value: "broken" }];
  }
  if (entry.type === "artifact") {
    return [{ itemId: entry.itemId, field: "active", value: false }];
  }
  if (entry.type === "spell") {
    const activeSpells = (target?.activeSpells ?? []).filter((id) => id !== entry.itemId);
    return [{ itemId: null, field: "activeSpells", value: activeSpells }];
  }
  return [];
}

/**
 * Try absolute protection. Port of Foundry `_tryAbsoluteProtection` — returns a
 * PLAN instead of writing. See top-of-file docs for the return shape.
 */
export function tryAbsoluteProtection(target, attackData, items = [], rng = Math.random) {
  const { attackSuccesses, isAreaAttack } = attackData;
  const itemPatches = [];
  const log = [];

  if (attackSuccesses <= 0) return { absorbed: false, itemPatches, statusesToApply: [], log };

  // AoE doubles the units to absorb.
  const damageUnits = isAreaAttack ? attackSuccesses * 2 : attackSuccesses;

  const absItems = getAbsoluteProtectionItems(target, items);
  if (!absItems.length) return { absorbed: false, itemPatches, statusesToApply: [], log };

  // Lazily init current=capacity where current===0 && capacity>0 (new item).
  for (const entry of absItems) {
    if (entry.current === 0 && entry.capacity > 0) {
      entry.current = entry.capacity;
      itemPatches.push({ itemId: entry.itemId, field: "soakAbsoluteCurrent", value: entry.capacity });
      log.push(`${entry.name}: инициализация запаса → ${entry.capacity}`);
    }
  }

  const viable = absItems.filter((entry) => entry.current > 0);
  if (!viable.length) return { absorbed: false, itemPatches, statusesToApply: [], log };

  const chosen = viable[Math.floor(rng() * viable.length)];

  const newCurrent = Math.max(0, chosen.current - damageUnits);
  const depleted = newCurrent === 0;

  itemPatches.push({ itemId: chosen.itemId, field: "soakAbsoluteCurrent", value: newCurrent });
  if (depleted) itemPatches.push(..._absDepletionPatches(chosen, target));

  log.push(
    `Абсолютная защита ${chosen.name}: поглощено ${damageUnits} ед.` +
    (depleted ? ` · ${chosen.name} исчерпан` : ` · остаток: ${newCurrent}`) +
    (isAreaAttack ? " · площадная атака (урон ×2)" : "")
  );

  return {
    absorbed: true,
    chosen: { itemId: chosen.itemId, name: chosen.name, type: chosen.type },
    damageUnits,
    newCurrent,
    depleted,
    itemPatches,
    statusesToApply: [],
    log,
  };
}

// ── Step 2: bonus items ──────────────────────────────────────

/**
 * Eligible soak-bonus items (gear/device/artifact with soakType:"bonus").
 * Port of Foundry `_collectSoakBonuses`. `opts.aoeMultiplier` (default 3).
 */
export function collectSoakBonuses(target, attackData, items = [], opts = {}) {
  const bonuses = [];
  const isAreaAttack = !!attackData?.isAreaAttack;
  const aoeMultiplier = Number.isFinite(opts.aoeMultiplier) ? opts.aoeMultiplier : DEFAULT_AOE_MULTIPLIER;

  for (const item of items) {
    const t = item.type;

    if (t === "gear" && item.gearType === "defense" && item.soakType === "bonus") {
      if (!_isEquipped(item.equipped)) continue;
      if (item.condition === "broken") continue;
      if ((item.soakUses ?? 0) <= 0) continue;
      const mult = condMult(item.condition);
      bonuses.push({
        item, itemId: item.id, name: item.name, type: "gear",
        die: shiftDieByCondition(item.soakBonusDie || 0, item.condition),
        modifier: Math.floor((item.soakBonusModifier || 0) * mult),
        usesLeft: item.soakUses,
        useCost: isAreaAttack ? aoeMultiplier : 1,
        condNote: mult !== 1 ? (mult > 1 ? "идеальное" : "плохое") : "",
      });
    } else if (t === "device" && item.deviceType === "gadget" && item.soakType === "bonus") {
      if (!_isEquipped(item.equipped)) continue;
      if (item.condition === "broken") continue;
      const charges = item.charges ?? -1;
      if (charges === 0) continue;
      const multD = condMult(item.condition);
      bonuses.push({
        item, itemId: item.id, name: item.name, type: "device",
        die: shiftDieByCondition(item.soakBonusDie || 0, item.condition),
        modifier: Math.floor((item.soakBonusModifier || 0) * multD),
        usesLeft: charges === -1 ? Infinity : charges,
        useCost: 1,
        condNote: multD !== 1 ? (multD > 1 ? "идеальное" : "плохое") : "",
      });
    } else if (t === "artifact" && item.artifactType === "defense" && item.soakType === "bonus") {
      if (!_isEquipped(item.equipped)) continue;
      if (!item.active || item.condition === "broken") continue;
      if ((item.soakBonusUses ?? 0) <= 0) continue;
      const mult = condMult(item.condition);
      bonuses.push({
        item, itemId: item.id, name: item.name, type: "artifact",
        die: shiftDieByCondition(item.soakBonusDie || 0, item.condition),
        modifier: Math.floor((item.soakBonusModifier || 0) * mult),
        usesLeft: item.soakBonusUses,
        useCost: isAreaAttack ? aoeMultiplier : 1,
        condNote: mult !== 1 ? (mult > 1 ? "идеальное" : "плохое") : "",
      });
    }
  }

  return bonuses;
}

/**
 * Charge-consumption patches for the used bonus items.
 * Port of Foundry `_consumeBonusItemCharges` — returns itemPatches instead of
 * writing. gear→soakUses, artifact→soakBonusUses (+active:false at 0),
 * device→charges. Infinite (device charges=-1) items are skipped.
 * The AoE cost multiplier is already baked into each bonus's `useCost` by
 * collectSoakBonuses, so this function needs no isAreaAttack flag.
 */
function _consumeBonusItemCharges(bonuses) {
  const patches = [];
  for (const b of bonuses) {
    const cost = b.useCost ?? 1;
    if (!isFinite(b.usesLeft)) continue; // unlimited device charges
    const newVal = Math.max(0, b.usesLeft - cost);
    if (b.type === "gear") {
      patches.push({ itemId: b.itemId, field: "soakUses", value: newVal });
    } else if (b.type === "artifact") {
      patches.push({ itemId: b.itemId, field: "soakBonusUses", value: newVal });
      if (newVal === 0) patches.push({ itemId: b.itemId, field: "active", value: false });
    } else if (b.type === "device") {
      patches.push({ itemId: b.itemId, field: "charges", value: newVal });
    }
  }
  return patches;
}

// ── Resistance abilities ─────────────────────────────────────

/**
 * Resistance abilities applicable to the attack context.
 * Port of Foundry `_getEligibleAbilities`, plus exhaustion flagging from
 * `_soakDialog` (TENSION abilities unavailable while `target.tensionZone`
 * === "exhausted").
 */
export function getEligibleAbilities(target, attackData, abilities = []) {
  const { damageType, attackSource, isAreaAttack } = attackData;
  const exhausted = target?.tensionZone === "exhausted";

  return abilities.filter((a) => {
    const name = a.name;
    if (name === "Сопротивление боли") return damageType === "physical";
    if (name === "Сопротивление магии") return attackSource === "spell";
    if (name === "Сопротивление ментальному давлению") return damageType === "mental";
    if (name === "Самоконтроль") return attackSource !== "spell";
    if (name === "Выживание") return isAreaAttack === true;
    return false;
  }).map((a) => {
    if (exhausted && TENSION_ABILITIES.has(a.name)) {
      return { ...a, unavailable: true, unavailableReason: "истощение" };
    }
    return a;
  });
}

// ── Step 4: soak roll ────────────────────────────────────────

/**
 * Perform the soak roll. Pure port of Foundry `_rollSoak`.
 * Returns { soakSuccesses, degree, rollTotal, reasons, bonusPatches }.
 * Bonus charges are consumed here (Foundry consumes them in step 5, right
 * after the roll) — returned as `bonusPatches`.
 *
 * @param {number[]} selectedAbilityIds
 * @param {Array}    bonuses  — from collectSoakBonuses (already filtered by selection)
 */
function _rollSoak(target, selectedAbilityIds, bonuses, attackData, abilities, rng) {
  const reasons = [];

  const spiritDie = target.attributes?.spirit?.die || 4;
  const spiritMod = target.attributes?.spirit?.modifier || 0;
  const isWC = target.type === "character";

  // Health penalty to toughness (isToughness=true — pip 5 halves, not blocks).
  const healthResult = deriveHealthModForAttr(target, "spirit", true);
  const healthMod = healthResult?.mod ?? 0;
  const healthHalfResult = healthResult?.halfResult ?? false;
  for (const r of healthResult?.reasons ?? []) reasons.push(r);

  if (spiritMod !== 0) reasons.push(`Дух: ${spiritMod > 0 ? "+" : ""}${spiritMod}`);

  // Selected abilities.
  const abilityById = new Map(abilities.map((a) => [a.id, a]));
  const selectedAbilities = selectedAbilityIds
    .map((id) => abilityById.get(id))
    .filter(Boolean);

  // ── Status/feature roll-modifiers via the shared engine ──
  // Foundry collects per-attribute (spirit) + per-ability contexts. The port's
  // collectRollModifiers returns { numericMod, dieSteps, extraDiceList, successMod }.
  let totalDieMod = 0;
  let totalNumericMod = spiritMod + healthMod;
  let totalSuccessMod = 0;
  const extraDiceList = [];

  const foldMods = (ctx) => {
    const m = collectRollModifiers(target, ctx, items_forStatus(target));
    totalDieMod += m.dieSteps || 0;
    totalNumericMod += m.numericMod || 0;
    totalSuccessMod += m.successMod || 0;
    for (const src of m.sources) {
      if (src.numericMod || src.dieSteps || src.successMod) reasons.push(_srcReason(src));
    }
    // Extra dice are deduped below across the spirit + ability passes so the
    // same status effect (which can match several contexts) rolls only once.
    for (const ed of m.extraDiceList) {
      extraDiceList.push({ ...ed, _key: `${ed.faces}:${ed.mode}` });
    }
  };

  // spirit / toughness context
  foldMods({ attribute: "spirit", isToughness: true });
  // per-ability contexts (linkedAttribute or spirit)
  for (const ab of selectedAbilities) {
    foldMods({ attribute: ab.attr || "spirit", skillName: ab.name, isToughness: true });
  }

  // Dedup extra dice across the combined passes (spirit + abilities): the same
  // status effect can hit multiple contexts but only rolls once.
  {
    const seen = new Set();
    const deduped = [];
    for (const ed of extraDiceList) {
      if (!seen.has(ed._key)) { seen.add(ed._key); deduped.push(ed); }
    }
    extraDiceList.length = 0;
    extraDiceList.push(...deduped);
  }

  // ── Artifact spirit bonuses (bonuses.spirit, condition-scaled) ──
  // Foundry does this inline in _rollSoak; the port's collectRollModifiers
  // already folds artifact ATTRIBUTE bonuses when items are passed, so we do
  // NOT double-count here (items_forStatus supplies them to collectRollModifiers).

  // ── Equipment bonus dice / modifiers ──
  const bonusDice = [];
  for (const b of bonuses) {
    if (b.die > 0) { bonusDice.push({ faces: b.die, name: b.name }); reasons.push(`${b.name}: +d${b.die}`); }
    if (b.modifier !== 0) { totalNumericMod += b.modifier; reasons.push(`${b.name}: ${b.modifier > 0 ? "+" : ""}${b.modifier}`); }
  }

  // ── Active defense/buff spells that raise toughness (soakType:"status" +
  // toughnessBonus, or bonuses.toughness). Foundry: target_toughness status. ──
  for (const t of collectActiveToughnessMods(target.activeSpells, items_forStatus(target))) {
    totalNumericMod += t.numericMod;
    reasons.push(`${t.name}: ${t.numericMod > 0 ? "+" : ""}${t.numericMod} стойкость`);
  }

  // ── Build the dice pool ──
  const effSpiritDie = shiftDie(spiritDie, totalDieMod);
  const abilityDice = selectedAbilities.map((a) => shiftDie(a.die || 4, totalDieMod));
  const allDice = [effSpiritDie, ...abilityDice];

  // Roll every die (exploding). Track natural faces for snake-eyes.
  const rolledDice = []; // { total, natural }
  const rollOne = (sides) => {
    const r = _rollExplodingDetailed(sides, rng);
    return { total: r.total, natural: r.faces[0] };
  };

  for (const d of allDice) rolledDice.push(rollOne(d));

  let keptDice; // dice that count toward the total
  if (isWC) {
    // Wild Card: roll all dice + a d6, drop the single weakest (kh = n-1).
    rolledDice.push(rollOne(6));
    const sorted = [...rolledDice].sort((a, b) => a.total - b.total);
    keptDice = sorted.slice(1); // drop lowest
  } else {
    keptDice = rolledDice;
  }

  let poolTotal = keptDice.reduce((sum, d) => sum + d.total, 0);

  // Equipment bonus dice (added on top, always kept, exploding).
  for (const bd of bonusDice) {
    const r = _rollExplodingDetailed(bd.faces, rng);
    poolTotal += r.total;
    keptDice.push({ total: r.total, natural: r.faces[0] });
  }

  // ── Status extra dice (signed) ──
  let extraDieTotal = 0;
  for (const ed of extraDiceList) {
    const sign = ed.mode === "subtract" ? -1 : 1;
    const face = Math.floor(rng() * (ed.faces || 6)) + 1; // non-exploding
    extraDieTotal += sign * face;
    reasons.push(`Статус: ${sign > 0 ? "+" : "−"}1d${ed.faces} = ${sign > 0 ? "+" : "−"}${face}`);
  }

  const rollTotalRaw = poolTotal + totalNumericMod + extraDieTotal;
  const rollTotal = healthHalfResult ? Math.floor(rollTotalRaw / 2) : rollTotalRaw;

  // ── Success degree ──
  // Foundry snake-eyes: ≥2 ACTIVE dice all natural-1. In the port, kept dice
  // (dropped WC die excluded) are the active dice.
  const allOnes = keptDice.length >= 2 && keptDice.every((d) => d.natural === 1);
  // successDegreeFromTotal applies half-result itself; we already halved for
  // health, so pass halfResult:false and the (already halved) total.
  let degree = successDegreeFromTotal(rollTotal, { halfResult: false, allOnes });

  // Success modifier from statuses (can demote a success to a failure).
  if (totalSuccessMod !== 0 && degree.type !== "snake_eyes") {
    const s = Math.max(0, (degree.successes ?? 0) + totalSuccessMod);
    degree = s === 0
      ? { type: "failure", success: false, successes: 0, raises: 0 }
      : { type: "success", success: true, successes: s, raises: s - 1 };
  }

  degree = { ...degree, label: _degreeLabel(degree) };
  const soakSuccesses = degree.type === "success" ? (degree.successes ?? 0) : 0;

  const bonusPatches = _consumeBonusItemCharges(bonuses);

  return { soakSuccesses, degree, rollTotal, reasons, bonusPatches };
}

// The status engine wants the target's artifact items (for attribute bonuses).
// The caller supplies them on target._itemsForStatus (set by resolveSoak) so we
// don't re-thread `items` through every private helper.
function items_forStatus(target) {
  return target?._itemsForStatus ?? [];
}

function _srcReason(src) {
  const parts = [];
  if (src.numericMod) parts.push(`${src.numericMod > 0 ? "+" : ""}${src.numericMod}`);
  if (src.dieSteps) parts.push(`${src.dieSteps > 0 ? "+" : ""}${src.dieSteps} грань`);
  if (src.successMod) parts.push(`${src.successMod > 0 ? "+" : ""}${src.successMod} усп.`);
  return `${src.label}: ${parts.join(", ")}`;
}

function _degreeLabel(degree) {
  if (degree.type === "snake_eyes") return "Глаза змеи";
  if (degree.type === "failure") return "Неудача";
  const s = degree.successes ?? 0;
  return s === 1 ? "1 успех" : s <= 4 ? `${s} успеха` : `${s} успехов`;
}

// ── Damage helpers (Foundry _halfDamageLevel / _applyFullDamage / _applyHalfDamage) ──

/** Step a damage level down one, min "light". */
export function halfDamageLevel(level) {
  const idx = DAMAGE_ORDER.indexOf(level);
  if (idx <= 0) return "light";
  return DAMAGE_ORDER[idx - 1];
}

// damageType → track. Foundry: isPhys = damageType !== "mental".
function _trackFor(damageType) {
  return damageType === "mental" ? "mental" : "physical";
}

// Full damage as pip counts. Foundry _applyFullDamage: base level pips + extraPips light pips.
function _fullDamage(damageLevel, extraPips, damageType) {
  const track = _trackFor(damageType);
  const pips = (DAMAGE_LEVELS[damageLevel] || 1) + Math.max(0, extraPips);
  const desc = `Полный урон: ${DAMAGE_LABELS[damageLevel] || damageLevel}${extraPips ? ` +${extraPips} пип` : ""}`;
  return { track, pips, desc };
}

// Half damage as pip counts. Foundry _applyHalfDamage: level stepped down one,
// extraPips halved (floor).
function _halfDamage(damageLevel, extraPips, damageType) {
  const track = _trackFor(damageType);
  const halfLevel = halfDamageLevel(damageLevel);
  const halfPips = Math.floor(Math.max(0, extraPips) / 2);
  const pips = (DAMAGE_LEVELS[halfLevel] || 1) + halfPips;
  const desc = `Урон пополам: ${DAMAGE_LABELS[halfLevel] || halfLevel}${halfPips ? ` +${halfPips} пип` : ""}`;
  return { track, pips, desc };
}

function _emptyDamage() {
  return { physical: 0, mental: 0 };
}

// ── Main resolver ────────────────────────────────────────────

/**
 * Resolve a full soak/resistance for one target. Pure — never writes.
 * Mirrors `_processSoakForActor` → `_rollSoak` → `_applyResistOutcome`.
 * See top-of-file docs for the return shape.
 */
export function resolveSoak({
  target,
  attackData,
  items = [],
  abilities = [],
  selectedAbilityIds = [],
  selectedBonusIds = null,
  rng = Math.random,
}) {
  const damageApplied = _emptyDamage();
  const itemPatches = [];
  const statusesToApply = [];
  const log = [];

  const {
    attackSuccesses = 0,
    damageType,
    damageLevel = "light",
    extraPips = 0,
    hasStatus = false,
    statusUuid = "",
    bypassSoak = false,
  } = attackData;

  // Companion — always just stun, no soak, no pip damage tracked here.
  if (target.type === "companion") {
    log.push(`${target.name ?? "Спутник"}: спутник — только стан, без стойкости.`);
    return {
      outcome: "companion-stun",
      soakSuccesses: 0, attackSuccesses,
      degree: { type: "failure", label: "—", successes: 0 },
      rollTotal: 0,
      damageApplied, itemPatches, statusesToApply, reasons: [], log,
    };
  }

  // bypass_soak — only absolute protection works.
  if (bypassSoak) {
    const abs = tryAbsoluteProtection(target, attackData, items, rng);
    itemPatches.push(...abs.itemPatches);
    log.push(...abs.log);
    if (abs.absorbed) {
      return {
        outcome: "absorbed",
        soakSuccesses: 0, attackSuccesses,
        degree: { type: "success", label: "Устоял", successes: 0 },
        rollTotal: 0,
        damageApplied, itemPatches, statusesToApply, reasons: [], log,
      };
    }
    // No absolute protection → auto-fail, full damage applied.
    const dmg = _fullDamage(damageLevel, extraPips, damageType);
    damageApplied[dmg.track] += dmg.pips;
    if (hasStatus && statusUuid) statusesToApply.push({ attackStatusUuid: statusUuid });
    log.push(`${target.name}: нет абсолютной защиты — урон засчитан автоматически (${dmg.desc}).`);
    return {
      outcome: "bypass-auto-damage",
      soakSuccesses: 0, attackSuccesses,
      degree: { type: "failure", label: "Стойкость сломлена", successes: 0 },
      rollTotal: 0,
      damageApplied, itemPatches, statusesToApply, reasons: [], log,
    };
  }

  // Step 1: absolute protection.
  const abs = tryAbsoluteProtection(target, attackData, items, rng);
  if (abs.absorbed) {
    itemPatches.push(...abs.itemPatches);
    log.push(...abs.log);
    return {
      outcome: "absorbed",
      soakSuccesses: 0, attackSuccesses,
      degree: { type: "success", label: "Устоял", successes: 0 },
      rollTotal: 0,
      damageApplied, itemPatches, statusesToApply, reasons: [], log,
    };
  }

  // Step 2: bonus items (all eligible, or filtered by selectedBonusIds).
  let bonuses = collectSoakBonuses(target, attackData, items);
  if (Array.isArray(selectedBonusIds)) {
    const wanted = new Set(selectedBonusIds);
    bonuses = bonuses.filter((b) => wanted.has(b.itemId));
  }

  // Step 4: soak roll (also consumes bonus charges → bonusPatches).
  target._itemsForStatus = items; // hand items to the status engine pass
  const roll = _rollSoak(target, selectedAbilityIds, bonuses, attackData, abilities, rng);
  delete target._itemsForStatus;

  itemPatches.push(...roll.bonusPatches);
  const { soakSuccesses, degree, rollTotal, reasons } = roll;

  // Step 6: compare & apply.
  let outcome;
  if (soakSuccesses >= attackSuccesses) {
    outcome = "resisted";
    log.push(`${target.name}: устоял — ${soakSuccesses} усп. ≥ ${attackSuccesses} усп. атаки.`);
  } else {
    const remainder = attackSuccesses - soakSuccesses;
    if (remainder > 10) {
      outcome = "full-damage";
      const dmg = _fullDamage(damageLevel, extraPips, damageType);
      damageApplied[dmg.track] += dmg.pips;
      if (hasStatus && statusUuid) statusesToApply.push({ attackStatusUuid: statusUuid });
      log.push(`${target.name}: стойкость сломлена — остаток ${remainder} усп. (>10) · ${dmg.desc}.`);
    } else if (remainder === 1) {
      outcome = "bleed";
      statusesToApply.push("bleed");
      log.push(`${target.name}: остаток 1 усп. · кровотечение.`);
    } else {
      outcome = "half-damage";
      const dmg = _halfDamage(damageLevel, extraPips, damageType);
      damageApplied[dmg.track] += dmg.pips;
      if (hasStatus && statusUuid) statusesToApply.push({ attackStatusUuid: statusUuid });
      log.push(`${target.name}: частичный урон — остаток ${remainder} усп. (2–10) · ${dmg.desc}.`);
    }
  }

  return {
    outcome,
    soakSuccesses,
    attackSuccesses,
    degree,
    rollTotal,
    damageApplied,
    itemPatches,
    statusesToApply,
    reasons,
    log,
  };
}

/**
 * Standalone soak roll — no attack comparison, no damage.
 * Port of Foundry `rollStandaloneSoak`. Abilities are NOT filtered by attack
 * type (all resistance abilities eligible). Bonus charges consumed (non-AoE).
 */
export function rollStandaloneSoak({
  target,
  items = [],
  abilities = [],
  selectedAbilityIds = [],
  rng = Math.random,
}) {
  const resistAbilities = abilities.filter((a) => RESIST_ABILITY_NAMES.includes(a.name));
  const fakeAttack = {
    damageType: null, attackSource: null, isAreaAttack: false,
    attackSuccesses: 0, damageLevel: "light", extraPips: 0, hasStatus: false, statusUuid: "",
  };
  const bonuses = collectSoakBonuses(target, fakeAttack, items);

  target._itemsForStatus = items;
  const roll = _rollSoak(target, selectedAbilityIds, bonuses, fakeAttack, resistAbilities, rng);
  delete target._itemsForStatus;

  return {
    soakSuccesses: roll.soakSuccesses,
    degree: roll.degree,
    rollTotal: roll.rollTotal,
    reasons: roll.reasons,
    itemPatches: roll.bonusPatches,
    log: [`${target.name}: стойкость (standalone) — ${roll.degree.label}.`],
  };
}
