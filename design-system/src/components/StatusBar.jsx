function durationLabel(s) {
  if (s.durationMode === "charges" && s.durationRemaining != null) return ` [${s.durationRemaining}]`;
  if (s.durationMode === "counter" && s.durationRemaining != null) return ` (${s.durationRemaining})`;
  if (s.durationMode === "scene") return " (scene)";
  return "";
}

export default function StatusBar({ statuses = [], isGM, onRemove, onAdd, onView }) {
  return (
    <div className="kk-status-bar">
      {statuses.map((s, i) => (
        <span
          key={(s._uid || s.definitionId || s.name) + i}
          className="kk-status-chip"
          onClick={() => onView?.(s)}
          title={s.name + durationLabel(s)}
        >
          <span className="kk-status-chip-name">{s.name}{durationLabel(s)}</span>
          {isGM && (
            <button
              className="kk-status-remove"
              onClick={(e) => { e.stopPropagation(); onRemove?.(s); }}
              aria-label={`Remove ${s.name}`}
            >×</button>
          )}
        </span>
      ))}
      {isGM && (
        <button className="kk-status-add" onClick={onAdd} title="Add status">+</button>
      )}
    </div>
  );
}
