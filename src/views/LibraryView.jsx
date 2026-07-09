import { useState, useMemo } from "react";
import {
  LIBRARY_KINDS, LIBRARY_KIND_LABEL, DAEMON_CORPORATIONS, DAEMON_SUITS,
  DAEMON_COLORS, CONDITIONS, MAJOR_ARCANA,
} from "../lib/library";

// FEAT-04 (reshaped) — Library. GM reference collection for NPCs (all weights),
// faculty curators, faculties, companions, daemons. Each card has a global
// "visible to players" switch (default off). Players see only visible cards,
// read-only, grouped by kind. NOT items — own Firestore collection.
//
// Список НЕ редактируется на месте: карточки только для просмотра. Правка —
// через кнопку «Изменить», открывающую модалку с полным набором полей вида
// записи (портировано из старых сид-моделей: NPC-light/hard/boss, кураторы,
// факультеты, спутники, даймоны).
//
// Props:
//   entries[], isGM
//   onCreate(kind), onUpdate(id, patch), onDelete(id), onSeed(kind) | null
//   seedable — Set of kinds that have a catalog to seed from
export default function LibraryView({ entries = [], isGM, onCreate, onUpdate, onDelete, onSeed, seedable }) {
  const [tab, setTab] = useState(LIBRARY_KINDS[0].kind);
  const [editing, setEditing] = useState(null); // entry being edited (GM modal)
  const seedSet = seedable instanceof Set ? seedable : new Set(seedable || []);

  // Players: only visible kinds with at least one visible card are worth tabbing.
  const visibleEntries = useMemo(
    () => (isGM ? entries : entries.filter((e) => e.visibleToPlayers)),
    [entries, isGM],
  );
  const kinds = useMemo(() => {
    if (isGM) return LIBRARY_KINDS;
    const present = new Set(visibleEntries.map((e) => e.kind));
    return LIBRARY_KINDS.filter((k) => present.has(k.kind));
  }, [isGM, visibleEntries]);

  const activeTab = kinds.some((k) => k.kind === tab) ? tab : kinds[0]?.kind;
  const rows = visibleEntries.filter((e) => e.kind === activeTab);

  if (!isGM && kinds.length === 0) {
    return (
      <div className="kk-lib">
        <div className="kk-h2">Библиотека</div>
        <div className="kk-empty">Пока ничего не известно.</div>
      </div>
    );
  }

  return (
    <div className="kk-lib">
      <div className="kk-board-topbar">
        <div className="kk-h2">Библиотека <span className="kk-count">{rows.length}</span></div>
        {isGM && activeTab && (
          <div className="kk-lib-actions">
            {onSeed && seedSet.has(activeTab) && (
              <button className="kk-btn ghost sm" onClick={() => onSeed(activeTab)}>Заполнить из справочника</button>
            )}
            <button className="kk-btn sm" onClick={() => onCreate(activeTab)}>+ {LIBRARY_KIND_LABEL[activeTab]}</button>
          </div>
        )}
      </div>

      <div className="kk-lib-tabs">
        {kinds.map((k) => (
          <button key={k.kind} className={`kk-lib-tab ${activeTab === k.kind ? "on" : ""}`} onClick={() => setTab(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="kk-empty">{isGM ? "Пусто. Создайте запись или заполните из справочника." : "Пока ничего не известно."}</div>
      )}

      <div className="kk-lib-grid">
        {rows.map((e) => (
          <LibCard
            key={e.id}
            entry={e}
            isGM={isGM}
            onEdit={() => setEditing(e)}
            onDelete={() => onDelete(e.id)}
          />
        ))}
      </div>

      {editing && (
        <LibEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => { onUpdate(editing.id, patch); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ── Read-only card (both players and GM) ─────────────────────
function LibCard({ entry, isGM, onEdit, onDelete }) {
  return (
    <div className={`kk-lib-card ${isGM && entry.visibleToPlayers ? "kk-lib-visible" : ""}`}>
      <div className="kk-lib-head">
        {entry.img
          ? <img className="kk-lib-thumb" src={entry.img} alt="" />
          : entry.kind === "faculty" && entry.color
            ? <span className="kk-lib-swatch" style={{ background: entry.color }} />
            : null}
        <span className="kk-lib-name">{entry.name}</span>
        {isGM && entry.visibleToPlayers && <span className="kk-lib-badge" title="Видно игрокам">👁</span>}
      </div>

      <ReadBody entry={entry} isGM={isGM} />

      {isGM && (
        <div className="kk-lib-cardactions">
          <button className="kk-btn ghost xs" onClick={onEdit}>Изменить</button>
          <button className="kk-btn danger xs" onClick={onDelete}>Удалить</button>
        </div>
      )}
    </div>
  );
}

// ── Read-only body, kind-aware ───────────────────────────────
function ReadBody({ entry, isGM }) {
  const k = entry.kind;
  return (
    <div className="kk-lib-read">
      {entry.description && <p className="kk-lib-desc" dangerouslySetInnerHTML={{ __html: entry.description }} />}

      {(k === "npc-light" || k === "npc-hard" || k === "npc-boss" || k === "curator") && (
        <NpcRead entry={entry} isGM={isGM} />
      )}
      {k === "faculty" && <FacultyRead entry={entry} />}
      {k === "companion" && <CompanionRead entry={entry} />}
      {k === "daemon" && <DaemonRead entry={entry} isGM={isGM} />}
    </div>
  );
}

const ATTR_KEYS = [["agility", "Лов"], ["smarts", "Ум"], ["spirit", "Дух"], ["endurance", "Вын"], ["magic", "Маг"]];
const DIES = [4, 6, 8, 10, 12];

function ReadRow({ label, value }) {
  if (value == null || value === "") return null;
  return <div className="kk-lib-sub"><b>{label}:</b> {value}</div>;
}

function AttrsRead({ attributes }) {
  const a = attributes || {};
  const has = ATTR_KEYS.some(([kk]) => a[kk]?.die);
  if (!has) return null;
  return (
    <div className="kk-lib-attrs kk-lib-attrs-read">
      {ATTR_KEYS.map(([kk, lbl]) => {
        const at = a[kk] || {};
        const mod = Number(at.modifier) || 0;
        return (
          <span key={kk} className="kk-lib-attr-read">
            <span className="kk-lib-attr-lbl">{lbl}</span>
            <span className="kk-lib-attr-val">d{at.die || 4}{mod ? (mod > 0 ? `+${mod}` : mod) : ""}</span>
          </span>
        );
      })}
    </div>
  );
}

function NpcRead({ entry, isGM }) {
  const meta = [entry.race, entry.age && `${entry.age} лет`, entry.gender].filter(Boolean).join(" · ");
  const abilities = Array.isArray(entry.abilities) ? entry.abilities : [];
  return (
    <>
      <ReadRow label="Роль" value={entry.role} />
      {meta && <div className="kk-lib-sub">{meta}</div>}
      {entry.kind === "curator" && entry.facultyName && (
        <ReadRow label="Факультет" value={entry.facultyName} />
      )}
      <AttrsRead attributes={entry.attributes} />
      <div className="kk-lib-statline">
        {entry.toughness != null && <span>Стойкость <b>{entry.toughness}</b></span>}
        {entry.energy && <span>Энергия <b>{entry.energy.value ?? 0}/{entry.energy.max ?? 0}</b></span>}
      </div>
      {abilities.length > 0 && (
        <div className="kk-lib-sub">
          <b>Навыки:</b>{" "}
          {abilities.map((s, i) => {
            const mod = Number(s.modifier) || 0;
            return (
              <span key={i} className="kk-lib-chip">
                {s.name} d{s.die || 4}{mod ? (mod > 0 ? `+${mod}` : mod) : ""}
              </span>
            );
          })}
        </div>
      )}
      {Array.isArray(entry.weapons) && entry.weapons.length > 0 && (
        <ReadRow label="Оружие" value={entry.weapons.join(", ")} />
      )}
      {Array.isArray(entry.gear) && entry.gear.length > 0 && (
        <ReadRow label="Снаряжение" value={entry.gear.join(", ")} />
      )}
      {isGM && entry.notes && <ReadRow label="Заметки" value={entry.notes} />}
    </>
  );
}

function FacultyRead({ entry }) {
  const founded = [
    entry.date_founded && `основан ${entry.date_founded}`,
    entry.date_reformed && `реформирован ${entry.date_reformed}`,
  ].filter(Boolean).join(", ");
  const abilities = Array.isArray(entry.abilities) ? entry.abilities : [];
  return (
    <>
      <div className="kk-lib-sub">
        {entry.key && <span className="kk-lib-chip">{entry.key}</span>}
        {entry.curatorKey && <span className="kk-lib-chip">куратор: {entry.curatorKey}</span>}
        {entry.active === false && <span className="kk-lib-chip kk-lib-chip-off">расформирован</span>}
      </div>
      {founded && <div className="kk-lib-sub">{founded}</div>}
      {entry.dormitory && <ReadHtml label="Общежитие" html={entry.dormitory} />}
      {entry.traits_fit && <ReadHtml label="Подходит" html={entry.traits_fit} />}
      {entry.traits_unfit && <ReadHtml label="Не подходит" html={entry.traits_unfit} />}
      {entry.special_rules && <ReadHtml label="Особые правила" html={entry.special_rules} />}
      {abilities.length > 0 && (
        <div className="kk-lib-sub">
          <b>Навыки:</b> {abilities.map((s, i) => <span key={i} className="kk-lib-chip">{s}</span>)}
        </div>
      )}
    </>
  );
}

function CompanionRead({ entry }) {
  return (
    <>
      <ReadRow label="Вид" value={entry.species} />
      <div className="kk-lib-statline">
        {entry.age != null && <span>Возраст <b>{entry.age}</b></span>}
        {entry.bond != null && <span>Связь <b>{entry.bond}</b></span>}
        {entry.condition && <span>{condLabel(entry.condition)}</span>}
      </div>
      <AttrsRead attributes={entry.attributes} />
    </>
  );
}

function DaemonRead({ entry, isGM }) {
  return (
    <>
      {isGM
        ? <ReadRow label="Истинное имя" value={entry.true_name} />
        : entry.true_name && <div className="kk-lib-sub">Истинное имя скрыто</div>}
      <div className="kk-lib-sub">
        {entry.corporation && <span className="kk-lib-chip">{optLabel(DAEMON_CORPORATIONS, entry.corporation)}</span>}
        {entry.daemon_class && <span className="kk-lib-chip">класс {entry.daemon_class}</span>}
        {entry.suit && <span className="kk-lib-chip">{optLabel(DAEMON_SUITS, entry.suit)}</span>}
        {entry.color && <span className="kk-lib-chip">{optLabel(DAEMON_COLORS, entry.color)}</span>}
      </div>
      {entry.major_arcana && <ReadRow label="Аркан" value={entry.major_arcana} />}
      {entry.appearance && <ReadRow label="Внешность" value={entry.appearance} />}
      {isGM && (
        <>
          <ReadRow label="Мечта" value={entry.dream} />
          <ReadRow label="Страх" value={entry.fear} />
          <ReadRow label="Желание" value={entry.desire} />
        </>
      )}
      <AttrsRead attributes={entry.attributes} />
    </>
  );
}

function ReadHtml({ label, html }) {
  return (
    <div className="kk-lib-htmlblock">
      <div className="kk-lib-htmllabel">{label}</div>
      <div className="kk-lib-htmlbody" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

const optLabel = (opts, v) => (opts.find(([val]) => val === v)?.[1] ?? v);
const condLabel = (v) => optLabel(CONDITIONS, v);

// ════════════════════════════════════════════════════════════
// Edit modal (GM only) — full field set per kind
// ════════════════════════════════════════════════════════════
function LibEditModal({ entry, onClose, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...entry }));
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const save = () => {
    const patch = { ...draft };
    delete patch.id;
    delete patch.createdAt;
    onSave(patch);
  };

  return (
    <div className="kk-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kk-modal kk-lib-modal">
        <div className="kk-modal-head">
          <div className="kk-modal-title">{LIBRARY_KIND_LABEL[entry.kind]} — правка</div>
          <button className="kk-modal-x kk-btn ghost xs" onClick={onClose}>✕</button>
        </div>

        <div className="kk-modal-body">
          <TextField label="Имя" value={draft.name} onChange={(v) => set("name", v)} />
          <TextField label="Картинка (URL)" value={draft.img} onChange={(v) => set("img", v)} />
          <TextAreaField label="Описание (HTML)" value={draft.description} onChange={(v) => set("description", v)} />

          <KindFields draft={draft} set={set} />

          <BoolField label="Видно игрокам" value={draft.visibleToPlayers} onChange={(v) => set("visibleToPlayers", v)} />
        </div>

        <div className="kk-modal-foot">
          <button className="kk-btn ghost sm" onClick={onClose}>Отмена</button>
          <button className="kk-btn sm" onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

function KindFields({ draft, set }) {
  const k = draft.kind;
  if (k === "daemon") return <DaemonFields draft={draft} set={set} />;
  if (k === "companion") return <CompanionFields draft={draft} set={set} />;
  if (k === "faculty") return <FacultyFields draft={draft} set={set} />;
  // npc-light / npc-hard / npc-boss / curator
  return <NpcFields draft={draft} set={set} isCurator={k === "curator"} />;
}

function NpcFields({ draft, set, isCurator }) {
  return (
    <>
      {isCurator && (
        <div className="kk-lib-row2">
          <TextField label="Ключ факультета" value={draft.facultyKey} onChange={(v) => set("facultyKey", v)} />
          <TextField label="Факультет" value={draft.facultyName} onChange={(v) => set("facultyName", v)} />
        </div>
      )}
      <TextField label="Роль" value={draft.role} onChange={(v) => set("role", v)} />
      <div className="kk-lib-row3">
        <TextField label="Раса" value={draft.race} onChange={(v) => set("race", v)} />
        <TextField label="Возраст" value={draft.age} onChange={(v) => set("age", v)} />
        <TextField label="Пол" value={draft.gender} onChange={(v) => set("gender", v)} />
      </div>
      <AttrsEditor attributes={draft.attributes} onChange={(a) => set("attributes", a)} />
      <div className="kk-lib-row3">
        <NumberField label="Стойкость" value={draft.toughness} onChange={(v) => set("toughness", v)} />
        <NumberField label="Энергия" value={draft.energy?.value} onChange={(v) => set("energy", { ...(draft.energy || {}), value: v })} />
        <NumberField label="Энергия макс" value={draft.energy?.max} onChange={(v) => set("energy", { ...(draft.energy || {}), max: v })} />
      </div>
      <AbilityListEditor
        label="Навыки статблока"
        value={draft.abilities}
        onChange={(v) => set("abilities", v)}
      />
      <StringListEditor label="Оружие" value={draft.weapons} onChange={(v) => set("weapons", v)} placeholder="Название оружия" />
      <StringListEditor label="Снаряжение" value={draft.gear} onChange={(v) => set("gear", v)} placeholder="Название снаряжения" />
      <TextAreaField label="Заметки" value={draft.notes} onChange={(v) => set("notes", v)} />
    </>
  );
}

function FacultyFields({ draft, set }) {
  return (
    <>
      <div className="kk-lib-row3">
        <TextField label="Ключ" value={draft.key} onChange={(v) => set("key", v)} />
        <ColorField label="Цвет" value={draft.color} onChange={(v) => set("color", v)} />
        <TextField label="Ключ куратора" value={draft.curatorKey} onChange={(v) => set("curatorKey", v)} />
      </div>
      <div className="kk-lib-row3">
        <TextField label="Основан" value={draft.date_founded} onChange={(v) => set("date_founded", v)} />
        <TextField label="Реформирован" value={draft.date_reformed} onChange={(v) => set("date_reformed", v)} />
        <BoolField label="Действует" value={draft.active} onChange={(v) => set("active", v)} />
      </div>
      <TextAreaField label="Общежитие (HTML)" value={draft.dormitory} onChange={(v) => set("dormitory", v)} />
      <TextAreaField label="Подходит (HTML)" value={draft.traits_fit} onChange={(v) => set("traits_fit", v)} />
      <TextAreaField label="Не подходит (HTML)" value={draft.traits_unfit} onChange={(v) => set("traits_unfit", v)} />
      <TextAreaField label="Особые правила (HTML)" value={draft.special_rules} onChange={(v) => set("special_rules", v)} />
      <StringListEditor label="Навыки факультета" value={draft.abilities} onChange={(v) => set("abilities", v)} placeholder="Название навыка" />
    </>
  );
}

function CompanionFields({ draft, set }) {
  return (
    <>
      <div className="kk-lib-row3">
        <TextField label="Вид" value={draft.species} onChange={(v) => set("species", v)} />
        <NumberField label="Возраст" value={draft.age} onChange={(v) => set("age", v)} />
        <NumberField label="Связь (bond)" value={draft.bond} onChange={(v) => set("bond", v)} />
      </div>
      <SelectField label="Состояние" value={draft.condition} opts={CONDITIONS} onChange={(v) => set("condition", v)} />
      <AttrsEditor attributes={draft.attributes} onChange={(a) => set("attributes", a)} />
    </>
  );
}

function DaemonFields({ draft, set }) {
  return (
    <>
      <TextField label="Истинное имя" value={draft.true_name} onChange={(v) => set("true_name", v)} />
      <div className="kk-lib-row2">
        <SelectField label="Корпорация" value={draft.corporation} opts={DAEMON_CORPORATIONS} onChange={(v) => set("corporation", v)} />
        <TextField label="Класс" value={draft.daemon_class} onChange={(v) => set("daemon_class", v)} />
      </div>
      <div className="kk-lib-row3">
        <SelectField label="Старший аркан" value={draft.major_arcana} opts={MAJOR_ARCANA.map((a) => [a, a])} onChange={(v) => set("major_arcana", v)} />
        <SelectField label="Масть" value={draft.suit} opts={DAEMON_SUITS} onChange={(v) => set("suit", v)} />
        <SelectField label="Цвет" value={draft.color} opts={DAEMON_COLORS} onChange={(v) => set("color", v)} />
      </div>
      <BoolField label="Режим: шарик" value={draft.is_orb} onChange={(v) => set("is_orb", v)} />
      <TextAreaField label="Внешность" value={draft.appearance} onChange={(v) => set("appearance", v)} />
      <div className="kk-lib-row3">
        <TextField label="Мечта" value={draft.dream} onChange={(v) => set("dream", v)} />
        <TextField label="Страх" value={draft.fear} onChange={(v) => set("fear", v)} />
        <TextField label="Желание" value={draft.desire} onChange={(v) => set("desire", v)} />
      </div>
      <SelectField label="Состояние" value={draft.condition} opts={CONDITIONS} onChange={(v) => set("condition", v)} />
      <AttrsEditor attributes={draft.attributes} onChange={(a) => set("attributes", a)} />
    </>
  );
}

// ── Controlled field primitives ──────────────────────────────
function TextField({ label, value, onChange }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function TextAreaField({ label, value, onChange }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function NumberField({ label, value, onChange }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      <input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}
function ColorField({ label, value, onChange }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      <input type="color" value={value || "#888888"} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function SelectField({ label, value, opts, onChange }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function BoolField({ label, value, onChange }) {
  return (
    <label className="kk-lib-field kk-lib-field--bool">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function AttrsEditor({ attributes, onChange }) {
  const a = attributes || {};
  const setAttr = (k, patch) =>
    onChange({ ...a, [k]: { die: a[k]?.die ?? 6, modifier: a[k]?.modifier ?? 0, ...patch } });
  return (
    <div className="kk-lib-field">
      <span>Характеристики</span>
      <div className="kk-lib-attrs">
        {ATTR_KEYS.map(([k, lbl]) => (
          <div key={k} className="kk-lib-attr">
            <span>{lbl}</span>
            <select value={a[k]?.die ?? 6} onChange={(e) => setAttr(k, { die: Number(e.target.value) || 4 })}>
              {DIES.map((d) => <option key={d} value={d}>d{d}</option>)}
            </select>
            <input
              type="number" className="kk-lib-attr-mod" title="модификатор"
              value={a[k]?.modifier ?? 0}
              onChange={(e) => setAttr(k, { modifier: Number(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Rows of { name, die, modifier } — NPC statblock skills.
function AbilityListEditor({ label, value, onChange }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  const add = () => onChange([...rows, { name: "", die: 6, modifier: 0 }]);
  return (
    <div className="kk-lib-field">
      <span>{label}</span>
      <div className="kk-lib-list">
        {rows.map((r, i) => (
          <div key={i} className="kk-lib-list-row kk-lib-ability-row">
            <input className="kk-lib-ability-name" placeholder="Навык" value={r.name ?? ""} onChange={(e) => update(i, { name: e.target.value })} />
            <select value={r.die ?? 6} onChange={(e) => update(i, { die: Number(e.target.value) || 4 })}>
              {DIES.map((d) => <option key={d} value={d}>d{d}</option>)}
            </select>
            <input type="number" className="kk-lib-attr-mod" title="модификатор" value={r.modifier ?? 0} onChange={(e) => update(i, { modifier: Number(e.target.value) || 0 })} />
            <button className="kk-btn ghost xs" onClick={() => remove(i)}>✕</button>
          </div>
        ))}
      </div>
      <button className="kk-btn ghost xs kk-lib-add" onClick={add}>+ Добавить</button>
    </div>
  );
}

// Rows of plain strings — weapons, gear, faculty skills.
function StringListEditor({ label, value, onChange, placeholder }) {
  const rows = Array.isArray(value) ? value : [];
  const update = (i, v) => onChange(rows.map((r, j) => (j === i ? v : r)));
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  const add = () => onChange([...rows, ""]);
  return (
    <div className="kk-lib-field">
      <span>{label}</span>
      <div className="kk-lib-list">
        {rows.map((r, i) => (
          <div key={i} className="kk-lib-list-row">
            <input value={r ?? ""} placeholder={placeholder} onChange={(e) => update(i, e.target.value)} />
            <button className="kk-btn ghost xs" onClick={() => remove(i)}>✕</button>
          </div>
        ))}
      </div>
      <button className="kk-btn ghost xs kk-lib-add" onClick={add}>+ Добавить</button>
    </div>
  );
}
