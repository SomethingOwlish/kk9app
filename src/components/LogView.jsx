import { useState, useEffect } from "react";
import { watchCharacterLog } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

function fmtDate(at) {
  if (!at?.toDate) return "…";
  return at.toDate().toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ATTR_LABELS = {
  agility: "Ловкость", smarts: "Смекалка", spirit: "Дух",
  endurance: "Выносливость", magic: "Магия",
};
const GENDER_LABELS = { m: "М", f: "Ж", nb: "Нонбинари" };

// ── Per-type card renderers ─────────────────────────────────

function ChargenCard({ e }) {
  const raised = (e.skills || []).filter(s => s.die > 4 || s.modifier > -2);
  return (
    <div className="kk-log kk-log--chargen">
      <div className="kk-log-head">
        <span className="kk-log-type-tag chargen">Создание персонажа</span>
        <span className="kk-log-date">{fmtDate(e.at)}</span>
      </div>

      {e.identity && (
        <div className="kk-log-section">
          <div className="kk-log-section-title">Личность</div>
          <div className="kk-log-grid">
            {e.identity.age && <span>Возраст: <strong>{e.identity.age}</strong></span>}
            {e.identity.gender && <span>Пол: <strong>{GENDER_LABELS[e.identity.gender] || e.identity.gender}</strong></span>}
            {e.identity.birthplace && <span>Место рождения: <strong>{e.identity.birthplace}</strong></span>}
            {e.identity.height && <span>Рост: <strong>{e.identity.height}</strong></span>}
          </div>
        </div>
      )}

      {e.attributes && (
        <div className="kk-log-section">
          <div className="kk-log-section-title">
            Атрибуты
            {e.attrSave && <span className="kk-log-badge">1 очко → навыки</span>}
          </div>
          <div className="kk-log-grid">
            {Object.entries(e.attributes).map(([k, v]) => (
              <span key={k}>{ATTR_LABELS[k] || k}: <strong>{v}</strong></span>
            ))}
          </div>
        </div>
      )}

      {raised.length > 0 && (
        <div className="kk-log-section">
          <div className="kk-log-section-title">Вложения в навыки</div>
          <div className="kk-log-tags">
            {raised.map(s => (
              <span key={s.name} className="kk-log-skill-tag">
                {s.name} d{s.die}{s.modifier !== 0 ? (s.modifier > 0 ? "+" : "") + s.modifier : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {e.specCount > 0 && (
        <div className="kk-log-section">
          <div className="kk-log-section-title">Запрос спецспособностей</div>
          <span>{e.specCount} шт.</span>
        </div>
      )}

      {e.backgrounds?.length > 0 && (
        <div className="kk-log-section">
          <div className="kk-log-section-title">Бэкграунды</div>
          {e.backgrounds.map(bg => (
            <div key={bg.key} className="kk-log-bg-row">
              <strong>{bg.label}</strong>
              {bg.notes && <span className="kk-log-bg-notes"> — {bg.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdvancementCard({ e }) {
  return (
    <div className="kk-log kk-log--advancement">
      <div className="kk-log-head">
        <span className="kk-log-type-tag advancement">Прокачка</span>
        <span className="kk-log-date">{fmtDate(e.at)}</span>
        <span className="kk-log-spent">−{e.spent} опыта</span>
      </div>
      <div className="kk-log-changes">
        {(e.changes || []).map((c, j) => (
          <div className="kk-log-row" key={j}>
            <span className="kk-log-kind">{c.kind === "attr" ? "атрибут" : "навык"}</span>
            <span className="kk-log-name">{c.name}</span>
            <span className="kk-log-delta">{c.from} → {c.to}</span>
            <span className="kk-log-cost">{c.spent}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BioLogCard({ e }) {
  const fields = Array.isArray(e.fields) ? e.fields : [];
  return (
    <div className="kk-log kk-log--bio">
      <div className="kk-log-head">
        <span className="kk-log-type-tag bio">Анкета</span>
        <span className="kk-log-date">{fmtDate(e.at)}</span>
      </div>
      <div className="kk-log-section">
        {fields.length > 0 ? (
          <div className="kk-log-tags">
            {fields.map((f, i) => <span key={i} className="kk-log-skill-tag">{f}</span>)}
          </div>
        ) : (
          <span>Сохранено без изменений</span>
        )}
      </div>
    </div>
  );
}

const TYPE_TAG_LABEL = { request_applied: "Заявка" };

function UnknownCard({ e }) {
  return (
    <div className="kk-log">
      <div className="kk-log-head">
        <span className="kk-log-type-tag">{TYPE_TAG_LABEL[e.type] || e.type || "запись"}</span>
        <span className="kk-log-date">{fmtDate(e.at)}</span>
      </div>
      {e.detail && <div className="kk-log-body"><span>{e.detail}</span></div>}
    </div>
  );
}

function renderEntry(e) {
  if (e.type === "chargen_created") return <ChargenCard key={e.id} e={e} />;
  if (e.type === "bio_edit") return <BioLogCard key={e.id} e={e} />;
  if (!e.type || e.type === "advancement") return <AdvancementCard key={e.id} e={e} />;
  return <UnknownCard key={e.id} e={e} />;
}

// ── Tabs ────────────────────────────────────────────────────

const TABS = [
  { id: "all",             label: "Все" },
  { id: "chargen_created", label: "Создание" },
  { id: "advancement",     label: "Прокачка" },
  { id: "bio_edit",        label: "Анкета" },
];

function tabMatches(tabId, e) {
  if (tabId === "all") return true;
  if (tabId === "advancement") return !e.type || e.type === "advancement";
  return e.type === tabId;
}

// ── Main ────────────────────────────────────────────────────

export default function LogView({ char, onClose, onClear }) {
  const [entries, setEntries] = useState(null);
  const [tab, setTab] = useState("all");
  useEffect(() => watchCharacterLog(CAMPAIGN_ID, char.id, setEntries), [char.id]);

  const visible = entries ? entries.filter(e => tabMatches(tab, e)) : [];

  return (
    <div className="kk-edit">
      <div className="kk-edit-bar">
        <span className="kk-edit-title">Лог · {char.name}</span>
        <div className="kk-edit-actions">
          <button className="kk-btn ghost" onClick={onClose}>Назад</button>
          <button className="kk-btn danger" disabled={!entries?.length}
            onClick={() => { if (window.confirm("Удалить все записи лога?")) onClear(); }}>
            Удалить записи
          </button>
        </div>
      </div>

      <div className="kk-log-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`kk-log-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {entries && (
              <span className="kk-log-tab-count">
                {entries.filter(e => tabMatches(t.id, e)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {entries === null && <div className="kk-load">Загрузка…</div>}
      {entries !== null && visible.length === 0 && (
        <div className="kk-empty">Записей пока нет.</div>
      )}
      <div className="kk-log-list">
        {visible.map(renderEntry)}
      </div>
    </div>
  );
}
