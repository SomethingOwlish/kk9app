import { useState, useEffect } from "react";
import { watchJournalPages, addJournalPage, editJournalPage, deleteJournalPage } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

const STREAMS = [
  { id: "campaign",   label: "Кампания",  gmOnly: false },
  { id: "worldNews",  label: "Новости мира", gmOnly: false },
  { id: "gmPrivate",  label: "ГМ (приватно)", gmOnly: true },
];

function PageCard({ page, isGM, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const date = page.createdAt?.toDate?.()?.toLocaleDateString("ru-RU") ?? "";
  return (
    <div className="kk-jpage">
      <button className="kk-jpage-head" onClick={() => setOpen(o => !o)}>
        <span className="kk-jpage-title">{page.title || "(без заголовка)"}</span>
        <span className="kk-jpage-date">{date}</span>
        <span className="kk-jpage-arrow">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="kk-jpage-body">
          <pre className="kk-jpage-text">{page.body}</pre>
          {isGM && (
            <div className="kk-jpage-acts">
              <button className="kk-btn ghost sm" onClick={() => onEdit(page)}>Ред.</button>
              <button className="kk-btn danger sm" onClick={() => onDelete(page.id)}>Удалить</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PageForm({ initial, onSave, onCancel }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  return (
    <div className="kk-jform">
      <input
        className="kk-input"
        placeholder="Заголовок"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <textarea
        className="kk-input kk-textarea"
        rows={6}
        placeholder="Текст записи…"
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      <div className="kk-jform-acts">
        <button className="kk-btn ghost sm" onClick={onCancel}>Отмена</button>
        <button className="kk-btn primary sm" disabled={!title.trim()} onClick={() => onSave({ title, body })}>Сохранить</button>
      </div>
    </div>
  );
}

export default function JournalView({ isGM }) {
  const [stream, setStream] = useState("campaign");
  const [pages, setPages] = useState([]);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(null);

  const visibleStreams = isGM ? STREAMS : STREAMS.filter(s => !s.gmOnly);
  // Clamp stream to a visible stream without calling setState inside an effect.
  const effectiveStream = visibleStreams.some(s => s.id === stream) ? stream : "campaign";

  useEffect(() => {
    return watchJournalPages(CAMPAIGN_ID, effectiveStream, setPages);
  }, [effectiveStream]);

  const handleAdd = async ({ title, body }) => {
    await addJournalPage(CAMPAIGN_ID, stream, { title, body });
    setComposing(false);
  };

  const handleEdit = async ({ title, body }) => {
    await editJournalPage(CAMPAIGN_ID, stream, editing.id, { title, body });
    setEditing(null);
  };

  const handleDelete = async (pageId) => {
    if (!confirm("Удалить запись?")) return;
    await deleteJournalPage(CAMPAIGN_ID, stream, pageId);
  };

  return (
    <div className="kk-journal">
      <div className="kk-journal-tabs">
        {visibleStreams.map(s => (
          <button
            key={s.id}
            className={`kk-jtab ${stream === s.id ? "on" : ""}`}
            onClick={() => { setStream(s.id); setComposing(false); setEditing(null); }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isGM && !composing && !editing && (
        <button className="kk-btn primary sm kk-journal-add" onClick={() => setComposing(true)}>
          + Добавить запись
        </button>
      )}

      {composing && (
        <PageForm onSave={handleAdd} onCancel={() => setComposing(false)} />
      )}

      {editing && (
        <PageForm initial={editing} onSave={handleEdit} onCancel={() => setEditing(null)} />
      )}

      {!composing && !editing && (
        <div className="kk-jpages">
          {pages.length === 0
            ? <div className="kk-empty">Записей нет.</div>
            : pages.map(p => (
                <PageCard
                  key={p.id}
                  page={p}
                  isGM={isGM}
                  onEdit={setEditing}
                  onDelete={handleDelete}
                />
              ))
          }
        </div>
      )}
    </div>
  );
}
