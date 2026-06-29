import { useState } from "react";
import SearchableSelect from "./SearchableSelect";
import { RELATION_TAG_OPTIONS, getRelationLabel } from "../lib/relations";

function relUid() { return Math.random().toString(36).slice(2, 10); }

// Add/edit a relation embedded in character.relations[].
// Props:
//   relation  — existing relation to edit, or null to add
//   peers     — [{ id, name, portrait }] campaign chars/npcs for the ref picker
//   onSave(relation), onClose
export default function RelationEditor({ relation, peers = [], onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    id: relation?.id || relUid(),
    name: relation?.name || "",
    ref: relation?.ref || "",
    portrait: relation?.portrait || "",
    level: relation?.level ?? 0,
    tags: relation?.tags || [],
    notes: relation?.notes || "",
  }));
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const peerOptions = peers.map((p) => ({ value: p.id, label: p.name || "(без имени)" }));

  function pickRef(id) {
    const peer = peers.find((p) => p.id === id);
    setForm((p) => ({
      ...p,
      ref: id,
      // Auto-fill name + portrait from the referenced character when empty.
      name: p.name || peer?.name || "",
      portrait: peer?.portrait || p.portrait || "",
    }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), level: Math.max(-100, Math.min(100, Number(form.level) || 0)) });
    onClose();
  }

  return (
    <div className="kk-modal-backdrop" onClick={onClose}>
      <div className="kk-se-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kk-se-head">
          <span className="kk-se-title">{relation ? "Изменить связь" : "Добавить связь"}</span>
          <button className="kk-sc-close" onClick={onClose}>✕</button>
        </div>

        <form className="kk-rel-form" onSubmit={submit}>
          <label className="kk-sc-field">
            <span>Персонаж кампании (необязательно)</span>
            <SearchableSelect
              options={peerOptions}
              value={form.ref}
              onChange={pickRef}
              placeholder="— ручная запись —"
            />
          </label>

          <label className="kk-sc-field">
            <span>Имя *</span>
            <input className="kk-input" value={form.name} maxLength={120}
              onChange={(e) => set("name", e.target.value)} required />
          </label>

          <label className="kk-sc-field">
            <span>Уровень: {form.level > 0 ? "+" : ""}{form.level} · {getRelationLabel(form.level)}</span>
            <input type="range" min={-100} max={100} step={1} value={form.level}
              onChange={(e) => set("level", Number(e.target.value))} />
          </label>

          <label className="kk-sc-field">
            <span>Теги</span>
            <SearchableSelect multi options={RELATION_TAG_OPTIONS} value={form.tags}
              onChange={(v) => set("tags", v)} placeholder="— выбрать теги —" />
          </label>

          <label className="kk-sc-field">
            <span>Заметки</span>
            <textarea className="kk-input kk-textarea" rows={2} maxLength={1000}
              value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </label>

          <button className="kk-btn primary kk-se-apply" type="submit" disabled={!form.name.trim()}>
            {relation ? "Сохранить" : "Добавить связь"}
          </button>
        </form>
      </div>
    </div>
  );
}
