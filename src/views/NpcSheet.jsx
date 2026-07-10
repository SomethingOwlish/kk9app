import { useState } from "react";
import { updateCharacterNow, deleteNpc, applyStatus, removeStatus } from "../lib/db";
import StatusBar from "../components/StatusBar";
import StatusEditor from "../components/StatusEditor";

const ATTRS = ["agility", "smarts", "spirit", "endurance"];
const ATTR_RU = { agility: "Ловкость", smarts: "Интеллект", spirit: "Дух", endurance: "Выносливость" };
const DIES = [4, 6, 8, 10, 12];

// Board NPC quick-sheet. Live combat state only (wounds, statuses). For linked
// (library-backed) NPCs the statblock is read-only — edit it, and relations, in
// the Library. Blank NPCs remain fully editable here.
export default function NpcSheet({ npc, campaignId, campaignStatuses, onClose }) {
  // Linked board NPCs read their statblock from the Library entry (resolved
  // upstream). Their attributes/toughness are shown read-only here — edit them
  // in the Library. Only live per-board state (wounds, statuses, relations) is
  // editable on the board doc.
  const linked = !!npc.libraryRef;
  const [name, setName] = useState(npc.name || "");
  const [attrs, setAttrs] = useState(() => npc.attributes || {
    agility: { die: 6, mod: 0 }, smarts: { die: 6, mod: 0 },
    spirit:  { die: 6, mod: 0 }, endurance: { die: 6, mod: 0 },
  });
  const [health, setHealth] = useState(() => npc.health?.physical?.value ?? 0);
  const [toughness, setToughness] = useState(() => npc.health?.physical?.toughness ?? 4);
  const [overflow, setOverflow] = useState(() => npc.overflow_damage ?? 0);
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      // Linked NPCs: never persist statblock (attributes/toughness) onto the
      // board doc — those live in the Library entry.
      const patch = linked
        ? { name, health: { physical: { value: health } }, overflow_damage: overflow }
        : { name, attributes: attrs, health: { physical: { value: health, toughness } }, overflow_damage: overflow };
      await updateCharacterNow(campaignId, npc.id, patch);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteNpc(campaignId, npc.id);
    onClose();
  };

  const setAttrField = (attr, field, value) =>
    setAttrs(prev => ({ ...prev, [attr]: { ...prev[attr], [field]: value } }));

  const fmtDie = (a) => `к${a?.die ?? 6}${a?.mod ? (a.mod > 0 ? `+${a.mod}` : a.mod) : ""}`;

  return (
    <div className="kk-npcsheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="kk-npcsheet">
        <div className="kk-npcsheet-head">
          <input
            className="kk-input kk-npcsheet-name"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={save}
            placeholder="Имя НПС"
          />
          <button className="kk-btn ghost sm" onClick={onClose}>✕</button>
        </div>

        {linked && <div className="kk-npcsheet-linked">Статблок из библиотеки — правьте в разделе «Библиотека».</div>}

        <div className="kk-npcsheet-section">
          <div className="kk-h3">Характеристики</div>
          {linked
            ? <div className="kk-npcsheet-attrs">
                {ATTRS.map(attr => (
                  <div key={attr} className="kk-npcsheet-attr">
                    <label>{ATTR_RU[attr]}</label>
                    <span className="kk-npcsheet-attr-ro">{fmtDie(attrs[attr])}</span>
                  </div>
                ))}
              </div>
            : <div className="kk-npcsheet-attrs">
                {ATTRS.map(attr => (
                  <div key={attr} className="kk-npcsheet-attr">
                    <label>{ATTR_RU[attr]}</label>
                    <select
                      className="kk-input"
                      value={attrs[attr]?.die ?? 6}
                      onChange={e => { setAttrField(attr, "die", +e.target.value); save(); }}
                    >
                      {DIES.map(d => <option key={d} value={d}>к{d}</option>)}
                    </select>
                    <input
                      className="kk-input kk-npcsheet-mod"
                      type="number"
                      value={attrs[attr]?.mod ?? 0}
                      onChange={e => setAttrField(attr, "mod", +e.target.value)}
                      onBlur={save}
                      placeholder="мод"
                    />
                  </div>
                ))}
              </div>
          }
        </div>

        <div className="kk-npcsheet-section">
          <div className="kk-h3">Здоровье</div>
          <div className="kk-form-grid">
            <div className="kk-field">
              <label>Ранения</label>
              <input className="kk-input" type="number" min={0} max={3} value={health}
                onChange={e => setHealth(+e.target.value)} onBlur={save}/>
            </div>
            <div className="kk-field">
              <label>Стойкость</label>
              {linked
                ? <input className="kk-input" type="number" value={toughness} readOnly title="Из библиотеки"/>
                : <input className="kk-input" type="number" min={1} value={toughness}
                    onChange={e => setToughness(+e.target.value)} onBlur={save}/>
              }
            </div>
            <div className="kk-field">
              <label>Переполнение</label>
              <input className="kk-input" type="number" min={0} value={overflow}
                onChange={e => setOverflow(+e.target.value)} onBlur={save}/>
            </div>
          </div>
        </div>

        <div className="kk-npcsheet-section">
          <div className="kk-h3">Статусы</div>
          <StatusBar
            statuses={npc.activeStatuses || []}
            isGM={true}
            onAdd={() => setStatusEditorOpen(true)}
            onRemove={(inst) => removeStatus(campaignId, npc.id, inst).catch(console.error)}
          />
        </div>

        <div className="kk-npcsheet-footer">
          {!confirmDelete
            ? <button className="kk-btn danger sm" onClick={() => setConfirmDelete(true)}>Удалить НПС</button>
            : <>
                <span className="kk-npcsheet-confirm-label">Удалить навсегда?</span>
                <button className="kk-btn danger sm" onClick={handleDelete}>Да, удалить</button>
                <button className="kk-btn ghost sm" onClick={() => setConfirmDelete(false)}>Отмена</button>
              </>
          }
          <button className="kk-btn sm" onClick={save} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>

      {statusEditorOpen && (
        <StatusEditor
          campaignStatuses={campaignStatuses}
          activeStatuses={npc.activeStatuses || []}
          onApply={(inst) => applyStatus(campaignId, npc.id, inst).catch(console.error)}
          onClose={() => setStatusEditorOpen(false)}
        />
      )}
    </div>
  );
}
