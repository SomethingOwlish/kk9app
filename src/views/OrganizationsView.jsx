import { useState } from "react";
import SearchableSelect from "../components/SearchableSelect";
import { normalizeMembers } from "../lib/db";

// Организации tab. GM-curated; each card has a global "visible to players" switch.
// Players see visible cards read-only. NOT items — own Firestore collection.
// IMP-16 — full Foundry ContactDataModel parity (type/access/leader/rep/goals/
// notes/members[obj]/former_members/events).
// Props:
//   orgs[], isGM, characters[]
//   onCreate(), onUpdate(orgId, patch), onDelete(orgId), onUnlinkChar(charId, orgId)
//   onOpenChar(charId) — open a linked member's card (optional)

const ORG_TYPES = [
  { value: "academic", label: "Академическая" },
  { value: "criminal", label: "Криминальная" },
  { value: "government", label: "Правительственная" },
  { value: "magical", label: "Магическая" },
  { value: "corporate", label: "Корпоративная" },
  { value: "underground", label: "Подпольная" },
  { value: "other", label: "Другое" },
];
const ACCESS_LEVELS = [
  { value: "open", label: "Открытая" },
  { value: "known", label: "Общеизвестная" },
  { value: "secret", label: "Тайная" },
  { value: "forbidden", label: "Запретная" },
];
const typeLabel = (v) => ORG_TYPES.find((t) => t.value === v)?.label || v || "";
const accessLabel = (v) => ACCESS_LEVELS.find((a) => a.value === v)?.label || v || "";

export default function OrganizationsView({ orgs = [], isGM, characters = [], onCreate, onUpdate, onDelete, onUnlinkChar, onOpenChar }) {
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
          <OrgCard key={o.id} org={o} isGM={isGM} characters={characters}
            onUpdate={onUpdate} onDelete={onDelete} onUnlinkChar={onUnlinkChar} onOpenChar={onOpenChar} />
        ))}
      </div>
    </div>
  );
}

function linesToArr(s) { return s.split("\n").map((x) => x.trim()).filter(Boolean); }

// Read-only member row; clickable when it points at a known character.
function MemberRow({ m, onOpenChar }) {
  const clickable = m.charId && onOpenChar;
  return (
    <span
      className={`kk-org-member${clickable ? " kk-org-member--link" : ""}`}
      onClick={clickable ? () => onOpenChar(m.charId) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {m.charName || "(без имени)"}
    </span>
  );
}

function OrgCard({ org, isGM, characters, onUpdate, onDelete, onUnlinkChar, onOpenChar }) {
  const [open, setOpen] = useState(false);
  const [memberPick, setMemberPick] = useState("");
  const [memberName, setMemberName] = useState("");
  const save = (patch) => onUpdate(org.id, patch);

  const members = normalizeMembers(org.members);
  const formerMembers = Array.isArray(org.formerMembers) ? org.formerMembers : [];

  const addMemberFromChar = (charId) => {
    const ch = characters.find((c) => c.id === charId);
    if (!ch || members.some((m) => m.charId === charId)) return;
    save({ members: [...members, { charId, charName: ch.name || "" }] });
    setMemberPick("");
  };
  const addMemberByName = () => {
    const name = memberName.trim();
    if (!name) return;
    save({ members: [...members, { charId: null, charName: name }] });
    setMemberName("");
  };
  const removeMember = (idx) => save({ members: members.filter((_, i) => i !== idx) });

  if (!isGM) {
    return (
      <div className="kk-org-card">
        <div className="kk-org-head"><span className="kk-org-name">{org.name}</span>
          {org.orgType && <span className="kk-org-type">{typeLabel(org.orgType)}</span>}</div>
        {org.accessLevel && <div className="kk-org-access">Доступ: {accessLabel(org.accessLevel)}</div>}
        {org.description && <p className="kk-org-desc">{org.description}</p>}
        {org.leader && <div className="kk-org-sub"><b>Лидер:</b> {org.leader}</div>}
        {org.representative && <div className="kk-org-sub"><b>Представитель:</b> {org.representative}</div>}
        {org.goals && <div className="kk-org-sub"><b>Цели:</b> {org.goals}</div>}
        {members.length > 0 && (
          <div className="kk-org-sub"><b>Состав:</b>{" "}
            {members.map((m, i) => <MemberRow key={i} m={m} onOpenChar={onOpenChar} />)}
          </div>
        )}
        {formerMembers.length > 0 && (
          <div className="kk-org-sub"><b>Бывшие:</b> {formerMembers.map((m) => m.charName + (m.comment ? ` (${m.comment})` : "")).join(", ")}</div>
        )}
        {org.events?.length > 0 && (
          <div className="kk-org-sub"><b>События:</b>
            <ul className="kk-org-events">{org.events.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  const memberOptions = characters
    .filter((c) => !members.some((m) => m.charId === c.id))
    .map((c) => ({ value: c.id, label: c.name || "(без имени)" }));

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
            <SearchableSelect options={ORG_TYPES} value={org.orgType || "other"}
              onChange={(v) => save({ orgType: v })} /></label>
          <label className="kk-sc-field"><span>Уровень доступа</span>
            <SearchableSelect options={ACCESS_LEVELS} value={org.accessLevel || "open"}
              onChange={(v) => save({ accessLevel: v })} /></label>
          <label className="kk-sc-field"><span>Лидер</span>
            <input className="kk-input" defaultValue={org.leader || ""}
              onBlur={(e) => save({ leader: e.target.value })} /></label>
          <label className="kk-sc-field"><span>Представитель</span>
            <input className="kk-input" defaultValue={org.representative || ""}
              onBlur={(e) => save({ representative: e.target.value })} /></label>
          <label className="kk-sc-field"><span>Цели</span>
            <textarea className="kk-input kk-textarea" rows={2} defaultValue={org.goals || ""}
              onBlur={(e) => save({ goals: e.target.value })} /></label>
          <label className="kk-sc-field"><span>Описание</span>
            <textarea className="kk-input kk-textarea" rows={3} defaultValue={org.description || ""}
              onBlur={(e) => save({ description: e.target.value })} /></label>
          <label className="kk-sc-field"><span>Заметки (ГМ)</span>
            <textarea className="kk-input kk-textarea" rows={2} defaultValue={org.notes || ""}
              onBlur={(e) => save({ notes: e.target.value })} /></label>

          <div className="kk-sc-field">
            <span>Состав</span>
            <div className="kk-org-member-chips">
              {members.map((m, i) => (
                <span className="kk-org-member-chip" key={i}>
                  <MemberRow m={m} onOpenChar={onOpenChar} />
                  <button className="kk-icon-btn kk-icon-del" title="Убрать" onClick={() => removeMember(i)}>✕</button>
                </span>
              ))}
              {members.length === 0 && <span className="kk-empty-sm">Никого</span>}
            </div>
            {memberOptions.length > 0 && (
              <SearchableSelect options={memberOptions} value={memberPick}
                onChange={addMemberFromChar} placeholder="+ добавить персонажа" />
            )}
            <div className="kk-org-member-add">
              <input className="kk-input" value={memberName} placeholder="или имя вручную"
                onChange={(e) => setMemberName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMemberByName()} />
              <button className="kk-btn sm" disabled={!memberName.trim()} onClick={addMemberByName}>+</button>
            </div>
          </div>

          <label className="kk-sc-field"><span>Бывшие участники (имя — комментарий, по строке)</span>
            <textarea className="kk-input kk-textarea" rows={2}
              defaultValue={formerMembers.map((m) => m.comment ? `${m.charName} — ${m.comment}` : m.charName).join("\n")}
              onBlur={(e) => save({ formerMembers: linesToArr(e.target.value).map((line) => {
                const [charName, ...rest] = line.split("—");
                return { charName: (charName || "").trim(), comment: rest.join("—").trim() };
              }) })} /></label>

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
