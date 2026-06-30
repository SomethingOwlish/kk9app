// IMP-05a — skill tooltip technical support.
// Renders the extended "Что это" / "Когда бросать" tooltip when a skill carries
// the optional `description` / `whenToRoll` fields, and falls back to the plain
// single-line tooltip text when neither is present (no regression for skills
// without the new fields). The authored content itself is added later (IMP-05b).
export function skillTipContent(s, fallback) {
  const desc = s?.description && String(s.description).trim();
  const when = s?.whenToRoll && String(s.whenToRoll).trim();
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
