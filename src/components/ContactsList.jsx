import { useState } from "react";
import SearchableSelect from "./SearchableSelect";

// Per-character list of linked organizations (refs.contacts[] = [{ orgId, level }]).
// Mirror of org.actorRefs[]. GM links/unlinks; owner+GM adjust own level (−5..+5).
// Props:
//   contacts[]  — refs.contacts
//   orgs[]      — organizations visible to the viewer
//   isGM, isOwner, canSetLevel
//   onLink(orgId), onUnlink(orgId), onSetLevel(orgId, level)
// IMP-17: the card owner may link/unlink too. `orgs` is already the viewer's
// visible set, so an owner can only ever link an org they can see.
export default function ContactsList({ contacts = [], orgs = [], isGM, isOwner, canSetLevel, onLink, onUnlink, onSetLevel }) {
  const canLink = isGM || isOwner;
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");

  const byId = Object.fromEntries(orgs.map((o) => [o.id, o]));
  const linkedIds = new Set(contacts.map((c) => c.orgId));
  const available = orgs.filter((o) => !linkedIds.has(o.id));

  if (contacts.length === 0 && !canLink) return null;

  return (
    <section className="kk-block">
      <div className="kk-block-head">
        <h2 className="kk-h2">Организации</h2>
        {canLink && available.length > 0 && (
          <button className="kk-btn ghost sm" onClick={() => setPicking((v) => !v)}>+ Привязать</button>
        )}
      </div>

      {canLink && picking && (
        <div className="kk-contact-pick">
          <SearchableSelect
            options={available.map((o) => ({ value: o.id, label: o.name || "(без имени)" }))}
            value={pick}
            onChange={(v) => setPick(v)}
            placeholder="— выбрать организацию —"
          />
          <button className="kk-btn sm" disabled={!pick}
            onClick={() => { onLink(pick); setPick(""); setPicking(false); }}>Привязать</button>
        </div>
      )}

      {contacts.length === 0 && <div className="kk-empty-sm">Нет связей с организациями</div>}

      <div className="kk-contact-list">
        {contacts.map((c) => {
          const org = byId[c.orgId];
          if (!org) return null; // org hidden from this viewer or deleted
          return (
            <div className="kk-contact-row" key={c.orgId}>
              <div className="kk-contact-main">
                <span className="kk-contact-name">{org.name}</span>
                {org.orgType && <span className="kk-contact-type">{org.orgType}</span>}
              </div>
              <div className="kk-contact-lvl">
                {canSetLevel ? (
                  <>
                    <button className="kk-step" onClick={() => onSetLevel(c.orgId, Math.max(-5, (c.level ?? 0) - 1))}>−</button>
                    <span className="kk-contact-lvl-val">{c.level > 0 ? "+" : ""}{c.level ?? 0}</span>
                    <button className="kk-step" onClick={() => onSetLevel(c.orgId, Math.min(5, (c.level ?? 0) + 1))}>+</button>
                  </>
                ) : (
                  <span className="kk-contact-lvl-val">{c.level > 0 ? "+" : ""}{c.level ?? 0}</span>
                )}
              </div>
              {canLink && (
                <button className="kk-icon-btn kk-icon-del" title="Отвязать" onClick={() => onUnlink(c.orgId)}>✕</button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
