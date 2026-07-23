import { useState, useRef } from "react";
import InlineMarkdown from "./InlineMarkdown";
import Stat from "./Stat";
import StatusEditor from "./StatusEditor";
import StatusCard from "./StatusCard";
import ItemList from "./ItemList";
import CompanionRefs from "./CompanionRefs";
import DaemonRefs from "./DaemonRefs";
import ContactsList from "./ContactsList";
import RelationEditor from "./RelationEditor";
import RollDialog from "./RollDialog";
import DiceIcon from "./DiceIcon";
import { deriveToughnessFormula, deriveSoakBase, deriveEnergyMax } from "../lib/derive";
import { applyStatus, removeStatus, removeLanguageFromChar, addFeatureToChar, removeFeatureFromChar } from "../lib/db";
import { buildItemRollTarget } from "../lib/items";
import { deactivateSpellEntry } from "../lib/activeSpells";
import { resizePortrait, validatePortraitFile } from "../lib/storage";
import { loadPrefs, savePref } from "../lib/userPrefs";
import { RELATION_TAG_LABELS, getRelationLabel } from "../lib/relations";
import {
  ATTR_ORDER, ATTR_LABEL, ATTR_SHORT, dieStr,
  resolveMagicTalents, MAGIC_TALENT_MIN, MAGIC_TALENT_MAX,
} from "../lib/constants";

const DEMO_FIELDS = [
  ["birthplace", "Место рождения"],
  ["dormitory", "Общежитие"],
  ["height", "Рост"],
  ["build", "Телосложение"],
  ["allergies", "Аллергии"],
  ["weaknesses", "Слабости"],
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Faculty accent must stay visible on both dark and light themes. Near-black
// (Чёрный) or near-white (Белый) faculty colours would paint fills invisibly
// against the card, so clamp the colour's lightness into a mid band while
// keeping its hue/saturation.
function hexToRgb(hex) {
  let h = String(hex).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}
function hslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return "#" + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}
function safeAccent(hex) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    return hslToHex(h, s, clamp(l, 0.44, 0.6));
  } catch { return hex; }
}

// ── Пипы здоровья (формула = derive._attrPipSizes) ──────────────────
function attrPipSizes(die) {
  switch (die) {
    case 20: return [2, 2, 2, 2, 1];
    case 12: return [1, 2, 2, 2, 1];
    case 10: return [1, 1, 2, 2, 1];
    case 8:  return [1, 1, 1, 2, 1];
    default: return [1, 1, 1, 1, 1];
  }
}
function computeHealthPips(die) {
  const sizes = attrPipSizes(die).map((s, i) => (i === 4 ? 1 : s));
  const thresholds = [0];
  for (let i = 0; i < 4; i++) thresholds.push(thresholds[i] + sizes[i]);
  return { sizes, thresholds, max: sizes.reduce((a, b) => a + b, 0) };
}

function HealthPips({ die, value, onSet }) {
  const { sizes, thresholds } = computeHealthPips(die);
  return (
    <div className="hp">
      {sizes.map((size, i) => {
        const lo = thresholds[i];
        const filled = Math.max(0, Math.min(size, value - lo));
        const ko = i === 4;
        return (
          <div className={`pip${ko ? " ko" : ""}`} key={i}>
            {Array.from({ length: size }).map((_, k) => {
              const abs = lo + k + 1;
              return (
                <button
                  key={k}
                  className={`seg${k < filled ? " filled" : ""}`}
                  onClick={() => onSet(value === abs ? abs - 1 : abs)}
                  aria-label={`Пип ${i + 1}`}
                />
              );
            })}
            <span className="num">{i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

function RollBtn({ title, onClick, cls = "roll" }) {
  return (
    <button className={cls} title={title} onClick={onClick}><DiceIcon /></button>
  );
}

export default function CharacterCard({ ch, save, isGM, user, canAdv, onEdit, onEditBio, onAdvance, onLog, campaignId, campaignStatuses = [], items = [], onDeleteItem, onUpdateItem, peers = [], onSaveRelations, orgs = [], campaign, canRoll = false, onCommitRoll, onLinkOrg, onUnlinkOrg, onSetOrgLevel, daemonLib = [], onLinkDaemon, onUnlinkDaemon, roster = [], onAttack }) {
  // ── derived ────────────────────────────────────────────────────────
  const toughnessFormula = deriveToughnessFormula(ch);
  const energyMaxRaw = ch.energy?.max ?? deriveEnergyMax(ch);
  const tension = ch.tension || { current: 0, overcap: 0, energyPenalty: 0, max: 0 };
  const energyMax = Math.max(0, energyMaxRaw - (tension.energyPenalty ?? 0));
  const overflow = ch.overflow_damage ?? 0;
  const initStr = `d${ch.attributes.agility.die} · d${ch.attributes.smarts.die} · d6`;
  const fac = ch.faculty || {};
  const facColor = safeAccent(fac.color || "#c8a14e");

  // Skills: two groups — факультетские (categ magic) + прочие.
  const skills = ch.skills || [];
  const facSkills = skills.filter((s) => s.categ === "magic");
  const otherSkills = skills.filter((s) => s.categ !== "magic");
  const facName = fac.name || "Факультетские";

  const talents = resolveMagicTalents(ch.magicTalents);

  const activeStatuses = Array.isArray(ch.activeStatuses) ? ch.activeStatuses : [];
  const companions = Array.isArray(ch.companions) ? ch.companions : [];
  const relations = Array.isArray(ch.relations) ? ch.relations : [];
  const contacts = Array.isArray(ch.refs?.contacts) ? ch.refs.contacts : [];
  const languages = Array.isArray(ch.languages) ? ch.languages : [];
  const features = Array.isArray(ch.features) ? ch.features : [];
  const notes = Array.isArray(ch.notes) ? ch.notes : [];
  const demoFields = DEMO_FIELDS.filter(([k]) => ch[k]);

  const isOwner = !!(user && ch.ownerUid && user.uid === ch.ownerUid);
  const canEditBio = isOwner || isGM;
  const canEditRelations = isOwner || isGM;
  const canAddNote = isOwner || isGM;
  const canChangePortrait = isOwner || isGM;

  // ── local state ────────────────────────────────────────────────────
  const [tab, setTab] = useState("overview");
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [rollTarget, setRollTarget] = useState(null);
  const [relEditing, setRelEditing] = useState(null); // relation | "new" | null
  const [openRels, setOpenRels] = useState(() => new Set());
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [rollerOn, setRollerOn] = useState(() => loadPrefs(user?.uid).rollerOn ?? true);
  const [density, setDensity] = useState(() => loadPrefs(user?.uid).ccDensity ?? "spacious");
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [portraitError, setPortraitError] = useState("");
  const portraitRef = useRef(null);

  const showRoll = canRoll && rollerOn;

  function toggleRoller() {
    const next = !rollerOn;
    setRollerOn(next);
    if (user?.uid) savePref(user.uid, "rollerOn", next);
  }
  function toggleDensity() {
    const next = density === "compact" ? "spacious" : "compact";
    setDensity(next);
    if (user?.uid) savePref(user.uid, "ccDensity", next);
  }

  // ── actions ────────────────────────────────────────────────────────
  const rollItem = (item) => setRollTarget(buildItemRollTarget(item, ch));
  const deactivateSpell = (item) => {
    const patch = { activeSpells: deactivateSpellEntry(ch.activeSpells, item.id) };
    if (item.hasStatus && item.statusName) {
      patch.activeStatuses = activeStatuses.filter((s) => s.name !== item.statusName);
    }
    save(patch);
  };
  const toggleItemFlag = (item, field) => onUpdateItem?.(item.id, { [field]: !item[field] });

  const commitRelations = (next) => (onSaveRelations ? onSaveRelations(next) : save({ relations: next }));
  function saveRelation(rel) {
    const exists = relations.some((r) => r.id === rel.id);
    const next = exists ? relations.map((r) => (r.id === rel.id ? rel : r)) : [...relations, rel];
    commitRelations(next);
  }
  function bumpRelation(rel, delta) {
    const next = relations.map((r) =>
      r.id === rel.id ? { ...r, level: clamp((r.level ?? 0) + delta, -100, 100) } : r,
    );
    commitRelations(next);
  }
  function deleteRelation(rel) {
    if (!window.confirm(`Удалить связь «${rel.name}»?`)) return;
    commitRelations(relations.filter((r) => r.id !== rel.id));
  }
  function toggleRel(id) {
    setOpenRels((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function saveTalent(name, newVal) {
    const next = talents.map((t) =>
      t.name === name ? { ...t, value: clamp(newVal, MAGIC_TALENT_MIN, MAGIC_TALENT_MAX) } : t,
    );
    save({ magicTalents: next });
  }

  async function handlePortraitClick() {
    if (!canChangePortrait || portraitUploading) return;
    portraitRef.current?.click();
  }
  async function handlePortraitFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validatePortraitFile(file);
    if (err) { setPortraitError(err); return; }
    setPortraitError("");
    setPortraitUploading(true);
    try {
      const dataUrl = await resizePortrait(file);
      save({ portrait: dataUrl });
    } catch (e2) {
      setPortraitError("Ошибка: " + e2.message);
    } finally {
      setPortraitUploading(false);
    }
  }

  function submitNote(e) {
    e.preventDefault();
    const title = noteTitle.trim();
    if (!title) return;
    save({ notes: [...notes, { title, body: noteBody.trim(), at: new Date().toISOString(), uid: user?.uid ?? "" }] });
    setNoteTitle("");
    setNoteBody("");
  }
  function deleteNote(idx) { save({ notes: notes.filter((_, i) => i !== idx) }); }
  function noteDisplayTitle(n) {
    if (n.title) return n.title;
    return n.text ? n.text.slice(0, 40) + (n.text.length > 40 ? "…" : "") : "(без заголовка)";
  }

  function viewStatus(s) {
    const def = campaignStatuses.find((d) => d.id === s.definitionId || d.name === s.name);
    setViewingStatus(def || s);
  }

  // ── masthead ───────────────────────────────────────────────────────
  const dossierCode = `KK-${ch.age}·${ch.academyYear}${ch.semester}-042`;
  const yearLabel = ch.academyYear === "graduate" ? "ВЫПУСК" : `${ch.academyYear} КУРС`;

  // ── tabs ───────────────────────────────────────────────────────────
  const tabs = [
    { id: "overview", no: "I", name: "Обзор" },
    { id: "skills", no: "II", name: "Навыки" },
    { id: "gear", no: "III", name: "Снаряжение" },
    { id: "dossier", no: "IV", name: "Досье" },
  ];
  if (isGM) tabs.push({ id: "gm", no: "ГМ", name: "Мастерская" });
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "overview";

  return (
    <div className="cc-doc" data-density={density} style={{ ["--fac-color"]: facColor }}>
      {/* ============ masthead ============ */}
      <div className="mast">
        <div className="mast-l">
          <div className="mast-title">
            <span className="k">Академия · Личное дело</span>
            <span className="n">Реестр учащихся</span>
          </div>
        </div>
        <div className="stamp"><span>СЕКРЕТНО</span></div>
        <div className="mast-r">
          <div className="mast-actions">
            {ch.lkArticleUrl && (
              <a className="mbtn" href={ch.lkArticleUrl} target="_blank" rel="noreferrer">▤ Вики</a>
            )}
            <button className="mbtn" onClick={toggleDensity} title="Плотность карточки">
              {density === "compact" ? "▤ Компактно" : "▤ Просторно"}
            </button>
            {canRoll && (
              <button className={`mbtn${rollerOn ? " on" : ""}`} onClick={toggleRoller}>
                <DiceIcon size={14} /> Броски: {rollerOn ? "вкл" : "выкл"}
              </button>
            )}
            {isGM && (
              <button className={`mbtn${activeTab === "gm" ? " on" : ""}`} onClick={() => setTab("gm")}>✒ Мастерская</button>
            )}
          </div>
          <div className="mast-meta"><span className="l">Дело №</span><span className="v">{dossierCode}</span></div>
          <div className="mast-meta"><span className="l">Курс</span><span className="v">{yearLabel}</span></div>
        </div>
      </div>

      {/* ============ body ============ */}
      <div className="cc-body">
        {/* ---------- rail ---------- */}
        <aside className="rail">
          <div className="rail-in">
            {/* ID photo */}
            <div
              className={`idphoto${canChangePortrait ? " editable" : ""}`}
              onClick={handlePortraitClick}
              title={canChangePortrait ? "Сменить портрет" : undefined}
            >
              <span className="tick tl" /><span className="tick tr" /><span className="tick bl" /><span className="tick br" />
              {ch.portrait
                ? <img src={ch.portrait} alt="" />
                : <span className="glyph">{(ch.name || "?").slice(0, 1)}</span>}
              {canChangePortrait && <span className="ph-edit">{portraitUploading ? "…" : "✎"}</span>}
              <span className="ph-note">фото учащегося</span>
              <input
                ref={portraitRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={handlePortraitFile}
              />
            </div>
            {portraitError && <div className="cc-empty" style={{ color: "var(--kk-danger)" }}>{portraitError}</div>}

            {/* identity */}
            <div className="ident">
              <h1 className="cc-name">{ch.name}</h1>
              {fac.name && <div className="fac-line">{fac.name}</div>}
              <dl className="ident-meta">
                <dt>Возраст</dt><dd>{ch.age} лет</dd>
                <dt>Семестр</dt><dd>{ch.semester}</dd>
                <dt>Монеты</dt><dd>{ch.money}</dd>
                <dt>Опыт</dt>
                <dd className="xp">
                  {ch.experience}
                  {!isGM && canAdv && <button className="lvlup" onClick={onAdvance}>↑ Прокачка</button>}
                </dd>
              </dl>
            </div>

            {/* rail statuses */}
            <div className="rail-status">
              <div className="rs-head">
                <span className="t">Состояния</span>
                <button className="stat-add" onClick={() => setStatusEditorOpen(true)}>+ добавить</button>
              </div>
              <div className="rs-chips">
                {activeStatuses.map((s, i) => (
                  <span
                    key={i}
                    className={`rchip${s.durationMode === "scene" ? " scene" : ""}`}
                    onClick={() => viewStatus(s)}
                  >
                    {s.name}
                    {s.durationMode === "scene" && <span className="dur">сцена</span>}
                    <span
                      className="x"
                      onClick={(e) => { e.stopPropagation(); campaignId && removeStatus(campaignId, ch.id, s, activeStatuses).catch(console.error); }}
                    >×</span>
                  </span>
                ))}
              </div>
            </div>

            {/* vitals */}
            <div className="vitals">
              <div className="vrow">
                <div className="hp-2">
                  <div>
                    <div className="hp-lab"><span>Физическое</span><span>{ch.health.physical.value}/{computeHealthPips(ch.attributes.endurance.die).max}</span></div>
                    <HealthPips die={ch.attributes.endurance.die} value={ch.health.physical.value} onSet={(v) => save({ "health.physical.value": v })} />
                  </div>
                  <div>
                    <div className="hp-lab"><span>Ментальное</span><span>{ch.health.mental.value}/{computeHealthPips(ch.attributes.spirit.die).max}</span></div>
                    <HealthPips die={ch.attributes.spirit.die} value={ch.health.mental.value} onSet={(v) => save({ "health.mental.value": v })} />
                  </div>
                </div>
              </div>
              <div className="vrow" style={{ ["--acc"]: "var(--fac)" }}>
                <div className="vl">
                  <span className="vname">Энергия</span>
                  <span className="vval">
                    <button className="vstep" onClick={() => save({ "energy.value": clamp(ch.energy.value - 1, 0, energyMax) })}>−</button>
                    <span><b>{ch.energy.value}</b> / {energyMax}</span>
                    <button className="vstep" onClick={() => save({ "energy.value": clamp(ch.energy.value + 1, 0, energyMax) })}>+</button>
                  </span>
                </div>
                <div className="meter"><i style={{ width: `${energyMax ? Math.round((ch.energy.value / energyMax) * 100) : 0}%` }} /></div>
              </div>
              <div className="vrow" style={{ ["--acc"]: "var(--kk-tension)" }}>
                <div className="vl"><span className="vname">Напряжение</span><span className="vval"><b>{tension.current}</b> / {tension.max}</span></div>
                <div className="meter stripes"><i style={{ width: `${tension.max ? Math.round((tension.current / tension.max) * 100) : 0}%` }} /></div>
              </div>
              <div className="vrow" style={{ ["--acc"]: "var(--fac)" }}>
                <div className="vl"><span className="vname">Жетоны судьбы</span><span className="vval"><b>{ch.bennies}</b> / 9</span></div>
                <div className="marks">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <button
                      key={i}
                      className={`mark${i < ch.bennies ? " on" : ""}${isGM ? " clickable" : ""}`}
                      disabled={!isGM}
                      onClick={isGM ? () => save({ bennies: ch.bennies === i + 1 ? i : i + 1 }) : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* railstats */}
            <div className="railstats">
              <div className="rsbtn">
                <span className="rl">Стойкость{showRoll && <RollBtn title="Бросок стойкости (макс Дух/Вын, ÷2)" onClick={() => { const b = deriveSoakBase(ch); setRollTarget({ kind: "toughness", name: "Стойкость", die: b.die, modifier: b.modifier, attribute: b.attrKey, isToughness: true }); }} />}</span>
                <span className="rv sm">{toughnessFormula}</span>
              </div>
              <div className="rsbtn">
                <span className="rl">Инициатива</span>
                <span className="rv sm">{initStr}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ---------- main ---------- */}
        <div className="main">
          <div className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`tab${activeTab === t.id ? " on" : ""}${t.id === "gm" ? " gm" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <span className="tn">{t.no}</span>{t.name}
              </button>
            ))}
          </div>

          {/* ===== I. Обзор ===== */}
          {activeTab === "overview" && (
            <div className="tabpanel">
              {/* Атрибуты */}
              <section className="sec">
                <div className="sh"><span className="idx">01</span><span className="tt">Атрибуты</span><span className="rule" /></div>
                <div className="attrs">
                  {ATTR_ORDER.map((k) => {
                    const a = ch.attributes[k];
                    return (
                      <div className="attr" key={k}>
                        <div className="an">{ATTR_SHORT[k]}</div>
                        <div className="ad">d{a.die}{a.modifier ? <span className="amod">{a.modifier > 0 ? `+${a.modifier}` : a.modifier}</span> : null}</div>
                        {showRoll && <RollBtn title={`Бросок: ${ATTR_LABEL[k]}`} onClick={() => setRollTarget({ kind: "attribute", name: ATTR_LABEL[k], die: a.die, modifier: a.modifier, attribute: k })} />}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Черты и возможности */}
              <section className="sec">
                <div className="sh"><span className="idx">02</span><span className="tt">Черты и возможности</span><span className="rule" /><span className="ct">{features.length}</span></div>
                {features.length === 0 && <div className="cc-empty">Нет черт</div>}
                {features.length > 0 && (
                  <div className="entries">
                    {features.map((f, i) => (
                      <div className="entry" key={i}>
                        <div className="eh">
                          <span className="en">{f.name}</span>
                          <span className={`badge${f.isWeakness ? " weak" : f.kind === "unique" ? " acc" : ""}`}>
                            {f.isWeakness ? "Слабость" : f.kind === "unique" ? "Уникальная" : "Черта"}
                          </span>
                          {isGM && <button className="del" title="Удалить" onClick={() => removeFeatureFromChar(campaignId, ch.id, f).catch(console.error)}>✕</button>}
                        </div>
                        {f.description && <div className="ed">{f.description}</div>}
                        {f.restrictions && <div className="er">Ограничение: {f.restrictions}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Магические таланты */}
              <section className="sec">
                <div className="sh"><span className="idx">03</span><span className="tt">Магические таланты</span><span className="rule" /><span className="ct">{talents.length}</span></div>
                <div className="talents">
                  {talents.map((t) => {
                    const v = t.value;
                    const isMax = v >= MAGIC_TALENT_MAX;
                    const isNeg = v <= -1;
                    return (
                      <div className={`tal${isMax ? " max" : ""}${isNeg ? " neg" : ""}`} key={t.name}>
                        <span className="tn">{t.name}</span>
                        <span className="tscale">
                          <button
                            className={`tcell negslot${isNeg ? " on" : ""}${isGM ? " clickable" : ""}`}
                            disabled={!isGM}
                            onClick={isGM ? () => saveTalent(t.name, v < 0 ? 0 : -1) : undefined}
                          />
                          {[1, 2, 3, 4, 5].map((i) => (
                            <button
                              key={i}
                              className={`tcell${v >= i ? " on" : ""}${isGM ? " clickable" : ""}`}
                              disabled={!isGM}
                              onClick={isGM ? () => saveTalent(t.name, v === i ? i - 1 : i) : undefined}
                            />
                          ))}
                        </span>
                        <span className="tval">{v > 0 ? `+${v}` : v}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ===== II. Навыки ===== */}
          {activeTab === "skills" && (
            <div className="tabpanel">
              <section className="sec">
                <div className="sh"><span className="idx">01</span><span className="tt">Навыки</span><span className="rule" /><span className="ct">{skills.length}</span></div>
                <div className="skcols">
                  {facSkills.length > 0 && (
                    <div className="skgroup fac">
                      <div className="skcat">{facName}<span className="l" /></div>
                      {facSkills.map((s) => <SkillRow key={s.name} s={s} showRoll={showRoll} onRoll={setRollTarget} />)}
                    </div>
                  )}
                  {otherSkills.length > 0 && (
                    <div className="skgroup">
                      <div className="skcat">Прочие навыки<span className="l" /></div>
                      {otherSkills.map((s) => <SkillRow key={s.name} s={s} showRoll={showRoll} onRoll={setRollTarget} />)}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ===== III. Снаряжение ===== */}
          {activeTab === "gear" && (
            <div className="tabpanel">
              <section className="sec">
                <div className="sh"><span className="idx">01</span><span className="tt">Снаряжение</span><span className="rule" /><span className="ct">{items.length}</span></div>
                <div className="cc-legacy">
                  <ItemList
                    items={items}
                    isGM={isGM}
                    canActivate={canRoll}
                    showRoll={showRoll}
                    onRollItem={rollItem}
                    onToggleFlag={toggleItemFlag}
                    onDeactivateSpell={deactivateSpell}
                    onDelete={onDeleteItem}
                    onUpdateItem={onUpdateItem}
                    character={ch}
                  />
                </div>
              </section>
              <section className="sec">
                <div className="sh"><span className="idx">02</span><span className="tt">Спутники</span><span className="rule" /><span className="ct">{companions.length}</span></div>
                <div className="cc-legacy">
                  <CompanionRefs companions={companions} canEdit={canEditRelations} onChange={(next) => save({ companions: next })} />
                </div>
              </section>
              <section className="sec">
                <div className="sh"><span className="idx">03</span><span className="tt">Даймоны</span><span className="rule" /></div>
                <div className="cc-legacy">
                  <DaemonRefs
                    daemonIds={Array.isArray(ch.refs?.daemons) ? ch.refs.daemons : []}
                    library={daemonLib}
                    isGM={isGM}
                    onLink={(id) => onLinkDaemon?.(ch.id, id)}
                    onUnlink={(id) => onUnlinkDaemon?.(ch.id, id)}
                  />
                </div>
              </section>
            </div>
          )}

          {/* ===== IV. Досье ===== */}
          {activeTab === "dossier" && (
            <div className="tabpanel">
              {/* Анкета */}
              <section className="sec">
                <div className="sh"><span className="idx">01</span><span className="tt">Анкета</span><span className="rule" />
                  {canEditBio && <button className="editbtn" onClick={onEditBio}>✎ править</button>}
                </div>
                {demoFields.length > 0 ? (
                  <dl className="form">
                    {demoFields.map(([k, label]) => (
                      <div className="frow" key={k}><dt>{label}</dt><dd>{ch[k]}</dd></div>
                    ))}
                  </dl>
                ) : <div className="cc-empty">Анкета не заполнена</div>}
                {ch.biography && <div className="bio">«{ch.biography}»</div>}
              </section>

              {/* Заметки */}
              {(notes.length > 0 || canAddNote) && (
                <section className="sec">
                  <div className="sh"><span className="idx">02</span><span className="tt">Заметки</span><span className="rule" /><span className="ct">{notes.length}</span></div>
                  {notes.length > 0 && (
                    <div className="entries">
                      {[...notes].reverse().map((n, i) => {
                        const origIdx = notes.length - 1 - i;
                        const canDelete = isGM || (user && n.uid === user.uid);
                        const dateStr = new Date(n.at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
                        return (
                          <div className="entry" key={origIdx}>
                            <div className="eh">
                              <span className="en">{noteDisplayTitle(n)}</span>
                              <span className="code">{dateStr}</span>
                              {canDelete && <button className="del" onClick={() => deleteNote(origIdx)}>✕</button>}
                            </div>
                            {(n.body || n.text) && <div className="ed"><InlineMarkdown text={n.body || n.text} /></div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {canAddNote && (
                    <form className="kk-note-form" onSubmit={submitNote} style={{ marginTop: 10 }}>
                      <input className="kk-note-input" type="text" placeholder="Заголовок заметки *" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} maxLength={200} required />
                      <textarea className="kk-note-input kk-note-body-input" placeholder="Текст (необязательно)" value={noteBody} onChange={(e) => setNoteBody(e.target.value)} maxLength={2000} rows={2} />
                      <button className="kk-note-btn" type="submit" disabled={!noteTitle.trim()}>Добавить</button>
                    </form>
                  )}
                </section>
              )}

              {/* Языки */}
              {(languages.length > 0 || isGM) && (
                <section className="sec">
                  <div className="sh"><span className="idx">03</span><span className="tt">Языки</span><span className="rule" /><span className="ct">{languages.length}</span></div>
                  {languages.length === 0 && <div className="cc-empty">Нет языков</div>}
                  {languages.length > 0 && (
                    <div className="taglist">
                      {languages.map((l, i) => (
                        <span key={i}>
                          {l.name}
                          {isGM && <button className="del" title="Убрать язык" onClick={() => removeLanguageFromChar(campaignId, ch.id, l).catch(console.error)}>✕</button>}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Связи */}
              <section className="sec">
                <div className="sh"><span className="idx">04</span><span className="tt">Связи</span><span className="rule" /><span className="ct">{relations.length}</span>
                  {canEditRelations && <button className="editbtn" onClick={() => setRelEditing("new")}>+ связь</button>}
                </div>
                {relations.length === 0 && <div className="cc-empty">Нет связей</div>}
                {relations.length > 0 && (
                  <div className="rels">
                    {[...relations].sort((a, b) => Math.abs(b.level ?? 0) - Math.abs(a.level ?? 0)).map((r) => {
                      const rk = r.id ?? `i${relations.indexOf(r)}`;
                      const lvl = clamp(r.level ?? 0, -100, 100);
                      const open = openRels.has(rk);
                      const half = (Math.abs(lvl) / 100) * 50;
                      const kindTag = r.tags?.length ? (RELATION_TAG_LABELS[r.tags[0]] || r.tags[0]) : getRelationLabel(lvl);
                      return (
                        <div className={`rel${open ? " open" : ""}`} key={rk}>
                          <div className="rel-head" onClick={() => toggleRel(rk)}>
                            <span className="rn">{r.name}</span>
                            <span className="rk">{kindTag}</span>
                            <span className="rlvl">Связь <b className={lvl < 0 ? "neg" : ""}>{lvl > 0 ? `+${lvl}` : lvl}</b></span>
                            <span className="chev">▸</span>
                          </div>
                          <div className="rel-body">
                            <div className="relav">{r.portrait ? <img src={r.portrait} alt="" /> : (r.name || "?").slice(0, 1)}</div>
                            <div className="relmain">
                              {r.tags?.length > 0 && (
                                <div className="reltags">{r.tags.map((t, i) => <span className="rtag" key={i}>{RELATION_TAG_LABELS[t] || t}</span>)}</div>
                              )}
                              <div className="relscale">
                                {canEditRelations && <button className="lvlbtn" onClick={() => bumpRelation(r, -10)}>−</button>}
                                <div className="relbar">
                                  <span className="relbar-zero" />
                                  <span className={`relbar-fill ${lvl >= 0 ? "pos" : "neg"}`} style={{ left: lvl >= 0 ? "50%" : `${50 - half}%`, width: `${half}%` }} />
                                </div>
                                {canEditRelations && <button className="lvlbtn" onClick={() => bumpRelation(r, 10)}>+</button>}
                                {canEditRelations && <button className="rel-edit" title="Изменить" onClick={() => setRelEditing(r)}>✎</button>}
                                {canEditRelations && <button className="rel-edit" title="Удалить" onClick={() => deleteRelation(r)}>✕</button>}
                              </div>
                              {r.notes && <div className="relnote">{r.notes}</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Организации / контакты */}
              <section className="sec">
                <div className="sh"><span className="idx">05</span><span className="tt">Организации</span><span className="rule" /></div>
                <div className="cc-legacy">
                  <ContactsList
                    contacts={contacts}
                    orgs={orgs}
                    isGM={isGM}
                    isOwner={isOwner}
                    canSetLevel={canEditRelations}
                    onLink={(orgId) => onLinkOrg?.(ch, orgId)}
                    onUnlink={(orgId) => onUnlinkOrg?.(ch.id, orgId)}
                    onSetLevel={(orgId, level) => onSetOrgLevel?.(ch.id, orgId, level)}
                  />
                </div>
              </section>
            </div>
          )}

          {/* ===== ГМ ===== */}
          {activeTab === "gm" && isGM && (
            <div className="tabpanel gmpanel">
              <section className="sec">
                <div className="sh"><span className="idx">01</span><span className="tt">Управление (только ГМ)</span><span className="rule" /></div>
                <div className="gm-actions">
                  <button className="kk-btn ghost" onClick={onEdit}>Редактировать вручную</button>
                  <button className="kk-btn ghost" onClick={onLog}>Логи</button>
                </div>
              </section>

              <section className="sec">
                <div className="sh"><span className="idx">02</span><span className="tt">Напряжение</span><span className="rule" /></div>
                <div className="kk-tension-strip">
                  <Stat label="Напряжение" value={tension.current} max={tension.max}
                    onChange={(v) => save({ "tension.current": Math.max(0, v) })}
                    tip="Психическое напряжение. Накапливается от бросков с сильными эмоциональными связями."
                    accent="var(--kk-tension)" />
                  {tension.overcap > 0 && (
                    <Stat label="Перегруз" value={tension.overcap}
                      tip={`Напряжение выше порога. Каждая единица снижает макс. Энергию на 1 (сейчас −${tension.energyPenalty}).`}
                      accent="var(--kk-danger)" />
                  )}
                  {overflow > 0 && (
                    <Stat label="Переполнение" value={overflow}
                      onChange={(v) => save({ overflow_damage: Math.max(0, v) })}
                      tip="Урон сверх обоих треков здоровья."
                      accent="var(--kk-danger)" />
                  )}
                </div>
              </section>

              <section className="sec">
                <div className="sh"><span className="idx">03</span><span className="tt">Добавить черту</span><span className="rule" /></div>
                <AddFeatureForm campaignId={campaignId} charId={ch.id} />
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ============ modals ============ */}
      {statusEditorOpen && (
        <StatusEditor
          campaignStatuses={campaignStatuses}
          activeStatuses={activeStatuses}
          onApply={(instance) => campaignId && applyStatus(campaignId, ch.id, instance).catch(console.error)}
          onClose={() => setStatusEditorOpen(false)}
        />
      )}
      {viewingStatus && (
        <StatusCard status={viewingStatus} campaignId={campaignId} isGM={isGM} onClose={() => setViewingStatus(null)} />
      )}
      {relEditing && (
        <RelationEditor
          relation={relEditing === "new" ? null : relEditing}
          peers={peers}
          onSave={saveRelation}
          onClose={() => setRelEditing(null)}
        />
      )}
      {rollTarget && (
        <RollDialog
          key={`${rollTarget.kind}:${rollTarget.name}`}
          ch={ch}
          target={rollTarget}
          campaign={campaign}
          campaignStatuses={campaignStatuses}
          items={items}
          isGM={isGM}
          onCommit={onCommitRoll}
          onClose={() => setRollTarget(null)}
          roster={roster}
          onAttack={onAttack}
        />
      )}
    </div>
  );
}

function SkillRow({ s, showRoll, onRoll }) {
  const unt = s.die === 4 && s.modifier <= -2;
  return (
    <div className={`sk${unt ? " untr" : ""}`}>
      <span className="kn">{s.name}</span>
      <span className="ka">{ATTR_SHORT[s.attr]}</span>
      <span className="kd">{dieStr(s.die, s.modifier)}</span>
      {showRoll
        ? <RollBtn title={`Бросок: ${s.name}`} onClick={() => onRoll({ kind: "skill", name: s.name, die: s.die, modifier: s.modifier, attribute: s.attr })} />
        : <span />}
    </div>
  );
}

const EMPTY_FEATURE_FORM = {
  name: "", kind: "character", description: "", isWeakness: false, restrictions: "", costTrack: "physical",
  modTarget: "none", modAttr: "agility", modSkills: "", modNumeric: 0, modDie: 0, modSuccess: 0,
};

function buildFeatureModifier(form) {
  if (form.modTarget === "none") return null;
  const numeric = Number(form.modNumeric) || 0;
  const die = Number(form.modDie) || 0;
  const success = Number(form.modSuccess) || 0;
  if (!numeric && !die && !success) return null;
  const m = { modifier: numeric, die_change: die, success_modifier: success };
  if (form.modTarget === "all") m.target_all = true;
  else if (form.modTarget === "attribute") m[`target_${form.modAttr}`] = true;
  else if (form.modTarget === "skill") {
    m.target_skills = form.modSkills.split(",").map((s) => s.trim()).filter(Boolean);
    if (m.target_skills.length === 0) return null;
  }
  return m;
}

function AddFeatureForm({ campaignId, charId }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FEATURE_FORM);
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      // eslint-disable-next-line no-unused-vars
      const { modTarget, modAttr, modSkills, modNumeric, modDie, modSuccess, ...rest } = form;
      const modifier = buildFeatureModifier(form);
      const feature = { ...rest, name: form.name.trim() };
      if (modifier) feature.modifier = modifier;
      await addFeatureToChar(campaignId, charId, feature);
      setOpen(false);
      setForm(EMPTY_FEATURE_FORM);
    } catch (err) {
      alert("Ошибка: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return (
    <button className="kk-note-btn kk-items-add-btn" onClick={() => setOpen(true)}>+ Добавить черту</button>
  );

  return (
    <form className="kk-item-form" onSubmit={handleSubmit}>
      <input className="kk-note-input" placeholder="Название *" value={form.name} onChange={(e) => setF("name", e.target.value)} required maxLength={100} />
      <div className="kk-item-form-row">
        <label className="kk-item-form-label">Вид:</label>
        <select className="kk-item-select" value={form.kind} onChange={(e) => setF("kind", e.target.value)}>
          <option value="character">Черта характера</option>
          <option value="unique">Уникальная возможность</option>
        </select>
        <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>
          <input type="checkbox" checked={form.isWeakness} onChange={(e) => setF("isWeakness", e.target.checked)} /> Слабость
        </label>
      </div>
      <textarea className="kk-note-input kk-note-body-input" placeholder="Описание" value={form.description} onChange={(e) => setF("description", e.target.value)} rows={2} maxLength={500} />
      {form.kind === "unique" && (
        <>
          <textarea className="kk-note-input kk-note-body-input" placeholder="Ограничения" value={form.restrictions} onChange={(e) => setF("restrictions", e.target.value)} rows={1} maxLength={300} />
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Шкала затрат:</label>
            <select className="kk-item-select" value={form.costTrack} onChange={(e) => setF("costTrack", e.target.value)}>
              <option value="physical">Физическая</option>
              <option value="mental">Ментальная</option>
            </select>
          </div>
        </>
      )}
      <div className="kk-item-form-row">
        <label className="kk-item-form-label">Модификатор броска:</label>
        <select className="kk-item-select" value={form.modTarget} onChange={(e) => setF("modTarget", e.target.value)}>
          <option value="none">— нет —</option>
          <option value="all">Все броски</option>
          <option value="attribute">Атрибут</option>
          <option value="skill">Навыки</option>
        </select>
        {form.modTarget === "attribute" && (
          <select className="kk-item-select" value={form.modAttr} onChange={(e) => setF("modAttr", e.target.value)}>
            {ATTR_ORDER.map((k) => <option key={k} value={k}>{ATTR_LABEL[k]}</option>)}
          </select>
        )}
      </div>
      {form.modTarget === "skill" && (
        <input className="kk-note-input" placeholder="Навыки через запятую" value={form.modSkills} onChange={(e) => setF("modSkills", e.target.value)} maxLength={200} />
      )}
      {form.modTarget !== "none" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">К броску:</label>
          <input type="number" className="kk-item-num" value={form.modNumeric} onChange={(e) => setF("modNumeric", e.target.value)} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Ступ. грани:</label>
          <input type="number" className="kk-item-num" value={form.modDie} onChange={(e) => setF("modDie", e.target.value)} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>К успеху:</label>
          <input type="number" className="kk-item-num" value={form.modSuccess} onChange={(e) => setF("modSuccess", e.target.value)} />
        </div>
      )}
      <div className="kk-item-form-actions">
        <button type="submit" className="kk-note-btn" disabled={saving || !form.name.trim()}>{saving ? "…" : "Добавить"}</button>
        <button type="button" className="kk-note-btn kk-item-cancel-btn" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </form>
  );
}
