// Grouping helpers for the shop lists (kept separate from the Group component so
// Fast Refresh stays happy — component files must export only components).

import { MAGIC_SKILL_NAMES } from "../../lib/seed-skills";

// Stable display order; unknown types fall to the end alphabetically.
export const TYPE_ORDER = ["weapon", "gear", "artifact", "spell", "device", "vehicle", "language", "feature"];

// Bucket for spells whose skill isn't a magic discipline (see spellSchool below).
export const OTHER_SCHOOL = "Остальное";

// The magic school a spell belongs to = its bound skill, when that skill is a
// magic discipline. Spells tied to a non-magic skill fall into «Остальное».
export function spellSchool(item) {
  const skill = item?.skillName;
  return skill && MAGIC_SKILL_NAMES.has(skill) ? skill : OTHER_SCHOOL;
}

// Group an array by item type, with spells further split into magic schools. Returns
// ordered sections { key, type, school, items }: non-spell types stay a single
// section (school = null); the spell type expands into one section per school,
// schools sorted alphabetically with «Остальное» pinned last.
//   typeOf — entry → item type
//   itemOf — entry → the underlying item record carrying `skillName`
export function groupShopSections(arr, { typeOf = (x) => x.type, itemOf = (x) => x } = {}) {
  const byType = new Map();
  for (const x of arr) {
    const t = typeOf(x) || "other";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(x);
  }
  const orderedTypes = [...byType.keys()].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a); const ib = TYPE_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

  const sections = [];
  for (const t of orderedTypes) {
    const entries = byType.get(t);
    if (t !== "spell") {
      sections.push({ key: t, type: t, school: null, items: entries });
      continue;
    }
    const bySchool = new Map();
    for (const x of entries) {
      const sc = spellSchool(itemOf(x));
      if (!bySchool.has(sc)) bySchool.set(sc, []);
      bySchool.get(sc).push(x);
    }
    const orderedSchools = [...bySchool.keys()].sort((a, b) => {
      if (a === OTHER_SCHOOL) return 1;
      if (b === OTHER_SCHOOL) return -1;
      return a.localeCompare(b, "ru");
    });
    for (const sc of orderedSchools) {
      sections.push({ key: `spell:${sc}`, type: "spell", school: sc, items: bySchool.get(sc) });
    }
  }
  return sections;
}
