export default function SectionHeader({ title, count, action }) {
  return (
    <h2 className="kk-h2">
      <span>{title}{count != null && <span className="kk-count"> ({count})</span>}</span>
      {action}
    </h2>
  );
}
