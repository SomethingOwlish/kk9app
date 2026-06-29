import { useState } from "react";

// IMP-02 — Bio/anketa edit modal. Available to the character owner and the GM.
// Edits the 6 demographic fields + biography. On save, writes all 7 fields and
// passes the list of changed field labels up for logging.
const BIO_FIELDS = [
  ["birthplace", "Место рождения", "text"],
  ["dormitory", "Общежитие", "text"],
  ["height", "Рост", "text"],
  ["build", "Телосложение", "text"],
  ["allergies", "Аллергии", "text"],
  ["weaknesses", "Слабости", "text"],
  ["biography", "Биография", "textarea"],
];

export default function BioEditCard({ ch, onSave, onCancel }) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(BIO_FIELDS.map(([k]) => [k, ch[k] ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    // Trim text values; record which fields actually changed for the log.
    const fields = {};
    const changed = [];
    for (const [k, label] of BIO_FIELDS) {
      const next = (form[k] ?? "").trim();
      fields[k] = next;
      if (next !== (ch[k] ?? "")) changed.push(label);
    }
    try {
      await onSave(fields, changed);
    } catch (err) {
      setError("Не удалось сохранить: " + (err?.message || err));
      setSaving(false);
    }
  }

  return (
    <div className="kk-overlay" onClick={onCancel}>
      <div className="kk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kk-modal-head">
          <span className="kk-modal-title">Анкета · {ch.name}</span>
          <button className="kk-modal-x" onClick={onCancel} aria-label="Закрыть">✕</button>
        </div>
        <form className="kk-modal-body" onSubmit={handleSubmit}>
          <div className="kk-form-grid">
            {BIO_FIELDS.filter(([, , t]) => t === "text").map(([k, label]) => (
              <label className="kk-field" key={k}>
                <span>{label}</span>
                <input
                  className="kk-input"
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                  maxLength={200}
                />
              </label>
            ))}
          </div>
          <label className="kk-field kk-field-wide">
            <span>Биография</span>
            <textarea
              className="kk-input kk-textarea"
              rows={5}
              value={form.biography}
              onChange={(e) => set("biography", e.target.value)}
              maxLength={4000}
            />
          </label>
          {error && <p className="kk-modal-warn">{error}</p>}
          <div className="kk-modal-foot">
            <button type="button" className="kk-btn ghost" onClick={onCancel} disabled={saving}>Отмена</button>
            <button type="submit" className="kk-btn primary" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
