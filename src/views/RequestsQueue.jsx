// GM request queue (B-65). In-process requests grouped by character; each row
// opens the edit modal (Approve / Deny). Resolved requests collapse into a
// history section (read-only). Reads the campaign-wide `requests` list.
import { useMemo, useState } from "react";
import { KIND_LABEL, ITEM_SUBTYPE_LABEL, REQUEST_STATUS_LABEL } from "../lib/requestFields";
import RequestEditModal from "../components/RequestEditModal";

function kindLabelOf(r) {
  return r.kind === "item"
    ? `${KIND_LABEL.item} · ${ITEM_SUBTYPE_LABEL[r.payload?.itemType] || ""}`
    : KIND_LABEL[r.kind];
}

export default function RequestsQueue({ campaignId, requests = [], characters = [], campaignStatuses = [], gmUid }) {
  const [openReq, setOpenReq] = useState(null);

  const pending = useMemo(() => requests.filter((r) => r.status === "in_process"), [requests]);
  const resolved = useMemo(() => requests.filter((r) => r.status !== "in_process"), [requests]);

  // Group pending by target character (preserve queue order within a group).
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of pending) {
      const key = r.targetCharacterId || "—";
      if (!map.has(key)) map.set(key, { name: r.targetCharacterName || "—", rows: [] });
      map.get(key).rows.push(r);
    }
    return [...map.values()];
  }, [pending]);

  return (
    <div className="kk-block kk-requests-queue">
      <h2 className="kk-h2">Заявки игроков</h2>

      {pending.length === 0
        ? <div className="kk-empty">Нет заявок на рассмотрении.</div>
        : groups.map((g) => (
          <div key={g.name} className="kk-request-group">
            <div className="kk-request-group-title">{g.name}</div>
            <div className="kk-request-list">
              {g.rows.map((r) => (
                <button key={r.id} className="kk-request-row st-in_process is-btn" onClick={() => setOpenReq(r)}>
                  <div className="kk-request-row-main">
                    <span className="kk-request-name">{r.payload?.name || "Без названия"}</span>
                    <span className="kk-chip st-in_process">{REQUEST_STATUS_LABEL.in_process}</span>
                  </div>
                  <div className="kk-request-row-meta">{kindLabelOf(r)}</div>
                </button>
              ))}
            </div>
          </div>
        ))}

      {resolved.length > 0 && (
        <details className="kk-request-history">
          <summary>История ({resolved.length})</summary>
          <div className="kk-request-list">
            {resolved.map((r) => (
              <button key={r.id} className={`kk-request-row st-${r.status} is-btn`} onClick={() => setOpenReq(r)}>
                <div className="kk-request-row-main">
                  <span className="kk-request-name">{r.payload?.name || "Без названия"}</span>
                  <span className={`kk-chip st-${r.status}`}>{REQUEST_STATUS_LABEL[r.status]}</span>
                </div>
                <div className="kk-request-row-meta">{kindLabelOf(r)} · {r.targetCharacterName || "—"}</div>
              </button>
            ))}
          </div>
        </details>
      )}

      {openReq && (
        <RequestEditModal
          campaignId={campaignId}
          req={openReq}
          characters={characters}
          campaignStatuses={campaignStatuses}
          resolvedByUid={gmUid}
          onClose={() => setOpenReq(null)}
        />
      )}
    </div>
  );
}
