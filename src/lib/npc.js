// Board NPC helpers. A board NPC is a lightweight character doc (isNpc:true).
// It may be "linked" to a Library entry via `libraryRef` + `kind`, in which case
// its statblock (attributes/toughness/skills) is NOT copied into the doc but
// resolved live from the referenced Library entry — see resolveNpc().

const CORE_ATTRS = ["agility", "smarts", "spirit", "endurance"];

// Light NPCs are simple mooks and (per design) have no relations block.
// Blank NPCs (no kind) are treated as light. Everything else is "heavy".
export function isLightNpc(npc) {
  const kind = npc?.kind;
  return !kind || kind === "npc-light";
}

// Merge a linked NPC's live per-board state (wounds, statuses, relations, name/img
// overrides) with the statblock resolved from its Library entry. Library stores
// attribute dice as {die,modifier}; the sheet/engine expect {die,mod}.
export function resolveNpc(npc, lib) {
  if (!npc?.libraryRef || !lib) return npc;
  const src = lib.attributes || {};
  const attributes = {};
  for (const k of [...CORE_ATTRS, "magic"]) {
    const a = src[k];
    if (a) attributes[k] = { die: a.die ?? 6, mod: a.modifier ?? a.mod ?? 0 };
  }
  for (const k of CORE_ATTRS) if (!attributes[k]) attributes[k] = { die: 6, mod: 0 };
  const skills = Array.isArray(lib.abilities)
    ? lib.abilities.map((s) => ({ name: s.name || "", die: s.die ?? 6, mod: s.modifier ?? s.mod ?? 0 }))
    : [];
  const toughness = lib.toughness ?? 4;
  return {
    ...npc,
    name: npc.name || lib.name || "",
    img: npc.img || lib.img || "",
    attributes,
    skills,
    health: { ...npc.health, physical: { value: npc.health?.physical?.value ?? 0, toughness } },
  };
}
