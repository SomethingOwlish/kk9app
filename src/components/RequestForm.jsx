// Shared request field renderer (B-64). Renders name + description (required)
// plus the mechanical fields for the given kind / item subtype, driven entirely
// by requestFields.js descriptors. Reused by the player's RequestsPlayer flow
// and the GM's RequestEditModal so a request and the entity it becomes on
// approval can never drift. Controlled: owns nothing, edits `payload` via onChange.
import { descriptorsFor, getFieldVal, setFieldVal } from "../lib/requestFields";
import { SKILLS_DATA } from "../lib/seed-skills";

const SKILL_NAMES = SKILLS_DATA.map((s) => s.name);

export default function RequestForm({ kind, subtype, payload = {}, onChange, campaignStatuses = [], disabled = false }) {
  const set = (path, val) => onChange(setFieldVal(payload, path, val));
  const fields = descriptorsFor(kind, subtype);
  const statusNames = campaignStatuses.map((s) => s.name).filter(Boolean);

  const renderField = (d) => {
    const val = getFieldVal(payload, d.path);
    const common = { className: "kk-input", disabled };
    switch (d.type) {
      case "checkbox":
        return (
          <label key={d.path} className="kk-item-form-chk">
            <input type="checkbox" checked={!!val} disabled={disabled}
              onChange={(e) => set(d.path, e.target.checked)} /> {d.label}
          </label>
        );
      case "number":
        return (
          <div key={d.path} className="kk-field">
            <label>{d.label}</label>
            <input {...common} type="number" min={d.min} max={d.max}
              value={val ?? d.default}
              onChange={(e) => set(d.path, e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
        );
      case "textarea":
        return (
          <div key={d.path} className="kk-field" style={{ gridColumn: "1 / -1" }}>
            <label>{d.label}</label>
            <textarea {...common} rows={2} value={val ?? d.default}
              onChange={(e) => set(d.path, e.target.value)} />
          </div>
        );
      case "select":
        return (
          <div key={d.path} className="kk-field">
            <label>{d.label}</label>
            <select {...common} value={val ?? d.default}
              onChange={(e) => {
                const raw = e.target.value;
                set(d.path, typeof d.default === "number" ? Number(raw) : raw);
              }}>
              {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        );
      case "skill":
      case "status": {
        const list = d.type === "skill" ? SKILL_NAMES : statusNames;
        return (
          <div key={d.path} className="kk-field">
            <label>{d.label}</label>
            <select {...common} value={val ?? ""} onChange={(e) => set(d.path, e.target.value)}>
              <option value="">— не задано —</option>
              {list.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        );
      }
      default:
        return (
          <div key={d.path} className="kk-field">
            <label>{d.label}</label>
            <input {...common} type="text" value={val ?? ""} maxLength={200}
              onChange={(e) => set(d.path, e.target.value)} />
          </div>
        );
    }
  };

  return (
    <div className="kk-request-form">
      <div className="kk-field" style={{ gridColumn: "1 / -1" }}>
        <label>Название *</label>
        <input className="kk-input" type="text" required disabled={disabled} maxLength={200}
          value={payload.name || ""} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="kk-field" style={{ gridColumn: "1 / -1" }}>
        <label>Описание *</label>
        <textarea className="kk-input" rows={3} required disabled={disabled}
          value={payload.description || ""} onChange={(e) => set("description", e.target.value)} />
      </div>
      {fields.length > 0 && (
        <div className="kk-form-grid kk-request-fields">
          {fields.map(renderField)}
        </div>
      )}
    </div>
  );
}
