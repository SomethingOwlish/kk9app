// Lightweight inline markdown for note bodies (B-64). Renders **bold** and
// *italic*, preserving line breaks. Deliberately tiny — no lists/headings/links
// — so it's safe to run on every note without pulling in react-markdown. Used by
// CharacterCard notes and the info-plot note format (**player desc** / *GM answer*).
function renderInlineMarkdown(text) {
  if (!text) return null;
  const out = [];
  let key = 0;
  const pushText = (chunk) => {
    const lines = String(chunk).split("\n");
    lines.forEach((line, i) => {
      if (i > 0) out.push(<br key={`b${key++}`} />);
      if (line) out.push(line);
    });
  };
  // Bold (**…**) is matched before italic (*…*) so the double-star wins.
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={`s${key++}`}>{m[1]}</strong>);
    else out.push(<em key={`i${key++}`}>{m[2]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

export default function InlineMarkdown({ text }) {
  return <>{renderInlineMarkdown(text)}</>;
}
