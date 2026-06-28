export default function EmptyState({ message, cta }) {
  return (
    <div className="kk-empty">
      {message}
      {cta && <span> <code>{cta}</code></span>}
    </div>
  );
}
