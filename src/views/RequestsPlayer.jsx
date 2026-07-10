// Player Requests screen (B-64). Lists the player's own requests with status
// chips and drives the new-request flow (kind → subtype → target char → form).
// In-process requests are editable/withdrawable; applied/denied are read-only.
import { useState } from "react";
import { createRequest, updateRequest, withdrawRequest } from "../lib/db";
import {
  REQUEST_KINDS, KIND_LABEL, ITEM_SUBTYPES, ITEM_SUBTYPE_LABEL, REQUEST_STATUS_LABEL,
} from "../lib/requestFields";
import RequestForm from "../components/RequestForm";

const emptyDraft = () => ({ kind: "item", subtype: "weapon", targetCharacterId: "", payload: {} });

export default function RequestsPlayer({ campaignId, uid, myChars = [], campaignStatuses = [], requests = [] }) {
  const [mode, setMode] = useState("list"); // list | new | edit
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const startNew = () => {
    setDraft({ ...emptyDraft(), targetCharacterId: myChars[0]?.id || "" });
    setEditingId(null);
    setErr("");
    setMode("new");
  };
  const startEdit = (r) => {
    setDraft({
      kind: r.kind,
      subtype: r.payload?.itemType || "weapon",
      targetCharacterId: r.targetCharacterId,
      payload: r.payload || {},
    });
    setEditingId(r.id);
    setErr("");
    setMode("edit");
  };
  const cancel = () => { setMode("list"); setEditingId(null); setErr(""); };

  const validate = () => {
    if (!draft.payload.name?.trim()) return "Укажите название.";
    if (!draft.payload.description?.trim()) return "Укажите описание.";
    if (!draft.targetCharacterId) return "Выберите персонажа.";
    return "";
  };

  const submit = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setBusy(true); setErr("");
    try {
      const payload = { ...draft.payload };
      if (draft.kind === "item") payload.itemType = draft.subtype;
      const ch = myChars.find((c) => c.id === draft.targetCharacterId);
      if (editingId) {
        await updateRequest(campaignId, editingId, { payload });
      } else {
        await createRequest(campaignId, {
          kind: draft.kind,
          requesterUid: uid,
          targetCharacterId: draft.targetCharacterId,
          targetCharacterName: ch?.name || "",
          payload,
        });
      }
      cancel();
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (r) => {
    if (!window.confirm("Отозвать заявку?")) return;
    try { await withdrawRequest(campaignId, r.id); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
  };

  if (mode === "new" || mode === "edit") {
    const setPayload = (payload) => setDraft((d) => ({ ...d, payload }));
    return (
      <div className="kk-block kk-request-editor">
        <div className="kk-topbar-row">
          <h2 className="kk-h2">{mode === "edit" ? "Редактировать заявку" : "Новая заявка"}</h2>
          <button className="kk-btn ghost sm" onClick={cancel}>← Назад</button>
        </div>

        <div className="kk-form-grid">
          <div className="kk-field">
            <label>Тип заявки</label>
            <select className="kk-input" value={draft.kind} disabled={mode === "edit"}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value, payload: {} }))}>
              {REQUEST_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          {draft.kind === "item" && (
            <div className="kk-field">
              <label>Тип предмета</label>
              <select className="kk-input" value={draft.subtype} disabled={mode === "edit"}
                onChange={(e) => setDraft((d) => ({ ...d, subtype: e.target.value }))}>
                {ITEM_SUBTYPES.map((s) => <option key={s} value={s}>{ITEM_SUBTYPE_LABEL[s]}</option>)}
              </select>
            </div>
          )}
          <div className="kk-field">
            <label>Персонаж</label>
            <select className="kk-input" value={draft.targetCharacterId} disabled={mode === "edit"}
              onChange={(e) => setDraft((d) => ({ ...d, targetCharacterId: e.target.value }))}>
              <option value="">— выберите —</option>
              {myChars.map((c) => <option key={c.id} value={c.id}>{c.name || "Без имени"}</option>)}
            </select>
          </div>
        </div>

        <RequestForm
          kind={draft.kind}
          subtype={draft.subtype}
          payload={draft.payload}
          onChange={setPayload}
          campaignStatuses={campaignStatuses}
        />

        {err && <div className="kk-error" style={{ marginTop: ".5rem" }}>{err}</div>}
        <div className="kk-topbar-row" style={{ marginTop: ".75rem" }}>
          <button className="kk-btn primary" onClick={submit} disabled={busy}>
            {mode === "edit" ? "Сохранить" : "Отправить"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="kk-block kk-requests-player">
      <div className="kk-topbar-row">
        <h2 className="kk-h2">Заявки</h2>
        <button className="kk-btn primary sm" onClick={startNew} disabled={myChars.length === 0}>
          + Новая заявка
        </button>
      </div>
      {myChars.length === 0 && <div className="kk-empty">Нет персонажей для подачи заявки.</div>}
      {requests.length === 0
        ? <div className="kk-empty">Заявок пока нет.</div>
        : (
          <div className="kk-request-list">
            {requests.map((r) => (
              <RequestRow key={r.id} r={r} onEdit={() => startEdit(r)} onWithdraw={() => withdraw(r)} />
            ))}
          </div>
        )}
    </div>
  );
}

function RequestRow({ r, onEdit, onWithdraw }) {
  const kindLabel = r.kind === "item"
    ? `${KIND_LABEL.item} · ${ITEM_SUBTYPE_LABEL[r.payload?.itemType] || ""}`
    : KIND_LABEL[r.kind];
  const inProcess = r.status === "in_process";
  return (
    <div className={`kk-request-row st-${r.status}`}>
      <div className="kk-request-row-main">
        <span className="kk-request-name">{r.payload?.name || "Без названия"}</span>
        <span className={`kk-chip st-${r.status}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
      </div>
      <div className="kk-request-row-meta">
        {kindLabel} · {r.targetCharacterName || "—"}
      </div>
      {r.payload?.description && <div className="kk-request-row-desc">{r.payload.description}</div>}
      {r.kind === "info-plot" && r.status === "applied" && r.gmAnswer && (
        <div className="kk-request-row-answer"><b>Ответ ГМ:</b> {r.gmAnswer}</div>
      )}
      {inProcess && (
        <div className="kk-request-row-actions">
          <button className="kk-btn ghost sm" onClick={onEdit}>Редактировать</button>
          <button className="kk-btn ghost sm danger" onClick={onWithdraw}>Отозвать</button>
        </div>
      )}
    </div>
  );
}
