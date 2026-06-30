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
// Props:
//   entries[], isGM
//   onCreate(kind), onUpdate(id, patch), onDelete(id), onSeed(kind) | null
//   seedable — Set of kinds that have a catalog to seed from
export default function LibraryView({ entries = [], isGM, onCreate, onUpdate, onDelete, onSeed, seedable }) {
  const [tab, setTab] = useState(LIBRARY_KINDS[0].kind);
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
          <LibCard key={e.id} entry={e} isGM={isGM} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function LibCard({ entry, isGM, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const save = (patch) => onUpdate(entry.id, patch);

  if (!isGM) {
    return (
      <div className="kk-lib-card">
        <div className="kk-lib-head">
          {entry.img && <img className="kk-lib-thumb" src={entry.img} alt="" />}
          <span className="kk-lib-name">{entry.name}</span>
        </div>
        <ReadFields entry={entry} />
      </div>
    );
  }

  return (
    <div className={`kk-lib-card kk-lib-edit ${entry.visibleToPlayers ? "kk-lib-visible" : ""}`}>
      <div className="kk-lib-head">
        {entry.img && <img className="kk-lib-thumb" src={entry.img} alt="" />}
        <input className="kk-input kk-lib-name-input" defaultValue={entry.name}
          onBlur={(e) => e.target.value !== entry.name && save({ name: e.target.value })} />
        <button className="kk-btn ghost xs" onClick={() => setOpen((o) => !o)}>{open ? "▾" : "▸"}</button>
      </div>

      <label className="kk-lib-vis">
        <input type="checkbox" checked={!!entry.visibleToPlayers}
          onChange={(e) => save({ visibleToPlayers: e.target.checked })} />
        Видно игрокам
      </label>

      {open && (
        <div className="kk-lib-body">
          <Field label="Картинка (URL)" value={entry.img} onSave={(v) => save({ img: v })} />
          <Field label="Описание" value={entry.description} onSave={(v) => save({ description: v })} textarea />
          <KindFields entry={entry} save={save} />
          <button className="kk-btn danger xs kk-lib-del" onClick={() => onDelete(entry.id)}>Удалить</button>
        </div>
      )}
    </div>
  );
}

// Read-only summary for players, kind-aware.
function ReadFields({ entry }) {
  return (
    <>
      {entry.description && <p className="kk-lib-desc" dangerouslySetInnerHTML={{ __html: entry.description }} />}
      {entry.kind === "faculty" && entry.special_rules && (
        <div className="kk-lib-sub" dangerouslySetInnerHTML={{ __html: entry.special_rules }} />
      )}
      {entry.kind === "companion" && entry.species && <div className="kk-lib-sub">Вид: {entry.species}</div>}
      {entry.kind === "daemon" && entry.true_name && <div className="kk-lib-sub">Истинное имя скрыто</div>}
    </>
  );
}

// ── Kind-specific editor fields (GM) ─────────────────────────
function KindFields({ entry, save }) {
  if (entry.kind === "daemon") return <DaemonFields entry={entry} save={save} />;
  if (entry.kind === "companion") return (
    <>
      <Field label="Вид" value={entry.species} onSave={(v) => save({ species: v })} />
      <NumField label="Возраст" value={entry.age} onSave={(v) => save({ age: v })} />
      <NumField label="Связь (bond)" value={entry.bond} onSave={(v) => save({ bond: v })} />
      <SelectField label="Состояние" value={entry.condition} opts={CONDITIONS} onSave={(v) => save({ condition: v })} />
      <Attrs attributes={entry.attributes} onSave={(a) => save({ attributes: a })} />
    </>
  );
  if (entry.kind === "curator") return (
    <>
      <Field label="Ключ факультета" value={entry.facultyKey} onSave={(v) => save({ facultyKey: v })} />
      <Field label="Факультет" value={entry.facultyName} onSave={(v) => save({ facultyName: v })} />
    </>
  );
  if (entry.kind === "faculty") return (
    <>
      <Field label="Ключ" value={entry.key} onSave={(v) => save({ key: v })} />
      <Field label="Цвет" value={entry.color} onSave={(v) => save({ color: v })} />
      <Field label="Основан" value={entry.date_founded} onSave={(v) => save({ date_founded: v })} />
      <Field label="Общежитие" value={entry.dormitory} onSave={(v) => save({ dormitory: v })} textarea />
      <Field label="Особые правила (HTML)" value={entry.special_rules} onSave={(v) => save({ special_rules: v })} textarea />
    </>
  );
  // npc-light / npc-hard / npc-boss
  return (
    <>
      <Attrs attributes={entry.attributes} onSave={(a) => save({ attributes: a })} />
      <Field label="Заметки" value={entry.notes} onSave={(v) => save({ notes: v })} textarea />
    </>
  );
}

function DaemonFields({ entry, save }) {
  return (
    <div className="kk-daemon-fields">
      <Field label="Истинное имя" value={entry.true_name} onSave={(v) => save({ true_name: v })} />
      <SelectField label="Корпорация" value={entry.corporation} opts={DAEMON_CORPORATIONS} onSave={(v) => save({ corporation: v })} />
      <Field label="Класс" value={entry.daemon_class} onSave={(v) => save({ daemon_class: v })} />
      <SelectField label="Старший аркан" value={entry.major_arcana} opts={MAJOR_ARCANA.map((a) => [a, a])} onSave={(v) => save({ major_arcana: v })} />
      <SelectField label="Масть" value={entry.suit} opts={DAEMON_SUITS} onSave={(v) => save({ suit: v })} />
      <SelectField label="Цвет" value={entry.color} opts={DAEMON_COLORS} onSave={(v) => save({ color: v })} />
      <BoolField label="Режим: шарик" value={entry.is_orb} onSave={(v) => save({ is_orb: v })} />
      <Field label="Внешность" value={entry.appearance} onSave={(v) => save({ appearance: v })} textarea />
      <Field label="Мечта" value={entry.dream} onSave={(v) => save({ dream: v })} />
      <Field label="Страх" value={entry.fear} onSave={(v) => save({ fear: v })} />
      <Field label="Желание" value={entry.desire} onSave={(v) => save({ desire: v })} />
      <SelectField label="Состояние" value={entry.condition} opts={CONDITIONS} onSave={(v) => save({ condition: v })} />
      <Attrs attributes={entry.attributes} onSave={(a) => save({ attributes: a })} />
    </div>
  );
}

// ── Tiny controlled-by-blur field primitives ────────────────
function Field({ label, value, onSave, textarea }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      {textarea
        ? <textarea defaultValue={value || ""} onBlur={(e) => e.target.value !== (value || "") && onSave(e.target.value)} />
        : <input defaultValue={value || ""} onBlur={(e) => e.target.value !== (value || "") && onSave(e.target.value)} />}
    </label>
  );
}
function NumField({ label, value, onSave }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      <input type="number" defaultValue={value ?? 0} onBlur={(e) => onSave(Number(e.target.value) || 0)} />
    </label>
  );
}
function SelectField({ label, value, opts, onSave }) {
  return (
    <label className="kk-lib-field">
      <span>{label}</span>
      <select value={value || ""} onChange={(e) => onSave(e.target.value)}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
function BoolField({ label, value, onSave }) {
  return (
    <label className="kk-lib-field kk-lib-field--bool">
      <input type="checkbox" checked={!!value} onChange={(e) => onSave(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

const ATTR_KEYS = [["agility", "Лов"], ["smarts", "Ум"], ["spirit", "Дух"], ["endurance", "Вын"], ["magic", "Маг"]];
function Attrs({ attributes, onSave }) {
  const a = attributes || {};
  const setDie = (k, die) => onSave({ ...a, [k]: { ...(a[k] || {}), die: Number(die) || 4, modifier: a[k]?.modifier ?? 0 } });
  return (
    <div className="kk-lib-attrs">
      {ATTR_KEYS.map(([k, lbl]) => (
        <label key={k} className="kk-lib-attr">
          <span>{lbl}</span>
          <select value={a[k]?.die ?? 6} onChange={(e) => setDie(k, e.target.value)}>
            {[4, 6, 8, 10, 12].map((d) => <option key={d} value={d}>d{d}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}
