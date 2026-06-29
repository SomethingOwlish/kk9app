import { useState } from "react";
import RelationEditor from "./RelationEditor";
import { RELATION_TAG_LABELS, getRelationLabel, relationLevelColor } from "../lib/relations";

// Relations section on the character sheet. relations[] is embedded in the char doc.
// Props:
//   relations — array
//   peers     — [{ id, name, portrait }] for the ref picker
//   canEdit   — player on own char OR GM
//   onChange(nextRelations)        — debounced save (add/edit)
//   onDelete(nextRelations)        — immediate save (delete)
export default function RelationsList({ relations = [], peers = [], canEdit, onChange, onDelete }) {
  const [editing, setEditing] = useState(null); // relation | "new" | null

  const sorted = [...relations].sort(
    (a, b) => Math.abs(b.level ?? 0) - Math.abs(a.level ?? 0),
  );

  function save(rel) {
    const exists = relations.some((r) => r.id === rel.id);
    const next = exists ? relations.map((r) => (r.id === rel.id ? rel : r)) : [...relations, rel];
    onChange(next);
  }

  function remove(rel) {
    if (!window.confirm(`Удалить связь «${rel.name}»?`)) return;
    onDelete(relations.filter((r) => r.id !== rel.id));
  }

  return (
    <section className="kk-block">
      <div className="kk-block-head">
        <h2 className="kk-h2">Связи</h2>
        {canEdit && (
          <button className="kk-btn ghost sm" onClick={() => setEditing("new")}>+ Связь</button>
        )}
      </div>

      {sorted.length === 0 && <div className="kk-empty-sm">Нет связей</div>}

      <div className="kk-rel-list">
        {sorted.map((r) => {
          const lvl = Math.max(-100, Math.min(100, r.level ?? 0));
          const pct = (Math.abs(lvl) / 100) * 50; // half-bar from center
          return (
            <div className="kk-rel-row" key={r.id}>
              <div className="kk-rel-av">
                {r.portrait ? <img src={r.portrait} alt="" /> : <span>{(r.name || "?")[0]}</span>}
              </div>
              <div className="kk-rel-main">
                <div className="kk-rel-top">
                  <span className="kk-rel-name">{r.name}</span>
                  <span className="kk-rel-lvl" style={{ color: relationLevelColor(lvl) }}>
                    {lvl > 0 ? "+" : ""}{lvl} · {getRelationLabel(lvl)}
                  </span>
                </div>
                <div className="kk-rel-bar">
                  <span className="kk-rel-bar-center" />
                  <span
                    className="kk-rel-bar-fill"
                    style={{
                      background: relationLevelColor(lvl),
                      width: `${pct}%`,
                      left: lvl >= 0 ? "50%" : `${50 - pct}%`,
                    }}
                  />
                </div>
                {r.tags?.length > 0 && (
                  <div className="kk-rel-tags">
                    {r.tags.map((t) => RELATION_TAG_LABELS[t] || t).join(", ")}
                  </div>
                )}
                {r.notes && <div className="kk-rel-notes">{r.notes}</div>}
              </div>
              {canEdit && (
                <div className="kk-rel-acts">
                  <button className="kk-icon-btn" title="Изменить" onClick={() => setEditing(r)}>✎</button>
                  <button className="kk-icon-btn kk-icon-del" title="Удалить" onClick={() => remove(r)}>✕</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <RelationEditor
          relation={editing === "new" ? null : editing}
          peers={peers}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
