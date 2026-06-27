import Tip from "./Tip";

function durationLabel(s) {
  if (s.durationMode === "counter") return ` (${s.durationRemaining ?? "∞"})`;
  if (s.durationMode === "scene")   return " (сцена)";
  return "";
}

export default function StatusBar({ statuses = [], isGM, onRemove, onAdd }) {
  return (
    <div className="kk-status-bar">
      {statuses.map((s, i) => (
        <Tip key={s.id + i} text={`${s.name}${durationLabel(s)}${s.type === "roll_modifier" ? ` · бросок ${s.value >= 0 ? "+" : ""}${s.value}` : ""}`}>
          <span className="kk-status-chip">
            <span>{s.icon}</span>
            {isGM && (
              <button
                className="kk-status-remove"
                onClick={() => onRemove(s)}
                aria-label={`Убрать ${s.name}`}
              >×</button>
            )}
          </span>
        </Tip>
      ))}
      {isGM && (
        <button className="kk-status-add" onClick={onAdd} title="Добавить статус">+</button>
      )}
    </div>
  );
}
