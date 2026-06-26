import { useState, useEffect } from "react";
import {
  watchScenes, createScene, updateScene, deleteScene,
  activateScene, deactivateAllScenes,
} from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

export default function SceneManager() {
  const [scenes, setScenes] = useState([]);
  const [editing, setEditing] = useState(null); // null | "new" | sceneId
  const [form, setForm] = useState({ title: "", background: "", text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => watchScenes(CAMPAIGN_ID, setScenes), []);

  function openNew() {
    setForm({ title: "", background: "", text: "" });
    setEditing("new");
  }
  function openEdit(scene) {
    setForm({ title: scene.title || "", background: scene.background || "", text: scene.text || "" });
    setEditing(scene.id);
  }
  function cancel() { setEditing(null); }

  async function save() {
    if (!form.title.trim()) return;
    setBusy(true);
    try {
      if (editing === "new") {
        await createScene(CAMPAIGN_ID, {
          title: form.title.trim(),
          background: form.background.trim(),
          text: form.text.trim(),
        });
      } else {
        await updateScene(CAMPAIGN_ID, editing, {
          title: form.title.trim(),
          background: form.background.trim(),
          text: form.text.trim(),
        });
      }
      setEditing(null);
    } catch (e) {
      alert("Ошибка: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function doActivate(sceneId) {
    setBusy(true);
    try { await activateScene(CAMPAIGN_ID, sceneId); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
    finally { setBusy(false); }
  }

  async function doDeactivate() {
    setBusy(true);
    try { await deactivateAllScenes(CAMPAIGN_ID); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
    finally { setBusy(false); }
  }

  async function doDelete(sceneId) {
    if (!confirm("Удалить сцену?")) return;
    setBusy(true);
    try { await deleteScene(CAMPAIGN_ID, sceneId); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="kk-scene-mgr">
      <div className="kk-h2">
        Сцены
        <button
          className="kk-btn sm primary"
          onClick={openNew}
          disabled={busy || editing === "new"}
        >
          + Новая сцена
        </button>
      </div>

      {editing === "new" && (
        <SceneForm
          form={form}
          onChange={setForm}
          onSave={save}
          onCancel={cancel}
          busy={busy}
          label="Создать"
        />
      )}

      {scenes.length === 0 && editing !== "new" && (
        <div className="kk-empty">Сцен ещё нет. Создайте первую.</div>
      )}

      <div className="kk-scene-list">
        {scenes.map((sc) =>
          editing === sc.id ? (
            <SceneForm
              key={sc.id}
              form={form}
              onChange={setForm}
              onSave={save}
              onCancel={cancel}
              busy={busy}
              label="Сохранить"
            />
          ) : (
            <SceneRow
              key={sc.id}
              scene={sc}
              busy={busy}
              onActivate={() => doActivate(sc.id)}
              onDeactivate={doDeactivate}
              onEdit={() => openEdit(sc)}
              onDelete={() => doDelete(sc.id)}
            />
          )
        )}
      </div>
    </div>
  );
}

function SceneRow({ scene, busy, onActivate, onDeactivate, onEdit, onDelete }) {
  return (
    <div className={`kk-scene-row${scene.isActive ? " active" : ""}`}>
      {scene.background && (
        <div
          className="kk-scene-thumb"
          style={{ backgroundImage: `url(${scene.background})` }}
          aria-hidden
        />
      )}
      <div className="kk-scene-info">
        <div className="kk-scene-title">
          {scene.title}
          {scene.isActive && <span className="kk-scene-live">● эфир</span>}
        </div>
        {scene.text && (
          <div className="kk-scene-preview">
            {scene.text.length > 120 ? scene.text.slice(0, 120) + "…" : scene.text}
          </div>
        )}
      </div>
      <div className="kk-scene-btns">
        {scene.isActive ? (
          <button className="kk-btn sm danger" onClick={onDeactivate} disabled={busy}>
            Выкл
          </button>
        ) : (
          <button className="kk-btn sm primary" onClick={onActivate} disabled={busy}>
            Активировать
          </button>
        )}
        <button className="kk-btn sm ghost" onClick={onEdit} disabled={busy}>
          Ред.
        </button>
        <button className="kk-btn sm danger" onClick={onDelete} disabled={busy}>
          ✕
        </button>
      </div>
    </div>
  );
}

function SceneForm({ form, onChange, onSave, onCancel, busy, label }) {
  return (
    <div className="kk-scene-form">
      <div className="kk-field">
        <label>Название</label>
        <input
          className="kk-input"
          value={form.title}
          onChange={(e) => onChange((f) => ({ ...f, title: e.target.value }))}
          placeholder="Название сцены"
          autoFocus
        />
      </div>
      <div className="kk-field">
        <label>Фон (URL изображения)</label>
        <input
          className="kk-input"
          value={form.background}
          onChange={(e) => onChange((f) => ({ ...f, background: e.target.value }))}
          placeholder="https://example.com/image.jpg"
        />
      </div>
      <div className="kk-field">
        <label>Описание</label>
        <textarea
          className="kk-input kk-textarea"
          value={form.text}
          onChange={(e) => onChange((f) => ({ ...f, text: e.target.value }))}
          placeholder="Описание сцены, видимое игрокам…"
          rows={4}
        />
      </div>
      <div className="kk-edit-foot">
        <button className="kk-btn ghost" onClick={onCancel} disabled={busy}>
          Отмена
        </button>
        <button
          className="kk-btn primary"
          onClick={onSave}
          disabled={busy || !form.title.trim()}
        >
          {busy ? "…" : label}
        </button>
      </div>
    </div>
  );
}
