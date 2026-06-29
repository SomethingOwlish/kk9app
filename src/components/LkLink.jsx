// FEAT-05 — Legend Keeper wiki link (Level 1: links only).
// Reusable: renders nothing unless `url` is a non-empty string. No
// entity-specific logic lives here so it can wrap any LK-linked record.
export default function LkLink({ url, label = "Вики" }) {
  if (!url || typeof url !== "string" || !url.trim()) return null;
  return (
    <a
      className="kk-lk-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Открыть статью в Legend Keeper"
    >
      📖 {label}
    </a>
  );
}
