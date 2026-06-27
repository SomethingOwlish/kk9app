import { useState } from "react";
import { advSettings, DEFAULT_ADVANCEMENT } from "../lib/advancement";
import { DEFAULT_BACKGROUNDS } from "../lib/chargen";
import { seedStatuses, createStatus } from "../lib/db";
import { STATUSES_DATA } from "../lib/seed-statuses";
import StatusCard from "./StatusCard";

const DIE_OPTIONS = [4, 6, 8, 10, 12];

const DEFAULT_CHARGEN = {
  points: { attributes: 5, skills: 10 },
  attr: { maxDie: 8 },
  convert: { attrToSkill: 5 },
  special: { cost: 3, max: 1 },
  skills: { maxSave: 2 },
  backgrounds: "",
};

function SettingsField({ label, value, onChange, step }) {
  return (
    <label className="kk-field"><span>{label}</span>
      <input className="kk-input sm" type="number" step={step || 1} value={value} onChange={onChange}/>
    </label>
  );
}

function parseChargen(campaign) {
  const cg = campaign?.chargen || {};
  return {
    points:  { attributes: cg.points?.attributes ?? 5, skills: cg.points?.skills ?? 10 },
    attr:    { maxDie: cg.attr?.maxDie ?? 8 },
    convert: { attrToSkill: cg.convert?.attrToSkill ?? 5 },
    special: { cost: cg.special?.cost ?? 3, max: cg.special?.max ?? 1 },
    skills:  { maxSave: cg.skills?.maxSave ?? 2 },
    backgrounds: cg.backgrounds ?? "",
  };
}

function parseRewind(campaign) {
  return {
    idleExpPerDay:        campaign?.idleExpPerDay        ?? 5,
    graduateDailyExpense: campaign?.graduateDailyExpense ?? 0,
    salaryByGrade:        campaign?.salaryByGrade        ?? {},
    semesterBreak1:       campaign?.semesterBreak1       ?? "",
    semesterBreak2:       campaign?.semesterBreak2       ?? "",
  };
}

export default function CampaignSettings({ campaign, advancementConfig, onSave, onClose, campaignId, campaignStatuses = [] }) {
  const [d, setD] = useState(() => advSettings(advancementConfig));
  const [cg, setCg] = useState(() => parseChargen(campaign));
  const [rw, setRw] = useState(() => parseRewind(campaign));
  const [journalThreshold, setJournalThreshold] = useState(() => campaign?.journalArchiveThreshold ?? 20);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [editingStatus, setEditingStatus] = useState(null);
  const [creating, setCreating] = useState(false);

  async function handleSeedStatuses() {
    if (!campaignId) return;
    setSeeding(true); setSeedMsg("");
    try {
      const count = await seedStatuses(campaignId, STATUSES_DATA);
      setSeedMsg(count === STATUSES_DATA.length
        ? `Загружено ${count} статусов.`
        : `Уже загружено (${campaignStatuses.length} статусов в базе).`);
    } catch (e) { setSeedMsg("Ошибка: " + e.message); }
    finally { setSeeding(false); }
  }

  async function handleCreateStatus() {
    if (!campaignId) return;
    setCreating(true);
    try {
      await createStatus(campaignId, {
        name: "Новый статус",
        status_types: [],
        duration: { mode: "time", value: 1, auto_reduce: false },
        effects: [],
        progresses: false,
        progress_every: 1,
        progress_into_names: [],
        description: "",
        removal_instruction: "",
      });
    } catch (e) { alert("Ошибка: " + e.message); }
    finally { setCreating(false); }
  }

  const setIn = (g, k, v) => setD(p => ({ ...p, [g]: { ...p[g], [k]: v } }));
  const setCgIn = (g, k, v) => setCg(p => ({ ...p, [g]: { ...p[g], [k]: v } }));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const field = (label, g, k, step) => (
    <SettingsField label={label} value={d[g][k]} step={step} onChange={e => setIn(g, k, num(e.target.value))}/>
  );
  const cgField = (label, g, k, step) => (
    <SettingsField label={label} value={cg[g][k]} step={step} onChange={e => setCgIn(g, k, num(e.target.value))}/>
  );

  function handleSave() {
    onSave({ advancement: d, chargen: cg, rewind: rw, journalArchiveThreshold: journalThreshold });
  }

  return (
    <div className="kk-edit">
      <div className="kk-edit-bar">
        <span className="kk-edit-title">Настройки кампании</span>
        <div className="kk-edit-actions">
          <button className="kk-btn ghost" onClick={onClose}>Закрыть</button>
          <button className="kk-btn primary" onClick={handleSave}>Сохранить</button>
        </div>
      </div>

      <section className="kk-block">
        <h2 className="kk-h2">Создание персонажа</h2>
        <p className="kk-note">Параметры мастера создания — влияют только на новых персонажей.</p>
        <div className="kk-form-grid">
          {cgField("Очков атрибутов", "points", "attributes")}
          {cgField("Очков навыков", "points", "skills")}
          {cgField("Конвертация атр→нав", "convert", "attrToSkill")}
          {cgField("Цена спецспособности", "special", "cost")}
          {cgField("Макс. спецспособностей", "special", "max")}
          {cgField("Макс. сохранённых очков", "skills", "maxSave")}
        </div>
        <label className="kk-field" style={{ marginTop: 8 }}>
          <span>Макс. кубик атрибута/навыка</span>
          <select
            className="kk-input sm"
            value={cg.attr.maxDie}
            onChange={e => setCgIn("attr", "maxDie", Number(e.target.value))}
          >
            {DIE_OPTIONS.map(n => <option key={n} value={n}>d{n}</option>)}
          </select>
        </label>
        <label className="kk-field" style={{ marginTop: 8, flexDirection: "column", alignItems: "flex-start" }}>
          <span>Бэкграунды (JSON, пусто = дефолт)</span>
          <textarea
            className="kk-input kk-textarea"
            rows={4}
            value={cg.backgrounds}
            placeholder={JSON.stringify(DEFAULT_BACKGROUNDS, null, 2)}
            onChange={e => setCg(p => ({ ...p, backgrounds: e.target.value }))}
          />
        </label>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Прокачка · Атрибуты</h2>
        <p className="kk-note">Кубик: цена шага = база × № шага от d4. Мод: база × новый мод.</p>
        <div className="kk-form-grid">
          {field("База кубика", "attr", "dieCostBase")}
          {field("База мода", "attr", "modCostBase")}
          {field("Снятие штрафа", "attr", "negModCost")}
          {field("Потолок мода d20 (+N)", "attr", "d20ModCap")}
        </div>
      </section>
      <section className="kk-block">
        <h2 className="kk-h2">Прокачка · Навыки</h2>
        <p className="kk-note">Кубик: база × (№ шага +1). Мод: база × (2 × новый мод). Всё ×множитель категории.</p>
        <div className="kk-form-grid">
          {field("База кубика", "abil", "dieCostBase")}
          {field("База мода", "abil", "modCostBase")}
          {field("Снятие −1", "abil", "negModCost")}
        </div>
      </section>
      <section className="kk-block">
        <h2 className="kk-h2">Прокачка · Множители навыков</h2>
        <div className="kk-form-grid">
          {field("Общие", "catMult", "common", 0.1)}
          {field("Изученные", "catMult", "learned", 0.1)}
          {field("Магические", "catMult", "magic", 0.1)}
          {field("Личные", "catMult", "personal", 0.1)}
        </div>
      </section>
      <section className="kk-block">
        <h2 className="kk-h2">Тайм-ревинд</h2>
        <p className="kk-note">Начисляется автоматически при тайм-ревинде за каждый прошедший день.</p>
        <div className="kk-form-grid">
          <SettingsField
            label="Опыт в день (простой)"
            step={0.5}
            value={rw.idleExpPerDay}
            onChange={e => setRw(p => ({ ...p, idleExpPerDay: Number(e.target.value) || 0 }))}
          />
          <SettingsField
            label="Расходы выпускника/день (₴)"
            value={rw.graduateDailyExpense}
            onChange={e => setRw(p => ({ ...p, graduateDailyExpense: Number(e.target.value) || 0 }))}
          />
          {[1, 2, 3, 4].map(grade => (
            <SettingsField
              key={grade}
              label={`Стипендия ${grade} курс (₴/день)`}
              value={rw.salaryByGrade[grade] ?? 0}
              onChange={e => setRw(p => ({
                ...p,
                salaryByGrade: { ...p.salaryByGrade, [String(grade)]: Number(e.target.value) || 0 },
              }))}
            />
          ))}
        </div>
        <div className="kk-form-grid" style={{ marginTop: 12 }}>
          <label className="kk-field">
            <span>Каникулы 1 (ММ-ДД)</span>
            <input
              className="kk-input sm"
              type="text"
              placeholder="01-15"
              value={rw.semesterBreak1}
              onChange={e => setRw(p => ({ ...p, semesterBreak1: e.target.value }))}
            />
          </label>
          <label className="kk-field">
            <span>Каникулы 2 (ММ-ДД)</span>
            <input
              className="kk-input sm"
              type="text"
              placeholder="06-01"
              value={rw.semesterBreak2}
              onChange={e => setRw(p => ({ ...p, semesterBreak2: e.target.value }))}
            />
          </label>
        </div>
        {rw.idleExpPerDay > 0 && (
          <p className="kk-note" style={{ marginTop: 8 }}>
            За неделю простоя: {(rw.idleExpPerDay * 7).toFixed(1)} опыта
          </p>
        )}
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Журнал</h2>
        <p className="kk-note">После достижения лимита старые записи автоматически архивируются.</p>
        <div className="kk-form-grid">
          <SettingsField
            label="Лимит страниц до архивации"
            value={journalThreshold}
            onChange={e => setJournalThreshold(Number(e.target.value) || 20)}
          />
        </div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Журнал</h2>
        <p className="kk-note">После достижения лимита старые записи автоматически архивируются.</p>
        <div className="kk-form-grid">
          <SettingsField
            label="Лимит страниц до архивации"
            value={journalThreshold}
            onChange={e => setJournalThreshold(Number(e.target.value) || 20)}
          />
        </div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Статусы</h2>
        <p className="kk-note">Библиотека статусов кампании. Загрузите стандартный набор или создайте свои.</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="kk-btn" onClick={handleSeedStatuses} disabled={seeding}>
            {seeding ? "Загрузка…" : `Загрузить стандартные (${STATUSES_DATA.length})`}
          </button>
          <button className="kk-btn" onClick={handleCreateStatus} disabled={creating}>
            {creating ? "…" : "+ Новый статус"}
          </button>
          {seedMsg && <span className="kk-note" style={{ margin: 0 }}>{seedMsg}</span>}
        </div>

        {campaignStatuses.length > 0 && (
          <div className="kk-status-def-list">
            {[...campaignStatuses].sort((a, b) => a.name.localeCompare(b.name, "ru")).map(s => (
              <div key={s.id} className="kk-status-def-row" onClick={() => setEditingStatus(s)}>
                <span className="kk-status-def-name">{s.name}</span>
                <span className="kk-status-def-dur">
                  {s.duration?.mode === "time" ? "время" : s.duration?.mode === "charges" ? `${s.duration.value} зарядов` : `${s.duration.value} раундов`}
                </span>
                {s.effects?.length > 0 && (
                  <span className="kk-status-def-efx">{s.effects.length} эфф.</span>
                )}
              </div>
            ))}
          </div>
        )}
        {campaignStatuses.length === 0 && (
          <div className="kk-empty-sm">Статусы не загружены. Нажмите «Загрузить стандартные».</div>
        )}
      </section>

      {editingStatus && (
        <StatusCard
          status={editingStatus}
          campaignId={campaignId}
          isGM={true}
          onClose={() => setEditingStatus(null)}
        />
      )}

      <div className="kk-edit-foot">
        <button className="kk-btn ghost" onClick={() => { setD(structuredClone(DEFAULT_ADVANCEMENT)); setCg(structuredClone(DEFAULT_CHARGEN)); setJournalThreshold(20); }}>Сбросить к дефолтам</button>
        <button className="kk-btn primary" onClick={handleSave}>Сохранить</button>
      </div>
    </div>
  );
}
