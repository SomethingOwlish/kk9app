import { useState } from "react";
import Tip from "./Tip";
import Stat from "./Stat";
import HealthTrack from "./HealthTrack";
import StatusBar from "./StatusBar";
import StatusEditor from "./StatusEditor";
import StatusCard from "./StatusCard";
import { derivePhysicalToughness, deriveEnergyMax } from "../lib/derive";
import { applyStatus, removeStatus } from "../lib/db";
import { ATTR_ORDER, ATTR_LABEL, ATTR_SHORT, CAT_ORDER, CAT_LABEL, dieStr } from "../lib/constants";

const DEMO_FIELDS = [
  ["birthplace", "Место рождения"],
  ["dormitory", "Общежитие"],
  ["height", "Рост"],
  ["build", "Телосложение"],
  ["allergies", "Аллергии"],
  ["weaknesses", "Слабости"],
];

export default function CharacterCard({ ch, save, isGM, user, canAdv, onEdit, onAdvance, onLog, campaignId, campaignStatuses = [] }) {
  const toughness = ch.health?.physical?.toughness ?? derivePhysicalToughness(ch);
  // Stored energy.max falls back to derived for pre-B07 characters
  const energyMaxRaw = ch.energy?.max ?? deriveEnergyMax(ch);
  const tension = ch.tension || { current: 0, overcap: 0, energyPenalty: 0, max: 0 };
  const energyMax = Math.max(0, energyMaxRaw - (tension.energyPenalty ?? 0));
  const overflow = ch.overflow_damage ?? 0;
  const im = ch.attributes.agility.modifier + ch.attributes.smarts.modifier;
  const initStr = `d${ch.attributes.agility.die} · d${ch.attributes.smarts.die} · d6 → 2 лучших${im ? (im > 0 ? ` +${im}` : ` ${im}`) : ""}`;
  const grouped = CAT_ORDER.map(cat => ({ cat, items: (ch.skills || []).filter(s => s.categ === cat) })).filter(g => g.items.length);
  const fac = ch.faculty || {};
  const hasBio = !!ch.biography;
  const demoFields = DEMO_FIELDS.filter(([k]) => ch[k]);
  const isOwner = !!(user && ch.ownerUid && user.uid === ch.ownerUid);
  const notes = Array.isArray(ch.notes) ? ch.notes : [];
  const [noteText, setNoteText] = useState("");
  const canAddNote = isOwner || isGM;
  const [statusEditorOpen, setStatusEditorOpen] = useState(false);
  const [viewingStatus, setViewingStatus] = useState(null);
  const activeStatuses = Array.isArray(ch.activeStatuses) ? ch.activeStatuses : [];
  const showNotes = notes.length > 0 || canAddNote;

  function submitNote(e) {
    e.preventDefault();
    const text = noteText.trim();
    if (!text) return;
    save({ notes: [...notes, { text, at: new Date().toISOString() }] });
    setNoteText("");
  }

  return (
    <div className="kk-card">
      <header className="kk-head">
        <div className="kk-portrait" style={{ ["--fac-color"]: fac.color || "#c8a14e" }}>
          {ch.portrait ? <img src={ch.portrait} alt=""/> : <span className="kk-portrait-ph">{(ch.name || "?").slice(0, 1)}</span>}
        </div>
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
          {!isGM && canAdv && <button className="kk-adv-btn" onClick={onAdvance}>Прокачка</button>}
          {isGM && <button className="kk-edit-btn" onClick={onEdit}>Редактировать вручную</button>}
          {isGM && <button className="kk-edit-btn" onClick={onLog}>Логи</button>}
        </div>
      </header>

      <section className="kk-strip">
        <Stat label="Стойкость" value={toughness} tip="2 + ⌊Дух/2⌋. Считается автоматически." accent="var(--kk-gold)"/>
        <div className="kk-stat kk-stat-wide">
          <Tip text="Пул инициативы: Ловкость + Смекалка + Wild Die d6, 2 лучших. Бросок — вне карточки.">
            <span className="kk-stat-label kk-dotted">Инициатива</span>
          </Tip>
          <span className="kk-init">{initStr}</span>
        </div>
        <Stat label="Энергия" value={ch.energy.value} max={energyMax}
          onChange={(v) => save({ "energy.value": Math.max(0, Math.min(energyMax, v)) })}
          tip={tension.energyPenalty > 0 ? `Максимум = ${energyMaxRaw} − ${tension.energyPenalty} (перегруз напряжения).` : "Максимум = возраст + грань Духа."}
          accent="var(--kk-gold)"/>
        <Stat label="Жетоны судьбы" value={ch.bennies} max={9}
          onChange={isGM ? (v) => save({ bennies: Math.max(0, Math.min(9, v)) }) : undefined}
          tip={isGM ? "Старт 3, максимум 9. Выдаёт/снимает ГМ." : "Старт 3, максимум 9. Меняет только ГМ."}
          accent="var(--kk-gold)"/>
      </section>

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

      <section className="kk-block">
        <h2 className="kk-h2">Статусы</h2>
        <StatusBar
          statuses={activeStatuses}
          isGM={isGM}
          onRemove={(s) => campaignId && removeStatus(campaignId, ch.id, s).catch(console.error)}
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

      <section className="kk-block">
        <h2 className="kk-h2">Атрибуты</h2>
        <div className="kk-attrs">{ATTR_ORDER.map(k => {
          const a = ch.attributes[k];
          return (
            <div className="kk-attr" key={k}>
              <span className="kk-attr-name">{ATTR_LABEL[k]}</span>
              <span className="kk-attr-die">{dieStr(a.die, a.modifier)}</span>
            </div>
          );
        })}</div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Навыки</h2>
        {grouped.map(g => (
          <div className="kk-skill-group" key={g.cat}>
            <div className="kk-skill-cat">{CAT_LABEL[g.cat]}</div>
            <div className="kk-skills">{g.items.map(s => {
              const unt = s.die === 4 && s.modifier <= -2;
              return (
                <div className={`kk-skill ${unt ? "untrained" : ""}`} key={s.name}>
                  <span className="kk-skill-name">{s.name}</span>
                  <Tip text={`Связан с: ${ATTR_LABEL[s.attr]}. Бросок — вне карточки. Не выше атрибута.`}>
                    <span className="kk-skill-attr">{ATTR_SHORT[s.attr]}</span>
                  </Tip>
                  <span className="kk-skill-die">{dieStr(s.die, s.modifier)}</span>
                </div>
              );
            })}</div>
          </div>
        ))}
      </section>

      {(hasBio || demoFields.length > 0) && (
        <details className="kk-bio-details">
          <summary className="kk-h2 kk-bio-summary">Анкета</summary>
          <div className="kk-bio-body">
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
          </div>
        </details>
      )}

      {showNotes && (
        <section className="kk-block">
          <h2 className="kk-h2">Заметки</h2>
          {notes.length > 0 && (
            <ul className="kk-notes-list">
              {[...notes].reverse().map((n, i) => (
                <li key={i} className="kk-note-item">
                  <span className="kk-note-text">{n.text}</span>
                  <span className="kk-note-at">{new Date(n.at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
          {canAddNote && (
            <form className="kk-note-form" onSubmit={submitNote}>
              <input
                id="note-input"
                name="note"
                className="kk-note-input"
                type="text"
                placeholder="Добавить заметку…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                maxLength={500}
              />
              <button className="kk-note-btn" type="submit" disabled={!noteText.trim()}>Добавить</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
