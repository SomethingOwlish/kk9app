// GM request edit modal (B-65). Edit any field, then Approve (create the entity
// from the last-saved values) or Deny. Enforces the info-plot GM-answer
// requirement and warns on same-name collisions before applying. Applied/denied
// requests render read-only.
import { useState } from "react";
import { updateRequest, approveRequest, denyRequest } from "../lib/db";
import { KIND_LABEL, ITEM_SUBTYPE_LABEL, REQUEST_STATUS_LABEL } from "../lib/requestFields";
import RequestForm from "./RequestForm";

export default function RequestEditModal({ campaignId, req, characters = [], campaignStatuses = [], resolvedByUid, onClose }) {
  const [payload, setPayload] = useState(() => req.payload || {});
  const [gmAnswer, setGmAnswer] = useState(() => req.gmAnswer || "");
  const [includeDesc, setIncludeDesc] = useState(() => !!req.includePlayerDescription);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const resolved = req.status !== "in_process";
  const subtype = payload.itemType || "weapon";
  const targetChar = characters.find((c) => c.id === req.targetCharacterId);

  const kindLabel = req.kind === "item"
    ? `${KIND_LABEL.item} · ${ITEM_SUBTYPE_LABEL[payload.itemType] || ""}`
    : KIND_LABEL[req.kind];

  // Same-name collision on the target card (skill/feature name, or note title).
  const collisionName = () => {
    if (!targetChar) return "";
    const name = (payload.name || "").trim();
    if (!name) return "";
    if (req.kind === "skill" && (targetChar.skills || []).some((s) => s.name === name)) return name;
    if (req.kind === "feature" && (targetChar.features || []).some((f) => f.name === name)) return name;
    if (req.kind === "info-plot" && (targetChar.notes || []).some((n) => n.title === name)) return name;
    return "";
  };

  const doSave = async () => {
    setBusy(true); setErr("");
    try {
      await updateRequest(campaignId, req.id, { payload, gmAnswer, includePlayerDescription: includeDesc });
    } catch (e) { setErr(e?.message || String(e)); }
    finally { setBusy(false); }
  };

  const doApprove = async () => {
    if (!payload.name?.trim() || !payload.description?.trim()) {
      setErr("Название и описание обязательны."); return;
    }
    if (req.kind === "info-plot" && !gmAnswer.trim()) {
      setErr("Для инфо-сюжета обязателен ответ ГМ."); return;
    }
    const clash = collisionName();
    if (clash && !window.confirm(`У персонажа уже есть «${clash}». Всё равно создать новую запись?`)) return;
    setBusy(true); setErr("");
    try {
      await approveRequest(campaignId, req, { payload, gmAnswer, includePlayerDescription: includeDesc, resolvedByUid });
      onClose();
    } catch (e) { setErr(e?.message || String(e)); setBusy(false); }
  };

  const doDeny = async () => {
    if (!window.confirm("Отклонить заявку?")) return;
    setBusy(true); setErr("");
    try {
      await denyRequest(campaignId, req.id, resolvedByUid);
      onClose();
    } catch (e) { setErr(e?.message || String(e)); setBusy(false); }
  };

  return (
    <div className="kk-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kk-modal kk-request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kk-topbar-row">
          <h2 className="kk-h2">{kindLabel}</h2>
          <button className="kk-drawer-x" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="kk-request-modal-meta">
          Персонаж: <b>{req.targetCharacterName || targetChar?.name || "—"}</b>
          <span className={`kk-chip st-${req.status}`} style={{ marginLeft: ".5rem" }}>
            {REQUEST_STATUS_LABEL[req.status]}
          </span>
        </div>

        <RequestForm
          kind={req.kind}
          subtype={subtype}
          payload={payload}
          onChange={setPayload}
          campaignStatuses={campaignStatuses}
          disabled={resolved}
        />

        {req.kind === "info-plot" && (
          <div className="kk-request-answer">
            <div className="kk-field" style={{ gridColumn: "1 / -1" }}>
              <label>Ответ ГМ *</label>
              <textarea className="kk-input" rows={3} value={gmAnswer} disabled={resolved}
                onChange={(e) => setGmAnswer(e.target.value)} />
            </div>
            <label className="kk-item-form-chk">
              <input type="checkbox" checked={includeDesc} disabled={resolved}
                onChange={(e) => setIncludeDesc(e.target.checked)} /> Включить описание игрока
            </label>
          </div>
        )}

        {err && <div className="kk-error" style={{ marginTop: ".5rem" }}>{err}</div>}

        {!resolved && (
          <div className="kk-topbar-row" style={{ marginTop: ".75rem", gap: ".4rem" }}>
            <button className="kk-btn ghost sm" onClick={doSave} disabled={busy}>Сохранить</button>
            <div style={{ flex: 1 }} />
            <button className="kk-btn ghost sm danger" onClick={doDeny} disabled={busy}>Отклонить</button>
            <button className="kk-btn primary sm" onClick={doApprove} disabled={busy}>Применить</button>
          </div>
        )}
      </div>
    </div>
  );
}
