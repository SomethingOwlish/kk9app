import { useState } from "react";

function compUid() { return Math.random().toString(36).slice(2, 10); }

// Companions are embedded in character.companions[] (NOT items).
// Collapsible section near the bio; owner + GM may add/edit/toggle state.
// Props: companions[], canEdit, onChange(next)
export default function CompanionRefs({ companions = [], canEdit, onChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", portrait: "", description: "" });

  if (companions.length === 0 && !canEdit) return null;

  function toggleState(c) {
    onChange(companions.map((x) =>
      x.id === c.id ? { ...x, state: x.state === "stunned" ? "active" : "stunned" } : x));
  }
  function remove(c) {
    if (!window.confirm(`Убрать спутника «${c.name}»?`)) return;
    onChange(companions.filter((x) => x.id !== c.id));
  }
  function add(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onChange([...companions, {
      id: compUid(), name: form.name.trim(), portrait: form.portrait.trim(),
      description: form.description.trim(), state: "active",
    }]);
    setForm({ name: "", portrait: "", description: "" });
    setAdding(false);
  }

  return (
    <details className="kk-bio-details kk-companions">
      <summary className="kk-h2 kk-bio-summary">Спутники {companions.length > 0 && <span className="kk-count">{companions.length}</span>}</summary>
      <div className="kk-bio-body">
        {companions.length === 0 && <div className="kk-empty-sm">Нет спутников</div>}
        <div className="kk-comp-list">
          {companions.map((c) => (
            <div className={`kk-comp-row kk-comp-${c.state}`} key={c.id}>
              <div className="kk-comp-av">
                {c.portrait ? <img src={c.portrait} alt="" /> : <span>{(c.name || "?")[0]}</span>}
              </div>
              <div className="kk-comp-main">
                <div className="kk-comp-top">
                  <span className="kk-comp-name">{c.name}</span>
                  <span className={`kk-comp-state kk-comp-state-${c.state}`}>
                    {c.state === "stunned" ? "Оглушён" : "Активен"}
                  </span>
                </div>
                {c.description && <div className="kk-comp-desc">{c.description}</div>}
              </div>
              {canEdit && (
                <div className="kk-comp-acts">
                  <button className="kk-icon-btn" title="Активен ↔ оглушён" onClick={() => toggleState(c)}>⟳</button>
                  <button className="kk-icon-btn kk-icon-del" title="Убрать" onClick={() => remove(c)}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {canEdit && !adding && (
          <button className="kk-btn ghost sm" style={{ marginTop: ".5rem" }} onClick={() => setAdding(true)}>+ Спутник</button>
        )}
        {canEdit && adding && (
          <form className="kk-item-form" onSubmit={add} style={{ marginTop: ".5rem" }}>
            <input className="kk-input" placeholder="Имя *" value={form.name} maxLength={100}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            <input className="kk-input" placeholder="URL портрета (необязательно)" value={form.portrait}
              onChange={(e) => setForm((p) => ({ ...p, portrait: e.target.value }))} />
            <textarea className="kk-input kk-textarea" rows={2} placeholder="Описание" value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} maxLength={500} />
            <div className="kk-item-form-actions">
              <button className="kk-btn sm" type="submit" disabled={!form.name.trim()}>Добавить</button>
              <button className="kk-btn ghost sm" type="button" onClick={() => setAdding(false)}>Отмена</button>
            </div>
          </form>
        )}
      </div>
    </details>
  );
}
