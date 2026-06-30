// Output validation (FEAT-20, TASK-105). Checks required fields, enum values and
// array types on each produced doc. Returns a flat error list; convert.js exits 1
// when it is non-empty.
import { KNOWN_ITEM_TYPES } from "./mapItem.js";

const ATTRS = ["agility", "smarts", "spirit", "endurance", "magic"];
const DAMAGE_LEVELS = new Set(["light", "heavy", "lethal"]);
const isStr = (v) => typeof v === "string";
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export function validateSeed(seed) {
  const errors = [];
  const err = (path, msg) => errors.push({ path, msg });

  for (const ch of seed.characters || []) {
    const p = `characters/${ch._id}`;
    if (!isStr(ch.name) || !ch.name.trim()) err(p, "name is required");
    if (!ch.attributes) err(p, "attributes missing");
    else if (ch.isNpc) {
      // NPCs legitimately carry only a subset of attributes — just type-check present ones.
      for (const [k, a] of Object.entries(ch.attributes)) {
        if (!isNum(a?.die)) err(p, `attributes.${k}.die must be a number`);
      }
    } else for (const a of ATTRS) {
      if (!ch.attributes[a]) { err(p, `attributes.${a} missing`); continue; }
      if (!isNum(ch.attributes[a].die)) err(p, `attributes.${a}.die must be a number`);
    }
    if (!ch.isNpc) {
      if (!ch.health?.physical || !isNum(ch.health.physical.toughness)) err(p, "health.physical.toughness must be a number");
      if (!Array.isArray(ch.skills)) err(p, "skills must be an array");
      if (!ch.refs || typeof ch.refs !== "object") err(p, "refs must be an object");
      if (ch.health?.will != null) err(p, "health.will must be excluded (D-03)");
      if (!ch.tension || !isNum(ch.tension.current)) err(p, "tension.current must be on the main doc (D-18)");
    }
  }

  for (const it of seed.items || []) {
    const p = `items/${it._id}`;
    if (!KNOWN_ITEM_TYPES.has(it.type)) err(p, `unknown item type "${it.type}"`);
    if (!isStr(it.name)) err(p, "name must be a string");
    if (!(it.ownerCharacterId === null || isStr(it.ownerCharacterId))) err(p, "ownerCharacterId must be string|null");
    if (it.type === "weapon" && it.damageLevel && !DAMAGE_LEVELS.has(it.damageLevel)) err(p, `invalid damageLevel "${it.damageLevel}"`);
    if (Array.isArray(it.skillBonuses) === false && it.skillBonuses != null) err(p, "skillBonuses must be an array");
  }

  // Library entries (FEAT-04/TASK-074): daemon and other reference cards.
  const LIB_KINDS = new Set(["npc-light", "npc-hard", "npc-boss", "curator", "faculty", "companion", "daemon"]);
  for (const lib of seed.library || []) {
    const p = `library/${lib._id}`;
    if (!LIB_KINDS.has(lib.kind)) err(p, `unknown library kind "${lib.kind}"`);
    if (!isStr(lib.name) || !lib.name.trim()) err(p, "name is required");
    if (typeof lib.visibleToPlayers !== "boolean") err(p, "visibleToPlayers must be a boolean");
  }

  return errors;
}
