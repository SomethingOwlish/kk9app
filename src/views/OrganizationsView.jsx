import { useState } from "react";

// Организации tab. GM-curated; each card has a global "visible to players" switch.
// Players see visible cards read-only. NOT items — own Firestore collection.
// Props:
//   orgs[], isGM
//   onCreate(), onUpdate(orgId, patch), onDelete(orgId), onUnlinkChar(charId, orgId)
export default function OrganizationsView({ orgs = [], isGM, onCreate, onUpdate, onDelete, onUnlinkChar }) {
  const visible = isGM ? orgs : orgs.filter((o) => o.visibleToPlayers);

  return (
    <div className="kk-orgs">
      <div className="kk-board-topbar">
        <div className="kk-h2">Организации <span className="kk-count">{visible.length}</span></div>
        {isGM && <button className="kk-btn sm" onClick={onCreate}>+ Организация</button>}
      </div>

      {visible.length === 0 && (
        <div className="kk-empty">{isGM ? "Нет организаций. Создайте первую." : "Пока ничего не известно."}</div>
      )}

      <div className="kk-orgs-grid">
        {visible.map((o) => (
          <OrgCard key={o.id} org={o} isGM={isGM} onUpdate={onUpdate} onDelete={onDelete} onUnlinkChar={onUnlinkChar} />
        ))}
      </div>
    </div>
  );
}

function linesToArr(s) { return s.split("\n").map((x) => x.trim()).filter(Boolean); }

function OrgCard({ org, isGM, onUpdate, onDelete, onUnlinkChar }) {
  const [open, setOpen] = useState(false);
  const save = (patch) => onUpdate(org.id, patch);

  if (!isGM) {
    return (
      <div className="kk-org-card">
        <div className="kk-org-head"><span className="kk-org-name">{org.name}</span>
          {org.orgType && <span className="kk-org-type">{org.orgType}</span>}</div>
        {org.accessLevel && <div className="kk-org-access">Доступ: {org.accessLevel}</div>}
        {org.description && <p className="kk-org-desc">{org.description}</p>}
        {org.members?.length > 0 && (
          <div className="kk-org-sub"><b>Состав:</b> {org.members.join(", ")}</div>
        )}
        {org.events?.length > 0 && (
          <div className="kk-org-sub"><b>События:</b>
            <ul className="kk-org-events">{org.events.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`kk-org-card kk-org-edit ${org.visibleToPlayers ? "kk-org-visible" : ""}`}>
      <div className="kk-org-head">
        <input className="kk-input kk-org-name-input" defaultValue={org.name}
          onBlur={(e) => e.target.value !== org.name && save({ name: e.target.value })} />
        <button className="kk-icon-btn kk-icon-del" title="Удалить организацию"
          onClick={() => window.confirm(`Удалить «${org.name}»? Связи будут сняты.`) && onDelete(org.id)}>✕</button>
      </div>

      <label className="kk-org-vis">
        <input type="checkbox" checked={!!org.visibleToPlayers}
          onChange={(e) => save({ visibleToPlayers: e.target.checked })} />
        <span>{org.visibleToPlayers ? "Видна игрокам" : "Скрыта от игроков"}</span>
      </label>

      <button className="kk-btn ghost sm" onClick={() => setOpen((v) => !v)}>
        {open ? "Свернуть" : "Редактировать"}
      </button>

      {open && (
        <div className="kk-org-fields">
          <label className="kk-sc-field"><span>Тип</span>
            <input className="kk-input" defaultValue={org.orgType || ""}
              onBlur={(e) => save({ orgType: e.target.value })} /></label>
          <label className="kk-sc-field"><span>Уровень доступа</span>
            <input className="kk-input" defaultValue={org.accessLevel || ""}
              onBlur={(e) => save({ accessLevel: e.target.value })} /></label>
          <label className="kk-sc-field"><span>Описание</span>
            <textarea className="kk-input kk-textarea" rows={3} defaultValue={org.description || ""}
              onBlur={(e) => save({ description: e.target.value })} /></label>
          <label className="kk-sc-field"><span>Состав (по строке на участника)</span>
            <textarea className="kk-input kk-textarea" rows={3} defaultValue={(org.members || []).join("\n")}
              onBlur={(e) => save({ members: linesToArr(e.target.value) })} /></label>
          <label className="kk-sc-field"><span>События (по строке)</span>
            <textarea className="kk-input kk-textarea" rows={3} defaultValue={(org.events || []).join("\n")}
              onBlur={(e) => save({ events: linesToArr(e.target.value) })} /></label>
        </div>
      )}

      {org.actorRefs?.length > 0 && (
        <div className="kk-org-actors">
          <div className="kk-org-sub"><b>Связанные персонажи:</b></div>
          {org.actorRefs.map((a) => (
            <div className="kk-org-actor" key={a.charId}>
              <span>{a.charName || a.charId}</span>
              <span className="kk-org-actor-lvl">{a.level > 0 ? "+" : ""}{a.level ?? 0}</span>
              <button className="kk-icon-btn kk-icon-del" title="Отвязать" onClick={() => onUnlinkChar(a.charId, org.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
