// Foundry NPC / daemon / companion actors → KK9 Firestore (FEAT-20, TASK-107).
// NPC light/hard/boss → an `isNpc` character doc. Daemon → a Library entry
// (kind:"daemon", full schema — D-09 resolved by TASK-074). Companions are
// embedded on their owner in the current app, not standalone docs → skipped+warned.
import { stripHtml, num, str, bool } from "./util.js";

const ATTR_KEYS = ["agility", "smarts", "spirit", "strength", "magic"];

function mapNpcAttributes(src = {}) {
  const out = {};
  for (const k of ATTR_KEYS) {
    const a = src[k];
    if (a == null) continue;
    out[k === "strength" ? "endurance" : k] = { die: num(a.die, 6), mod: num(a.modifier) };
  }
  return out;
}

// Daemon attributes carry the magic axis and keep `modifier` (full schema).
function mapDaemonAttributes(src = {}) {
  const out = {};
  for (const k of ["agility", "smarts", "spirit", "endurance", "magic"]) {
    const a = src[k] || {};
    out[k] = { die: num(a.die, 6), modifier: num(a.modifier) };
  }
  return out;
}

// TASK-074 — daemon actor → full-schema Library entry (kind:"daemon").
function mapDaemon(actor, map, owner) {
  const s = actor.system || {};
  return {
    kind: "daemon",
    name: str(actor.name),
    img: str(actor.img),
    visibleToPlayers: false,
    description: stripHtml(s.description),
    is_orb: bool(s.is_orb, true),
    true_name: str(s.true_name),
    corporation: str(s.corporation, "taro"),
    daemon_class: str(s.daemon_class, "1"),
    major_arcana: str(s.major_arcana, "Дурак"),
    suit: str(s.suit, "cups"),
    color: str(s.color, "white"),
    appearance: str(s.appearance),
    dream: str(s.dream),
    fear: str(s.fear),
    desire: str(s.desire),
    captor: str(s.captor),
    used: bool(s.used),
    gone: bool(s.gone),
    attributes: mapDaemonAttributes(s.attributes),
    health: {
      physical: { value: num(s.health?.physical?.value) },
      mental: { value: num(s.health?.mental?.value) },
    },
    condition: str(s.condition, "good"),
    owner_id: map.resolve(s.owner_id, "daemon.owner_id", owner) || "",
    toughness: num(s.toughness, 5),
    tension: {
      current: num(s.tension?.current),
      overcap: num(s.tension?.overcap),
      energy_penalty: num(s.tension?.energy_penalty),
    },
  };
}

// Returns { doc } for an NPC, { library } for a daemon, or { skip } otherwise.
export function mapActorNonCharacter(actor, map, warnings) {
  const type = actor.type;
  const owner = actor.name || actor._id;
  const s = actor.system || {};

  if (type === "daemon") {
    return { library: mapDaemon(actor, map, owner) };
  }
  if (type === "companion") {
    warnings.push({ kind: "skipped-actor", type, owner, reason: "companions are embedded on the owner, not standalone docs" });
    return { skip: "companion-embedded" };
  }
  if (type === "container") {
    warnings.push({ kind: "skipped-actor", type, owner, reason: "container has no SPA equivalent" });
    return { skip: "container" };
  }

  if (type === "npc-light" || type === "npc-hard" || type === "npc-boss") {
    const doc = {
      isNpc: true,
      npcType: type,
      name: str(actor.name),
      portrait: str(actor.img),
      role: str(s.role),
      race: str(s.race),
      gender: str(s.gender),
      biography: stripHtml(s.biography),
      notes: str(s.notes),
      goals: str(s.goals),
      motives: str(s.motives),
      appearance: str(s.appearance),
      attributes: mapNpcAttributes(s.attributes),
      health: {
        physical: { value: num(s.health?.physical?.value), toughness: num(s.toughness, 4) },
        mental: { value: num(s.health?.mental?.value) },
      },
      die: num(s.die, 0),
      initiative: num(s.initiative),
      energy: num(s.energy),
      tension: {
        current: num(s.tension?.current),
        overcap: num(s.tension?.overcap),
        energyPenalty: num(s.tension?.energy_penalty),
      },
      skills: [],
      activeStatuses: [],
      relations: (s.relations || []).map((r) => ({
        name: str(r.name), status: str(r.status, "neutral"),
        level: num(r.level), notes: stripHtml(r.notes), love: bool(r.love),
      })),
      faculty: { name: str(s.faculty_name), key: str(s.faculty_key) },
      refs: {
        artifacts: map.resolveArray(s.artifact_refs, "npc.artifact_refs", owner),
        companions: map.resolveArray(s.companion_refs, "npc.companion_refs", owner),
        daemons: map.resolveArray(s.daemon_refs, "npc.daemon_refs", owner),
      },
    };
    return { doc };
  }

  warnings.push({ kind: "unknown-actor-type", type, owner });
  return { skip: "unknown-type" };
}
