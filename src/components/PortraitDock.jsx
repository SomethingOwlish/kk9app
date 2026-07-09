import { useState } from "react";
import { ZONES, ZONE_LABELS, EFFECTS } from "../lib/portrait";
import { PORTRAIT_DEFAULTS } from "../lib/db";

// FEAT-19 — GM-only portrait dock. Side panel; per party member: zone, portrait
// image URL, height, intensity override, active emotion, and a per-character
// emotion editor (name + image + motion/filter effects). Every change writes the
// full portraitConfig immediately (no debounce — portrait updates feel instant).
// Hidden from players/demo (App mounts it only for GM).
//
// Props:
//   characters[] — party character docs
//   npcs[]       — NPC actor docs (DEC-01); assignable to the same portrait zones
//   onUpdate(charId, config) — persists portraitConfig (updatePortraitConfig)
const INTENSITY_OPTS = [
  ["", "авто"], ["0", "выкл"], ["0.5", "тише"], ["1.6", "громче"],
];

function uid() {
  try { return crypto.randomUUID().slice(0, 12); } catch { return "e" + Math.random().toString(36).slice(2, 12); }
}

export default function PortraitDock({ characters = [], npcs = [], onUpdate }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  if (!characters.length && !npcs.length) return null;

  const rowFor = (ch) => (
    <DockRow
      key={ch.id}
      ch={ch}
      onUpdate={onUpdate}
      expanded={!!collapsed[ch.id]}
      onToggle={() => setCollapsed((c) => ({ ...c, [ch.id]: !c[ch.id] }))}
    />
  );

  return (
    <>
      <button
        className={`kk9-dock-toggle ${open ? "on" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="Док портретов (ГМ)"
      >🎭</button>

      {open && (
        <aside className="kk9-dock">
          <div className="kk9-dock__title">Портреты <button className="kk9-dock__x" onClick={() => setOpen(false)}>✕</button></div>
          <div className="kk9-dock__body">
            {characters.length > 0 && <div className="kk9-dock__section">Персонажи</div>}
            {characters.map(rowFor)}
            {npcs.length > 0 && <div className="kk9-dock__section">НПЦ</div>}
            {npcs.map(rowFor)}
          </div>
        </aside>
      )}
    </>
  );
}

function DockRow({ ch, onUpdate, expanded, onToggle }) {
  const cfg = { ...PORTRAIT_DEFAULTS, ...(ch.portraitConfig || {}) };
  const set = (patch) => onUpdate(ch.id, { ...cfg, ...patch });
  const emotions = cfg.emotions || [];

  const setEmotion = (id, patch) =>
    set({ emotions: emotions.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const toggleFx = (id, fx) => {
    const e = emotions.find((x) => x.id === id);
    const has = (e?.effects || []).includes(fx);
    setEmotion(id, { effects: has ? e.effects.filter((f) => f !== fx) : [...(e.effects || []), fx] });
  };
  const addEmotion = () => set({ emotions: [...emotions, { id: uid(), name: "Эмоция", image: "", effects: [] }] });
  const delEmotion = (id) =>
    set({ emotions: emotions.filter((e) => e.id !== id), activeEmotion: cfg.activeEmotion === id ? "" : cfg.activeEmotion });

  return (
    <div className={`kk9-dockrow ${cfg.zone ? "kk9-dockrow--shown" : ""}`}>
      <div className="kk9-dockrow__head" onClick={onToggle}>
        <span className="kk9-dockrow__name">{ch.name}</span>
        <span className="kk9-dockrow__zone">{cfg.zone ? ZONE_LABELS[cfg.zone] : "—"}</span>
        <span className="kk9-dockrow__caret">{expanded ? "▾" : "▸"}</span>
      </div>

      {expanded && (
        <div className="kk9-dockrow__body">
          <label className="kk9-dock__field">
            <span>Зона</span>
            <select value={cfg.zone} onChange={(e) => set({ zone: e.target.value })}>
              <option value="">не показывать</option>
              {ZONES.map((z) => <option key={z} value={z}>{ZONE_LABELS[z]}</option>)}
            </select>
          </label>

          <label className="kk9-dock__field">
            <span>Картинка (URL)</span>
            <input type="url" value={cfg.portraitImage} placeholder="https://…"
              onChange={(e) => set({ portraitImage: e.target.value })} />
          </label>

          <label className="kk9-dock__field">
            <span>Рост, см</span>
            <input type="number" min="0" step="1" value={cfg.portraitHeight || ""}
              onChange={(e) => set({ portraitHeight: Number(e.target.value) || 0 })} />
          </label>

          <label className="kk9-dock__field">
            <span>Реакция</span>
            <select value={cfg.intensityOverride} onChange={(e) => set({ intensityOverride: e.target.value })}>
              {INTENSITY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>

          <label className="kk9-dock__field">
            <span>Эмоция</span>
            <select value={cfg.activeEmotion} onChange={(e) => set({ activeEmotion: e.target.value })}>
              <option value="">нейтраль</option>
              {emotions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>

          <div className="kk9-dock__emos">
            <div className="kk9-dock__emos-head">
              <span>Эмоции</span>
              <button className="kk-btn ghost xs" onClick={addEmotion}>+ эмоция</button>
            </div>
            {emotions.map((e) => (
              <div key={e.id} className="kk9-dock__emo">
                <input className="kk9-dock__emo-name" value={e.name}
                  onChange={(ev) => setEmotion(e.id, { name: ev.target.value })} />
                <input className="kk9-dock__emo-img" type="url" value={e.image} placeholder="URL картинки"
                  onChange={(ev) => setEmotion(e.id, { image: ev.target.value })} />
                <div className="kk9-dock__fx">
                  {EFFECTS.map((f) => (
                    <button key={f.id} type="button" title={f.kind}
                      className={`kk9-dock__fxchip ${(e.effects || []).includes(f.id) ? "on" : ""}`}
                      onClick={() => toggleFx(e.id, f.id)}>{f.label}</button>
                  ))}
                </div>
                <button className="kk9-dock__emo-del" title="Удалить" onClick={() => delEmotion(e.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
