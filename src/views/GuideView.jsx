import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import guideDefault from "../content/guide.md?raw";

// FEAT-06 — Player-facing rules guide. Content comes from campaign.guideMarkdown
// (editable in-app by GM/admin) and falls back to the bundled docs/player.md.
// Tension/overload mechanics are intentionally absent from the source content.

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[*\\`]/g, "")
    .trim()
    .replace(/[^\wа-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

// Extract plain text from react-markdown heading children.
function textOf(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node.props) return textOf(node.props.children);
  return "";
}

// Build a table of contents from h1/h2 lines in the raw markdown.
function buildToc(md) {
  const toc = [];
  for (const line of md.split("\n")) {
    const m = /^(#{1,2})\s+(.*)$/.exec(line);
    if (!m) continue;
    const text = m[2].replace(/[*\\`]/g, "").trim();
    if (!text) continue;
    toc.push({ level: m[1].length, text, id: slugify(text) });
  }
  return toc;
}

const mdComponents = {
  h1: ({ children, ...props }) => <h1 id={slugify(textOf(children))} {...props}>{children}</h1>,
  h2: ({ children, ...props }) => <h2 id={slugify(textOf(children))} {...props}>{children}</h2>,
};

export default function GuideView({ campaign, canEdit = false, onSave }) {
  const content = campaign?.guideMarkdown != null ? campaign.guideMarkdown : guideDefault;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toc = useMemo(() => buildToc(content), [content]);

  function startEdit() {
    setDraft(content);
    setError("");
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setError("Не удалось сохранить: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="kk-guide kk-guide-edit">
        <div className="kk-edit-bar">
          <span className="kk-edit-title">Правила · редактирование</span>
          <div className="kk-edit-actions">
            <button className="kk-btn ghost" onClick={() => setDraft(guideDefault)}>Сбросить к исходному</button>
            <button className="kk-btn ghost" onClick={() => setEditing(false)} disabled={saving}>Отмена</button>
            <button className="kk-btn primary" onClick={handleSave} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</button>
          </div>
        </div>
        {error && <p className="kk-modal-warn">{error}</p>}
        <textarea
          className="kk-input kk-textarea kk-guide-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={30}
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className="kk-guide">
      <div className="kk-edit-bar">
        <span className="kk-edit-title">Правила игры</span>
        {canEdit && (
          <div className="kk-edit-actions">
            <button className="kk-btn ghost" onClick={startEdit}>Редактировать</button>
          </div>
        )}
      </div>
      {toc.length > 0 && (
        <nav className="kk-guide-toc">
          {toc.map((t, i) => (
            // Button (not <a href="#id">) — the app runs under HashRouter, so a
            // hash anchor would be parsed as a route change and navigate away.
            <button
              key={i}
              type="button"
              className={`kk-guide-toc-link lvl${t.level}`}
              onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {t.text}
            </button>
          ))}
        </nav>
      )}
      <article className="kk-guide-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{content}</ReactMarkdown>
      </article>
    </div>
  );
}
