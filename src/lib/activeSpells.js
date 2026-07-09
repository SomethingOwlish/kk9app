// Active-spell lifecycle (Tier 9 / B-55). Pure helpers — no Firestore.
//
// The web port has no initiative/turn loop, so ongoing spells are tracked on
// `character.activeSpells[]` and advanced by a GM "Раунд →" control (per round),
// mirroring Foundry `_activateSpell` (cast) + the round-end upkeep/decrement in
// weapon-combat.mjs. Entry shape (camelCase, as SpellItem already renders):
//   { itemId, name, usesRemaining, durationRemaining, upkeepCost }
//     durationRemaining: rounds left; 0 / <0 ⇒ not duration-limited (persists
//       until uses run out or upkeep can't be paid). upkeepCost: energy/round.

// Only non-attack spells with an ongoing effect are "activated" (attack spells
// resolve immediately through the soak flow instead).
export function spellActivates(spell) {
  if (!spell || spell.type !== "spell") return false;
  if (spell.spellType === "attack") return false;
  return (spell.upkeepCost ?? 0) > 0
      || (spell.durationHours ?? 0) > 0
      || (spell.uses ?? 1) > 1
      || spell.durationHours === -1;
}

// Cast: add or refresh the active-spell entry. Re-casting refreshes uses/duration
// (Foundry adds extraUses/extraDuration; the port refreshes to the spell's base).
export function activateSpellEntry(activeSpells = [], spell) {
  const list = [...(activeSpells || [])];
  const idx = list.findIndex((s) => s.itemId === spell.id);
  const entry = {
    itemId: spell.id,
    name: spell.name || "Заклинание",
    usesRemaining: spell.uses ?? 1,
    durationRemaining: spell.durationHours ?? 0,
    upkeepCost: spell.upkeepCost ?? 0,
  };
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  return list;
}

// Manually spend one use of an active spell; expire at 0.
export function consumeSpellUse(activeSpells = [], itemId) {
  const list = [];
  const expired = [];
  for (const s of activeSpells || []) {
    if (s.itemId !== itemId) { list.push(s); continue; }
    const usesRemaining = Math.max(0, (s.usesRemaining ?? 1) - 1);
    if (usesRemaining <= 0) expired.push(s.name);
    else list.push({ ...s, usesRemaining });
  }
  return { activeSpells: list, expired };
}

// Advance one round for a single character: charge total upkeep energy, decrement
// duration-limited spells, and expire anything depleted. Returns a patch (only the
// fields that changed) + the names of expired spells for a toast/log.
//   ch.activeSpells, ch.energy.value
export function tickRoundPatch(ch) {
  const active = ch?.activeSpells || [];
  if (!active.length) return { patch: {}, expired: [] };

  const energyCur = ch.energy?.value ?? 0;
  const upkeepTotal = active.reduce((a, s) => a + (s.upkeepCost ?? 0), 0);
  // Can't sustain the upkeep bill → the upkeep-costing spells drop this round.
  const canSustain = energyCur >= upkeepTotal;
  const newEnergy = Math.max(0, energyCur - upkeepTotal);

  const next = [];
  const expired = [];
  for (const s of active) {
    // Drop unsustained upkeep spells.
    if (!canSustain && (s.upkeepCost ?? 0) > 0) { expired.push(s.name); continue; }
    // Decrement a positive (round-limited) duration; expire at 0.
    if ((s.durationRemaining ?? 0) > 0) {
      const durationRemaining = s.durationRemaining - 1;
      if (durationRemaining <= 0) { expired.push(s.name); continue; }
      next.push({ ...s, durationRemaining });
    } else {
      next.push(s); // permanent / uses-limited — unchanged by the round tick
    }
  }

  const patch = {};
  if (newEnergy !== energyCur) patch["energy.value"] = newEnergy;
  // Only rewrite the array when membership/values actually changed.
  const changed = expired.length > 0
    || next.some((s, i) => s.durationRemaining !== active[i]?.durationRemaining);
  if (changed) patch.activeSpells = next;
  return { patch, expired };
}
