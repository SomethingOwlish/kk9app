// Foundry character actor → KK9 Firestore character doc (FEAT-20, TASK-102).
// tension.* lives on the MAIN doc (D-18); health.will is excluded (D-03). Unmapped
// fields are logged to warnings; missing fields fall back to schema defaults.
import { stripHtml, num, str, bool, tailId } from "./util.js";

const ATTR_KEYS = ["agility", "smarts", "spirit", "endurance", "magic"];
const SCHEMA_VERSION = 1;

function mapAttributes(src = {}) {
  const out = {};
  for (const k of ATTR_KEYS) {
    const a = src[k] || {};
    out[k] = { die: num(a.die, 4), modifier: num(a.modifier) };
  }
  return out;
}

// `system.skills` is a dynamic object keyed by ability id; customSkills[] are
// free-form. abilityIndex (id → {name, attr, categ}) resolves the keyed ones.
function mapSkills(s, abilityIndex, warnings, owner) {
  const skills = [];
  const skillObj = s.skills && typeof s.skills === "object" ? s.skills : {};
  for (const [key, val] of Object.entries(skillObj)) {
    if (!val || typeof val !== "object") continue;
    const meta = abilityIndex.get(key) || abilityIndex.get(tailId(key)) || (val.name ? { name: val.name, attr: val.linkedAttribute, categ: val.category } : null);
    if (!meta) { warnings.push({ kind: "unmapped-skill", owner, key }); continue; }
    skills.push({
      name: str(meta.name), attr: str(meta.attr, "smarts"), categ: str(meta.categ, "learned"),
      die: num(val.die, 4), modifier: num(val.modifier, -2),
    });
  }
  for (const c of (s.customSkills || [])) {
    skills.push({
      name: str(c.name), attr: str(c.linkedAttribute, "smarts"), categ: "personal",
      die: num(c.die, 4), modifier: num(c.modifier, -2),
    });
  }
  return skills;
}

function mapRelations(arr, map, owner) {
  return (arr || []).map((r) => ({
    ref: map.resolve(r.uuid, "relations.uuid", owner),
    name: str(r.name),
    portrait: str(r.img),
    level: num(r.level),
    tags: Array.isArray(r.tags) ? r.tags : [],
    notes: stripHtml(r.notes),
  }));
}

function mapActiveStatuses(arr, map, owner) {
  return (arr || []).map((a) => ({
    definitionId: map.resolve(a.itemId, "active_statuses.itemId", owner),
    name: str(a.statusName),
    statusTypes: Array.isArray(a.status_types) ? a.status_types : [],
    durationMode: str(a.duration_mode, "time"),
    durationRemaining: num(a.duration_value),
    effects: [],
  }));
}

export function mapCharacter(actor, map, abilityIndex, warnings) {
  const s = actor.system || {};
  const owner = actor.name || actor._id;
  const tension = s.tension || {};

  const doc = {
    schemaVersion: SCHEMA_VERSION,
    type: "character",
    characterCreated: s.character_created !== false,
    name: str(actor.name),
    portrait: str(actor.img),
    age: num(s.age, 15),
    gender: str(s.gender),
    birthplace: str(s.birthplace),
    dormitory: str(s.dormitory),
    height: str(s.height),
    build: str(s.build),
    allergies: str(s.allergies),
    weaknesses: str(s.weaknesses),
    biography: stripHtml(s.biography) || str(s.biography_text),
    faculty: {
      name: str(s.faculty_name),
      key: str(s.faculty_key),
      color: str(s.faculty_color, "#c8a14e"),
    },
    facultyRef: map.resolve(s.faculty, "faculty", owner),
    academyYear: str(s.academy_year, "1"),
    semester: num(s.semester, 1),
    attributes: mapAttributes(s.attributes),
    health: {
      physical: { value: num(s.health?.physical?.value), toughness: num(s.health?.physical?.toughness, 4) },
      mental: { value: num(s.health?.mental?.value) },
    },
    energy: { value: num(s.energy?.value), max: num(s.energy?.max) },
    tension: {
      current: num(tension.current),
      overcap: num(tension.overcap),
      energyPenalty: num(tension.energy_penalty),
      max: num(tension.max),
    },
    overflow_damage: num(s.overflow_damage),
    bennies: num(s.bennies, 3),
    money: num(s.money),
    experience: num(s.experience),
    notes: [],
    activeSpells: (s.active_spells || []).map((sp) => ({
      ref: map.resolve(sp.itemId, "active_spells.itemId", owner),
      usesRemaining: num(sp.uses_remaining),
      durationRemaining: num(sp.duration_remaining),
      upkeepCost: num(sp.upkeep_cost),
    })),
    activeStatuses: mapActiveStatuses(s.active_statuses, map, owner),
    magicLevels: (s.magicLevels || []).map((m) => ({
      ref: map.resolve(m.itemId, "magicLevels.itemId", owner),
      level: str(m.level),
    })),
    customSkills: [],
    languages: (s.languages || []).map((l) => ({
      name: str(l.name),
      itemId: map.resolve(l.itemId, "languages.itemId", owner),
    })),
    features: [],
    skills: mapSkills(s, abilityIndex, warnings, owner),
    relations: mapRelations(s.relations, map, owner),
    refs: {
      artifacts: map.resolveArray(s.artifact_refs, "artifact_refs", owner),
      companions: map.resolveArray(s.companion_refs, "companion_refs", owner),
      daemons: map.resolveArray(s.daemon_refs, "daemon_refs", owner),
      contacts: (s.contact_refs || []).map((c) => ({
        orgId: map.resolve(c.uuid, "contact_refs.uuid", owner),
        level: num(c.level),
      })).filter((c) => c.orgId),
    },
  };
  // gm_notes → separate private/gm sub-doc (handled by convert orchestration).
  return { doc, gmNotes: str(s.gm_notes) };
}
