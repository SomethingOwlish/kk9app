import { SKILLS_DATA } from "../lib/seed-skills";

// IMP-05a — skill tooltip technical support.
// Renders the extended "Что это" / "Когда бросать" tooltip when a skill carries
// the optional `description` / `whenToRoll` fields. A character's own skill objects
// only store {name, attr, categ, die, modifier}, so the authored text is looked up
// by NAME from the SKILLS_DATA catalog (src/lib/seed-skills.js) — THAT is where you
// populate the content. Falls back to the plain single-line tooltip when neither
// field is present (no regression). Bulk content authoring is IMP-05b.
const SKILL_REF = Object.fromEntries(SKILLS_DATA.map((s) => [s.name, s]));

export function skillTipContent(s, fallback) {
  const ref = SKILL_REF[s?.name] || {};
  const rawDesc = s?.description ?? ref.description;
  const rawWhen = s?.whenToRoll ?? ref.whenToRoll;
  const desc = rawDesc && String(rawDesc).trim();
  const when = rawWhen && String(rawWhen).trim();
  if (!desc && !when) return fallback;
  return (
    <span className="kk-skill-tip">
      {desc && (
        <span className="kk-skill-tip-sec">
          <b>Что это</b>
          <span>{desc}</span>
        </span>
      )}
      {when && (
        <span className="kk-skill-tip-sec">
          <b>Когда бросать</b>
          <span>{when}</span>
        </span>
      )}
    </span>
  );
}
