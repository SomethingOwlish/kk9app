import { useState } from "react";
import { advSettings, DEFAULT_ADVANCEMENT } from "../lib/advancement";
import { DEFAULT_BACKGROUNDS } from "../lib/chargen";
import { seedStatuses, createStatus, seedItems } from "../lib/db";
import { STATUSES_DATA } from "../lib/seed-statuses";
import { WEAPONS_DATA } from "../lib/seed-weapons";
import { GEAR_DATA } from "../lib/seed-gear";
import { ARTIFACTS_DATA } from "../lib/seed-artifacts";
import { SPELLS_DATA } from "../lib/seed-spells";
import { DEVICES_DATA } from "../lib/seed-devices";
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

function parseExtra(campaign) {
  return {
    tension: {
      overflowThreshold:  campaign?.tension?.overflowThreshold  ?? 5,
      overcapPenalty:     campaign?.tension?.overcapPenalty     ?? 10,
      failureThreshold:   campaign?.tension?.failureThreshold   ?? 3,
      heavyAbilityWeight: campaign?.tension?.heavyAbilityWeight ?? 2,
      heavyAbilities:     campaign?.tension?.heavyAbilities     ?? "",
      lightAbilities:     campaign?.tension?.lightAbilities     ?? "",
    },
    shop: {
      defaultItemPrice: campaign?.shop?.defaultItemPrice ?? 100,
      defaultShopId:    campaign?.shop?.defaultShopId    ?? "",
    },
    scene: {
      allowPlayerEmotions: campaign?.scene?.allowPlayerEmotions ?? false,
    },
    combat: {
      allowGlobalOvercap: campaign?.combat?.allowGlobalOvercap ?? false,
    },
    magic: {
      aoeEnergyCostMultiplier: campaign?.magic?.aoeEnergyCostMultiplier ?? 1.5,
    },
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

const THEMES = [
  { key: "original",      label: "Original",  bg: "#181410", accent: "#c8a14e", tone: "dark" },
  { key: "parchment",     label: "Parchment", bg: "#efe6d4", accent: "#b08526", tone: "light" },
  { key: "arcane",        label: "Arcane ☽",  bg: "#0f1226", accent: "#5fd3e6", tone: "dark" },
  { key: "arcane-light",  label: "Arcane ☀",  bg: "#eef1fb", accent: "#2c8aa0", tone: "light" },
  { key: "verdant",       label: "Verdant ☽", bg: "#0f1a14", accent: "#4fc07e", tone: "dark" },
  { key: "verdant-light", label: "Verdant ☀", bg: "#eef4ec", accent: "#2f9b5e", tone: "light" },
  { key: "blood",         label: "Blood ☽",   bg: "#16100f", accent: "#d9534a", tone: "dark" },
  { key: "blood-light",   label: "Blood ☀",   bg: "#f6ece9", accent: "#c23a32", tone: "light" },
];

export default function CampaignSettings({ campaign, advancementConfig, onSave, onClose, campaignId, campaignStatuses = [], isGM = true, theme = "original", onThemeChange }) {
  const [d, setD] = useState(() => advSettings(advancementConfig));
  const [cg, setCg] = useState(() => parseChargen(campaign));
  const [rw, setRw] = useState(() => parseRewind(campaign));
  const [ex, setEx] = useState(() => parseExtra(campaign));
  const [journalThreshold, setJournalThreshold] = useState(() => campaign?.journalArchiveThreshold ?? 20);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [seedingItems, setSeedingItems] = useState({});
  const [seedItemMsg, setSeedItemMsg] = useState({});

  async function handleSeedItems(type, data) {
    if (!campaignId) return;
    setSeedingItems(p => ({ ...p, [type]: true }));
    setSeedItemMsg(p => ({ ...p, [type]: "" }));
    try {
      await seedItems(campaignId, data, type);
      setSeedItemMsg(p => ({ ...p, [type]: `Загружено ${data.length} записей.` }));
    } catch (e) {
      setSeedItemMsg(p => ({ ...p, [type]: "Ошибка: " + e.message }));
    } finally {
      setSeedingItems(p => ({ ...p, [type]: false }));
    }
  }
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
    onSave({ advancement: d, chargen: cg, rewind: rw, journalArchiveThreshold: journalThreshold, extra: ex });
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
        <h2 className="kk-h2">Цветовая схема</h2>
        <p className="kk-note">Личная настройка — видна только вам.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {THEMES.map(t => {
            const active = t.key === (theme || "original");
            return (
              <button
                key={t.key}
                onClick={() => onThemeChange?.(t.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "6px 11px 6px 7px", borderRadius: 9,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  color: active ? "var(--kk-text)" : "var(--kk-text-dim)",
                  background: active ? "var(--kk-surface-2)" : "transparent",
                  border: active ? "1px solid var(--kk-gold-dim)" : "1px solid var(--kk-line-soft)",
                  boxShadow: active ? `0 0 0 1px ${t.accent} inset` : "none",
                  transition: "background .15s, color .15s",
                }}
              >
                <span style={{ display: "inline-flex", borderRadius: 4, overflow: "hidden", border: "1px solid rgba(128,100,60,.3)", flexShrink: 0 }}>
                  <span style={{ width: 11, height: 16, background: t.bg, display: "block" }} />
                  <span style={{ width: 11, height: 16, background: t.accent, display: "block" }} />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {isGM && <>
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
        <h2 className="kk-h2">Напряжение</h2>
        <p className="kk-note">Пороги и модификаторы системы напряжения.</p>
        <div className="kk-form-grid">
          <SettingsField label="Порог оверкапа" value={ex.tension.overflowThreshold} onChange={e => setEx(p => ({ ...p, tension: { ...p.tension, overflowThreshold: Number(e.target.value) || 0 } }))}/>
          <SettingsField label="Штраф при оверкапе" value={ex.tension.overcapPenalty} onChange={e => setEx(p => ({ ...p, tension: { ...p.tension, overcapPenalty: Number(e.target.value) || 0 } }))}/>
          <SettingsField label="Порог провала" value={ex.tension.failureThreshold} onChange={e => setEx(p => ({ ...p, tension: { ...p.tension, failureThreshold: Number(e.target.value) || 0 } }))}/>
          <SettingsField label="Вес тяжёлых способностей" step={0.5} value={ex.tension.heavyAbilityWeight} onChange={e => setEx(p => ({ ...p, tension: { ...p.tension, heavyAbilityWeight: Number(e.target.value) || 0 } }))}/>
        </div>
        <label className="kk-field" style={{ marginTop: 8, flexDirection: "column", alignItems: "flex-start" }}>
          <span>Тяжёлые способности (через запятую; пусто = TENSION_ABILITIES)</span>
          <input className="kk-input" value={ex.tension.heavyAbilities} onChange={e => setEx(p => ({ ...p, tension: { ...p.tension, heavyAbilities: e.target.value } }))} placeholder="Телекинез, Огненный шар…"/>
        </label>
        <label className="kk-field" style={{ marginTop: 8, flexDirection: "column", alignItems: "flex-start" }}>
          <span>Лёгкие способности (через запятую)</span>
          <input className="kk-input" value={ex.tension.lightAbilities} onChange={e => setEx(p => ({ ...p, tension: { ...p.tension, lightAbilities: e.target.value } }))} placeholder="Восприятие, Убеждение…"/>
        </label>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Магазин и бой</h2>
        <div className="kk-form-grid">
          <SettingsField label="Цена по умолчанию (₴)" value={ex.shop.defaultItemPrice} onChange={e => setEx(p => ({ ...p, shop: { ...p.shop, defaultItemPrice: Number(e.target.value) || 0 } }))}/>
          <SettingsField label="Коэф. AoE заклинаний" step={0.1} value={ex.magic.aoeEnergyCostMultiplier} onChange={e => setEx(p => ({ ...p, magic: { ...p.magic, aoeEnergyCostMultiplier: Number(e.target.value) || 1 } }))}/>
        </div>
        <label className="kk-field" style={{ marginTop: 8, flexDirection: "column", alignItems: "flex-start" }}>
          <span>ID основного магазина (виден игрокам)</span>
          <input className="kk-input" value={ex.shop.defaultShopId} onChange={e => setEx(p => ({ ...p, shop: { ...p.shop, defaultShopId: e.target.value } }))} placeholder="firestore doc id"/>
        </label>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="kk-field kk-field--cb">
            <input type="checkbox" checked={ex.combat.allowGlobalOvercap} onChange={e => setEx(p => ({ ...p, combat: { ...p.combat, allowGlobalOvercap: e.target.checked } }))}/>
            <span>Разрешить глобальный оверкап урона</span>
          </label>
          <label className="kk-field kk-field--cb">
            <input type="checkbox" checked={ex.scene.allowPlayerEmotions} onChange={e => setEx(p => ({ ...p, scene: { ...p.scene, allowPlayerEmotions: e.target.checked } }))}/>
            <span>Игрок может управлять эмоцией портрета</span>
          </label>
        </div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Предметы — стандартные данные</h2>
        <p className="kk-note">Загружает стандартный набор предметов в каталог. Если предметы этого типа уже есть — пропускает.</p>
        {[
          ["weapon",   "Оружие",      WEAPONS_DATA],
          ["gear",     "Снаряжение",  GEAR_DATA],
          ["artifact", "Артефакты",   ARTIFACTS_DATA],
          ["spell",    "Заклинания",  SPELLS_DATA],
          ["device",   "Устройства",  DEVICES_DATA],
        ].map(([type, label, data]) => (
          <div key={type} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button className="kk-btn" onClick={() => handleSeedItems(type, data)} disabled={seedingItems[type]}>
              {seedingItems[type] ? "Загрузка…" : `${label} (${data.length})`}
            </button>
            {seedItemMsg[type] && <span className="kk-note" style={{ margin: 0 }}>{seedItemMsg[type]}</span>}
          </div>
        ))}
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
      </>}

      <div className="kk-edit-foot">
        <button className="kk-btn ghost" onClick={() => { setD(structuredClone(DEFAULT_ADVANCEMENT)); setCg(structuredClone(DEFAULT_CHARGEN)); setJournalThreshold(20); }}>Сбросить к дефолтам</button>
        <button className="kk-btn primary" onClick={handleSave}>Сохранить</button>
      </div>
    </div>
  );
}
