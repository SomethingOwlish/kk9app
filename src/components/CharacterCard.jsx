import { useState, useRef } from "react";
import Tip from "./Tip";
import InlineMarkdown from "./InlineMarkdown";
import { skillTipContent } from "./SkillTip";
import Stat from "./Stat";
import HealthTrack from "./HealthTrack";
import StatusBar from "./StatusBar";
import StatusEditor from "./StatusEditor";
import StatusCard from "./StatusCard";
import ItemList from "./ItemList";
import LkLink from "./LkLink";
import RelationsList from "./RelationsList";
import CompanionRefs from "./CompanionRefs";
import DaemonRefs from "./DaemonRefs";
import ContactsList from "./ContactsList";
import RollDialog from "./RollDialog";
import DiceIcon from "./DiceIcon";
import { derivePhysicalToughness, deriveEnergyMax } from "../lib/derive";
import { applyStatus, removeStatus, removeLanguageFromChar, addFeatureToChar, removeFeatureFromChar } from "../lib/db";
import { buildItemRollTarget } from "../lib/items";
import { resizePortrait, validatePortraitFile } from "../lib/storage";
import { loadPrefs, savePref } from "../lib/userPrefs";
import { ATTR_ORDER, ATTR_LABEL, ATTR_SHORT, CAT_ORDER, CAT_LABEL, dieStr } from "../lib/constants";

const DEMO_FIELDS = [
  ["birthplace", "Место рождения"],
  ["dormitory", "Общежитие"],
  ["height", "Рост"],
  ["build", "Телосложение"],
  ["allergies", "Аллергии"],
];

const FEATURE_KIND_LABEL = { character: "Черта характера", unique: "Уникальная возможность" };

export default function CharacterCard({ ch, save, isGM, user, canAdv, onEdit, onEditBio, onAdvance, onLog, campaignId, campaignStatuses = [], items = [], onDeleteItem, onUpdateItem, peers = [], orgs = [], campaign, canRoll = false, onCommitRoll, onLinkOrg, onUnlinkOrg, onSetOrgLevel, daemonLib = [], onLinkDaemon, onUnlinkDaemon, roster = [], onAttack }) {
  const toughness = ch.health?.physical?.toughness ?? derivePhysicalToughness(ch);
  // Stored energy.max falls back to derived for pre-B07 characters
  const energyMaxRaw = ch.energy?.max ?? deriveEnergyMax(ch);
  const tension = ch.tension || { current: 0, overcap: 0, energyPenalty: 0, max: 0 };
  const energyMax = Math.max(0, energyMaxRaw - (tension.energyPenalty ?? 0));
  const overflow = ch.overflow_damage ?? 0;
  const im = ch.attributes.agility.modifier + ch.attributes.smarts.modifier;
  const initStr = `d${ch.attributes.agility.die} · d${ch.attributes.smarts.die} · d6 → 2 лучших${im ? (im > 0 ? ` +${im}` : ` ${im}`) : ""}`;
  // Навыки с категорией вне CAT_ORDER (напр., из импорта Foundry) не должны молча
  // пропадать — собираем их в запасную группу «Прочие».
  const knownCats = new Set(CAT_ORDER);
  const grouped = [
    ...CAT_ORDER.map(cat => ({ cat, items: (ch.skills || []).filter(s => s.categ === cat) })),
    { cat: "other", items: (ch.skills || []).filter(s => !knownCats.has(s.categ)) },
  ].filter(g => g.items.length);
  const fac = ch.faculty || {};
  const hasBio = !!ch.biography;
  const demoFields = DEMO_FIELDS.filter(([k]) => ch[k]);
  const isOwner = !!(user && ch.ownerUid && user.uid === ch.ownerUid);
  const canEditBio = isOwner || isGM;
  const notes = Array.isArray(ch.notes) ? ch.notes : [];
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const canAddNote = isOwner || isGM;
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);
  const [viewingStatus, setViewingStatus] = useState(null);
  const [rollTarget, setRollTarget] = useState(null);
  // Roller visibility toggle (task 1) — persisted per user. Off → no roll buttons.
  const [rollerOn, setRollerOn] = useState(() => loadPrefs(user?.uid).rollerOn ?? true);
  const showRoll = canRoll && rollerOn;
  function toggleRoller() {
    const next = !rollerOn;
    setRollerOn(next);
    if (user?.uid) savePref(user.uid, "rollerOn", next);
  }
  const rollItem = (item) => setRollTarget(buildItemRollTarget(item, ch));
  const toggleItemFlag = (item, field) => onUpdateItem?.(item.id, { [field]: !item[field] });
  const activeStatuses = Array.isArray(ch.activeStatuses) ? ch.activeStatuses : [];
  const companions = Array.isArray(ch.companions) ? ch.companions : [];
  const relations = Array.isArray(ch.relations) ? ch.relations : [];
  const contacts = Array.isArray(ch.refs?.contacts) ? ch.refs.contacts : [];
  const canEditRelations = isOwner || isGM;

  const portraitRef = useRef(null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [portraitError, setPortraitError] = useState("");
  const canChangePortrait = isOwner || isGM;

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
    } catch (e) {
      setPortraitError("Ошибка: " + e.message);
    } finally {
      setPortraitUploading(false);
    }
  }
  const showNotes = notes.length > 0 || canAddNote;

  function submitNote(e) {
    e.preventDefault();
    const title = noteTitle.trim();
    if (!title) return;
    save({ notes: [...notes, { title, body: noteBody.trim(), at: new Date().toISOString(), uid: user?.uid ?? "" }] });
    setNoteTitle("");
    setNoteBody("");
  }

  function deleteNote(idx) {
    save({ notes: notes.filter((_, i) => i !== idx) });
  }

  function noteDisplayTitle(n) {
    if (n.title) return n.title;
    return n.text ? n.text.slice(0, 40) + (n.text.length > 40 ? "…" : "") : "(без заголовка)";
  }

  return (
    <div className="kk-card">
      <header className="kk-head">
        <div
          className={`kk-portrait${canChangePortrait ? " kk-portrait--editable" : ""}${portraitUploading ? " kk-portrait--uploading" : ""}`}
          style={{ ["--fac-color"]: fac.color || "#c8a14e" }}
          onClick={handlePortraitClick}
          title={canChangePortrait ? "Сменить портрет" : undefined}
        >
          {ch.portrait ? <img src={ch.portrait} alt=""/> : <span className="kk-portrait-ph">{(ch.name || "?").slice(0, 1)}</span>}
          {canChangePortrait && <span className="kk-portrait-overlay">{portraitUploading ? "…" : "✎"}</span>}
          <input
            ref={portraitRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={handlePortraitFile}
          />
        </div>
        {portraitError && <p className="kk-error kk-portrait-err">{portraitError}</p>}
        <div className="kk-head-main">
          <h1 className="kk-name">{ch.name}</h1>
          <div className="kk-head-tags">
            {fac.name && <><span className="kk-fac" style={{ ["--fac-color"]: fac.color || "#c8a14e" }}>{fac.name}</span><span className="kk-sep">·</span></>}
            <span>{ch.academyYear} курс, {ch.semester} семестр</span><span className="kk-sep">·</span><span>{ch.age} лет</span>
          </div>
          <div className="kk-head-econ">
            <span className="kk-econ">◈ {ch.money}</span>
            <span className="kk-econ">✦ {ch.experience} опыта</span>
          </div>
        </div>
        <div className="kk-head-actions">
          {canRoll && (
            <button
              className={`kk-roller-toggle${rollerOn ? " on" : ""}`}
              onClick={toggleRoller}
              title={rollerOn ? "Скрыть кнопки бросков" : "Показать кнопки бросков"}
            >
              <DiceIcon size={15}/> Броски: {rollerOn ? "вкл" : "выкл"}
            </button>
          )}
          <LkLink url={ch.lkArticleUrl} label="Вики"/>
          {!isGM && canAdv && <button className="kk-adv-btn" onClick={onAdvance}>Прокачка</button>}
          {isGM && <button className="kk-edit-btn" onClick={onEdit}>Редактировать вручную</button>}
          {isGM && <button className="kk-edit-btn" onClick={onLog}>Логи</button>}
        </div>
      </header>

      {/* 1 — Статусы (после хедера) */}
      <section className="kk-block">
        <h2 className="kk-h2">Статусы</h2>
        <StatusBar
          statuses={activeStatuses}
          isGM={isGM}
          onRemove={(s) => campaignId && removeStatus(campaignId, ch.id, s, activeStatuses).catch(console.error)}
          onAdd={() => setStatusEditorOpen(true)}
          onView={(s) => {
            // Resolve to definition if possible (for full effects/description data)
            const def = campaignStatuses.find(d => d.id === s.definitionId || d.name === s.name);
            setViewingStatus(def || s);
          }}
        />
        {activeStatuses.length === 0 && <div className="kk-empty-sm">Нет активных статусов</div>}
      </section>

      {statusEditorOpen && (
        <StatusEditor
          campaignStatuses={campaignStatuses}
          activeStatuses={activeStatuses}
          onApply={(instance) => campaignId && applyStatus(campaignId, ch.id, instance).catch(console.error)}
          onClose={() => setStatusEditorOpen(false)}
        />
      )}

      {viewingStatus && (
        <StatusCard
          status={viewingStatus}
          campaignId={campaignId}
          isGM={isGM}
          onClose={() => setViewingStatus(null)}
        />
      )}

      {/* 2 — Анкета (биография + языки внутри) */}
      {(hasBio || demoFields.length > 0 || canEditBio || (ch.languages && ch.languages.length > 0)) && (
        <details className="kk-bio-details" open>
          <summary className="kk-h2 kk-bio-summary">Анкета</summary>
          <div className="kk-bio-body">
            <button
              className="kk-btn ghost kk-bio-edit-btn"
              onClick={canEditBio ? onEditBio : undefined}
              disabled={!canEditBio}
              title={canEditBio ? undefined : "Можно редактировать только свою анкету"}
            >
              Редактировать анкету
            </button>
            {demoFields.length > 0 && (
              <div className="kk-demo-grid">
                {demoFields.map(([k, label]) => (
                  <div className="kk-demo-field" key={k}>
                    <span className="kk-demo-label">{label}</span>
                    <span className="kk-demo-val">{ch[k]}</span>
                  </div>
                ))}
              </div>
            )}
            {hasBio && (
              <div className="kk-bio-text">
                <div className="kk-demo-label">Биография</div>
                <p className="kk-bio-para">{ch.biography}</p>
              </div>
            )}
            {((ch.languages && ch.languages.length > 0) || isGM) && (
              <div className="kk-bio-langs">
                <div className="kk-demo-label">Языки</div>
                {(!ch.languages || ch.languages.length === 0) && <div className="kk-empty-sm">Нет языков</div>}
                <div className="kk-bio-langs-list">
                  {(ch.languages || []).map((lang, i) => (
                    <span key={i} className="kk-lang-chip">
                      {lang.name}
                      {isGM && (
                        <button className="kk-lang-del" onClick={() => removeLanguageFromChar(campaignId, ch.id, lang).catch(console.error)} title="Убрать язык">✕</button>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {!hasBio && demoFields.length === 0 && (!ch.languages || ch.languages.length === 0) && (
              <div className="kk-empty-sm">Анкета не заполнена</div>
            )}
          </div>
        </details>
      )}

      {/* 3 — Черты и возможности (для ГМа и игрока) */}
      {((ch.features && ch.features.length > 0) || isGM) && (
        <section className="kk-block">
          <h2 className="kk-h2">Черты и возможности</h2>
          {(!ch.features || ch.features.length === 0) && <div className="kk-empty-sm">Нет черт</div>}
          <div className="kk-items-group">
            {(ch.features || []).map((feat, i) => (
              <div key={i} className="kk-item kk-item-feature">
                <div className="kk-item-header">
                  <span className="kk-item-icon">{feat.isWeakness ? "⬇" : "★"}</span>
                  <span className="kk-item-name">{feat.name}</span>
                  {feat.kind && <span className="kk-item-subtype">{FEATURE_KIND_LABEL[feat.kind] || feat.kind}</span>}
                  {isGM && (
                    <button className="kk-note-del" onClick={() => removeFeatureFromChar(campaignId, ch.id, feat).catch(console.error)} title="Удалить">✕</button>
                  )}
                </div>
                {feat.description && <p className="kk-item-desc">{feat.description}</p>}
                {feat.restrictions && <p className="kk-item-desc" style={{ fontStyle: "italic" }}>{feat.restrictions}</p>}
              </div>
            ))}
          </div>
          {isGM && <AddFeatureForm campaignId={campaignId} charId={ch.id} />}
        </section>
      )}

      {/* 4 — Здоровье */}
      <section className="kk-block">
        <h2 className="kk-h2">Здоровье</h2>
        <HealthTrack label="Физическое" attrLabel="Выносливости" attrDie={ch.attributes.endurance.die}
          value={ch.health.physical.value} onChange={(v) => save({ "health.physical.value": v })}
          tipExtra="Растёт от Выносливости."/>
        <HealthTrack label="Ментальное" attrLabel="Духа" attrDie={ch.attributes.spirit.die}
          value={ch.health.mental.value} onChange={(v) => save({ "health.mental.value": v })}
          tipExtra="Растёт от Духа."/>
        {overflow > 0 && (
          <div className="kk-overflow-row">
            <Tip text="Урон сверх обоих треков здоровья. Только ГМ или результат броска.">
              <span className="kk-overflow-label kk-dotted">Переполнение</span>
            </Tip>
            <span className="kk-overflow-val">{overflow}</span>
            {isGM && (
              <button className="kk-step" onClick={() => save({ overflow_damage: Math.max(0, overflow - 1) })}>−</button>
            )}
          </div>
        )}
      </section>

      {/* 5 — Атрибуты */}
      <section className="kk-block">
        <h2 className="kk-h2">Атрибуты</h2>
        <div className="kk-attrs">{ATTR_ORDER.map(k => {
          const a = ch.attributes[k];
          return (
            <div className="kk-attr" key={k}>
              <span className="kk-attr-name">{ATTR_LABEL[k]}</span>
              <span className="kk-attr-die">{dieStr(a.die, a.modifier)}</span>
              {showRoll && (
                <button className="kk-roll-btn" title={`Бросок: ${ATTR_LABEL[k]}`}
                  onClick={() => setRollTarget({ kind: "attribute", name: ATTR_LABEL[k], die: a.die, modifier: a.modifier, attribute: k })}><DiceIcon/></button>
              )}
            </div>
          );
        })}</div>
      </section>

      {/* 6 — Стойкость / инициатива / энергия / жетоны */}
      <section className="kk-strip">
        <div className="kk-stat kk-stat-tough">
          <Stat label="Стойкость" value={toughness} tip="2 + ⌊Дух/2⌋. Считается автоматически. Бросок стойкости — по Духу." accent="var(--kk-gold)"/>
          {showRoll && (
            <button className="kk-roll-btn" title="Бросок стойкости (Дух)"
              onClick={() => setRollTarget({ kind: "toughness", name: "Стойкость", die: ch.attributes.spirit.die, modifier: ch.attributes.spirit.modifier, attribute: "spirit", isToughness: true })}><DiceIcon/></button>
          )}
        </div>
        <div className="kk-stat kk-stat-wide">
          <Tip text="Пул инициативы: Ловкость + Смекалка + Wild Die d6, 2 лучших. Бросок — вне карточки.">
            <span className="kk-stat-label kk-dotted">Инициатива</span>
          </Tip>
          <span className="kk-init">{initStr}</span>
        </div>
        <Stat label="Энергия" value={ch.energy.value} max={energyMax}
          onChange={(v) => save({ "energy.value": Math.max(0, Math.min(energyMax, v)) })}
          tip={isGM && tension.energyPenalty > 0
            ? `Максимум = ${energyMaxRaw} − ${tension.energyPenalty} (перегруз напряжения).`
            : tension.energyPenalty > 0
              ? "Максимум снижен статусным эффектом."
              : "Максимум = возраст + грань Духа."}
          accent="var(--kk-gold)"/>
        <Stat label="Жетоны судьбы" value={ch.bennies} max={9}
          onChange={isGM ? (v) => save({ bennies: Math.max(0, Math.min(9, v)) }) : undefined}
          tip={isGM ? "Старт 3, максимум 9. Выдаёт/снимает ГМ." : "Старт 3, максимум 9. Меняет только ГМ."}
          accent="var(--kk-gold)"/>
      </section>

      {isGM && (
        <section className="kk-block">
          <h2 className="kk-h2">Напряжение</h2>
          <div className="kk-tension-strip">
            <Stat label="Напряжение" value={tension.current} max={tension.max}
              onChange={(v) => save({ "tension.current": Math.max(0, v) })}
              tip="Психическое напряжение. Накапливается от бросков с сильными эмоциональными связями."
              accent="var(--kk-tension)"/>
            {tension.overcap > 0 && (
              <Stat label="Перегруз" value={tension.overcap}
                tip={`Напряжение выше порога. Каждая единица снижает макс. Энергию на 1 (сейчас −${tension.energyPenalty}).`}
                accent="var(--kk-danger)"/>
            )}
          </div>
        </section>
      )}

      {/* 7 — Навыки */}
      <section className="kk-block">
        <h2 className="kk-h2">Навыки</h2>
        {grouped.map(g => (
          <div className="kk-skill-group" key={g.cat}>
            <div className="kk-skill-cat">{CAT_LABEL[g.cat] || "Прочие"}</div>
            <div className="kk-skills">{g.items.map(s => {
              const unt = s.die === 4 && s.modifier <= -2;
              const fallbackTip = `Связан с: ${ATTR_LABEL[s.attr]}. Не выше атрибута.`;
              return (
                <div className={`kk-skill ${unt ? "untrained" : ""}`} key={s.name}>
                  <span className="kk-skill-name">{s.name}</span>
                  <Tip text={skillTipContent(s, fallbackTip)} label={fallbackTip}>
                    <span className="kk-skill-attr">{ATTR_SHORT[s.attr]}</span>
                  </Tip>
                  <span className="kk-skill-die">{dieStr(s.die, s.modifier)}</span>
                  {showRoll && (
                    <button className="kk-roll-btn" title={`Бросок: ${s.name}`}
                      onClick={() => setRollTarget({ kind: "skill", name: s.name, die: s.die, modifier: s.modifier, attribute: s.attr })}><DiceIcon/></button>
                  )}
                </div>
              );
            })}</div>
          </div>
        ))}
      </section>

      {/* 8 — Спутники */}
      <CompanionRefs
        companions={companions}
        canEdit={canEditRelations}
        onChange={(next) => save({ companions: next })}
      />

      {/* 8b — Даймоны (TASK-074): ссылки на записи библиотеки */}
      <DaemonRefs
        daemonIds={Array.isArray(ch.refs?.daemons) ? ch.refs.daemons : []}
        library={daemonLib}
        isGM={isGM}
        onLink={(id) => onLinkDaemon?.(ch.id, id)}
        onUnlink={(id) => onUnlinkDaemon?.(ch.id, id)}
      />

      {/* 9 — Предметы (с активацией и бросками) */}
      <ItemList
        items={items}
        isGM={isGM}
        canActivate={canRoll}
        showRoll={showRoll}
        onRollItem={rollItem}
        onToggleFlag={toggleItemFlag}
        onDelete={onDeleteItem}
        onUpdateItem={onUpdateItem}
        character={ch}
      />

      {/* 10 — Отношения */}
      <RelationsList
        relations={relations}
        peers={peers}
        canEdit={canEditRelations}
        onChange={(next) => save({ relations: next })}
        onDelete={(next) => save({ relations: next })}
      />

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

      {showNotes && (
        <section className="kk-block">
          <h2 className="kk-h2">Заметки</h2>
          {notes.length > 0 && (
            <div className="kk-notes-list">
              {[...notes].reverse().map((n, i) => {
                const origIdx = notes.length - 1 - i;
                const canDelete = isGM || (user && n.uid === user.uid);
                const dateStr = new Date(n.at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
                return (
                  <details key={origIdx} className="kk-note-item">
                    <summary className="kk-note-summary">
                      <span className="kk-note-title">{noteDisplayTitle(n)}</span>
                      <span className="kk-note-at">{dateStr}</span>
                      {canDelete && (
                        <button
                          className="kk-note-del"
                          type="button"
                          onClick={e => { e.preventDefault(); deleteNote(origIdx); }}
                          aria-label="Удалить заметку"
                        >✕</button>
                      )}
                    </summary>
                    {(n.body || n.text) && (
                      <p className="kk-note-body"><InlineMarkdown text={n.body || n.text} /></p>
                    )}
                  </details>
                );
              })}
            </div>
          )}
          {canAddNote && (
            <form className="kk-note-form" onSubmit={submitNote}>
              <input
                className="kk-note-input"
                type="text"
                placeholder="Заголовок заметки *"
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                maxLength={200}
                required
              />
              <textarea
                className="kk-note-input kk-note-body-input"
                placeholder="Текст (необязательно)"
                value={noteBody}
                onChange={e => setNoteBody(e.target.value)}
                maxLength={2000}
                rows={2}
              />
              <button className="kk-note-btn" type="submit" disabled={!noteTitle.trim()}>Добавить</button>
            </form>
          )}
        </section>
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

const EMPTY_FEATURE_FORM = {
  name: "", kind: "character", description: "", isWeakness: false, restrictions: "", costTrack: "physical",
  // Roll modifier (optional) — fed into collectRollModifiers.
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
    m.target_skills = form.modSkills.split(",").map(s => s.trim()).filter(Boolean);
    if (m.target_skills.length === 0) return null;
  }
  return m;
}

function AddFeatureForm({ campaignId, charId }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FEATURE_FORM);
  const [saving, setSaving] = useState(false);
  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

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
    <button className="kk-note-btn kk-items-add-btn" onClick={() => setOpen(true)} style={{ marginTop: "0.5rem" }}>+ Добавить черту</button>
  );

  return (
    <form className="kk-item-form" onSubmit={handleSubmit} style={{ marginTop: "0.5rem" }}>
      <input className="kk-note-input" placeholder="Название *" value={form.name} onChange={e => setF("name", e.target.value)} required maxLength={100} />
      <div className="kk-item-form-row">
        <label className="kk-item-form-label">Вид:</label>
        <select className="kk-item-select" value={form.kind} onChange={e => setF("kind", e.target.value)}>
          <option value="character">Черта характера</option>
          <option value="unique">Уникальная возможность</option>
        </select>
        <label className="kk-item-form-label" style={{ marginLeft: "0.75rem" }}>
          <input type="checkbox" checked={form.isWeakness} onChange={e => setF("isWeakness", e.target.checked)} /> Слабость
        </label>
      </div>
      <textarea className="kk-note-input kk-note-body-input" placeholder="Описание" value={form.description} onChange={e => setF("description", e.target.value)} rows={2} maxLength={500} />
      {form.kind === "unique" && (
        <>
          <textarea className="kk-note-input kk-note-body-input" placeholder="Ограничения" value={form.restrictions} onChange={e => setF("restrictions", e.target.value)} rows={1} maxLength={300} />
          <div className="kk-item-form-row">
            <label className="kk-item-form-label">Шкала затрат:</label>
            <select className="kk-item-select" value={form.costTrack} onChange={e => setF("costTrack", e.target.value)}>
              <option value="physical">Физическая</option>
              <option value="mental">Ментальная</option>
            </select>
          </div>
        </>
      )}
      <div className="kk-item-form-row">
        <label className="kk-item-form-label">Модификатор броска:</label>
        <select className="kk-item-select" value={form.modTarget} onChange={e => setF("modTarget", e.target.value)}>
          <option value="none">— нет —</option>
          <option value="all">Все броски</option>
          <option value="attribute">Атрибут</option>
          <option value="skill">Навыки</option>
        </select>
        {form.modTarget === "attribute" && (
          <select className="kk-item-select" value={form.modAttr} onChange={e => setF("modAttr", e.target.value)}>
            {ATTR_ORDER.map(k => <option key={k} value={k}>{ATTR_LABEL[k]}</option>)}
          </select>
        )}
      </div>
      {form.modTarget === "skill" && (
        <input className="kk-note-input" placeholder="Навыки через запятую" value={form.modSkills} onChange={e => setF("modSkills", e.target.value)} maxLength={200} />
      )}
      {form.modTarget !== "none" && (
        <div className="kk-item-form-row">
          <label className="kk-item-form-label">К броску:</label>
          <input type="number" className="kk-item-num" value={form.modNumeric} onChange={e => setF("modNumeric", e.target.value)} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>Ступ. грани:</label>
          <input type="number" className="kk-item-num" value={form.modDie} onChange={e => setF("modDie", e.target.value)} />
          <label className="kk-item-form-label" style={{ marginLeft: "0.5rem" }}>К успеху:</label>
          <input type="number" className="kk-item-num" value={form.modSuccess} onChange={e => setF("modSuccess", e.target.value)} />
        </div>
      )}
      <div className="kk-item-form-actions">
        <button type="submit" className="kk-note-btn" disabled={saving || !form.name.trim()}>{saving ? "…" : "Добавить"}</button>
        <button type="button" className="kk-note-btn kk-item-cancel-btn" onClick={() => setOpen(false)}>Отмена</button>
      </div>
    </form>
  );
}
