import { useState } from "react";
import { buildTimeRewindProposals, applyTimeRewind, addJournalPage } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

function fmt(n) {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

function daysBetween(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function addDays(dateStr, days) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function TimeRewindDialog({ campaign, partyMembers, onClose }) {
  const currentDate = campaign?.gameDate ?? "";
  const [step, setStep] = useState(1);
  const [targetDate, setTargetDate] = useState(() => addDays(currentDate, 1));
  const [worldNewsTitle, setWorldNewsTitle] = useState("");
  const [worldNewsText, setWorldNewsText]   = useState("");
  const [proposals, setProposals] = useState([]);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const days = daysBetween(currentDate, targetDate);

  const buildProposals = () => {
    const p = buildTimeRewindProposals(partyMembers, days, campaign);
    setProposals(p);
    setStep(2);
  };

  const apply = async () => {
    setBusy(true);
    try {
      // applyTimeRewind uses targetDate directly instead of computing from days
      const res = await applyTimeRewind(CAMPAIGN_ID, proposals, days, currentDate, targetDate);
      setResults(res);
      addJournalPage(CAMPAIGN_ID, "campaign", {
        title: `Тайм-ревинд: ${currentDate} → ${targetDate}`,
        body: proposals.map(p =>
          `${p.name}: опыт ${fmt(p.xpDelta)}, деньги ${fmt(p.moneyDelta)}, напряжение ${fmt(p.tensionDelta)}`
        ).join("\n"),
      }).catch(() => {});
      if (worldNewsText.trim()) {
        addJournalPage(CAMPAIGN_ID, "worldNews", {
          title: worldNewsTitle.trim() || `Новости (${targetDate})`,
          body: worldNewsText.trim(),
        }).catch(() => {});
      }
      setStep(3);
    } catch (e) {
      alert("Ошибка тайм-ревинда: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kk-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kk-modal">
        <div className="kk-modal-head">
          <span className="kk-modal-title">Тайм-ревинд</span>
          <button className="kk-modal-x" onClick={onClose}>✕</button>
        </div>

        {step === 1 && (
          <div className="kk-modal-body">
            <div className="kk-form-grid">
              <div className="kk-field">
                <label>Текущая дата</label>
                <input className="kk-input" type="date" value={currentDate} readOnly/>
              </div>
              <div className="kk-field">
                <label>Новая дата</label>
                <input
                  className="kk-input"
                  type="date"
                  value={targetDate}
                  min={currentDate || undefined}
                  onChange={e => setTargetDate(e.target.value)}
                />
              </div>
            </div>
            {days > 0 && (
              <p className="kk-modal-hint" style={{ marginTop: 8 }}>
                Пройдёт дней: <b>{days}</b>
              </p>
            )}
            {days === 0 && targetDate && (
              <p className="kk-modal-hint kk-warn" style={{ marginTop: 8 }}>
                Новая дата должна быть позже текущей.
              </p>
            )}

            <div className="kk-field" style={{ marginTop: 12 }}>
              <label>Мировые новости — заголовок (необязательно)</label>
              <input
                className="kk-input"
                placeholder={`Новости (${targetDate || "дата"})`}
                value={worldNewsTitle}
                onChange={e => setWorldNewsTitle(e.target.value)}
              />
            </div>
            <div className="kk-field" style={{ marginTop: 8 }}>
              <label>Мировые новости — текст (необязательно)</label>
              <textarea
                className="kk-input kk-textarea"
                rows={4}
                placeholder="Что произошло в мире за это время…"
                value={worldNewsText}
                onChange={e => setWorldNewsText(e.target.value)}
              />
            </div>

            {partyMembers.length === 0 && <div className="kk-modal-warn">В отряде нет персонажей.</div>}
            <div className="kk-modal-foot">
              <button className="kk-btn ghost sm" onClick={onClose}>Отмена</button>
              <button
                className="kk-btn primary sm"
                disabled={partyMembers.length === 0 || days === 0}
                onClick={buildProposals}
              >
                Далее →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="kk-modal-body">
            <p className="kk-modal-hint">
              Изменения за <b>{days}</b> дн. ({currentDate} → {targetDate}):
            </p>
            <div className="kk-rw-table">
              <div className="kk-rw-header">
                <span>Персонаж</span>
                <span title="Опыт">XP</span>
                <span title="Деньги">₴</span>
                <span title="Напряжение">Напр</span>
                <span>Энерг</span>
                <span>HP</span>
              </div>
              {proposals.map(p => (
                <div key={p.charId} className="kk-rw-row">
                  <span className="kk-rw-name">{p.name}</span>
                  <span className="kk-rw-pos">{fmt(p.xpDelta)}</span>
                  <span className={p.moneyDelta >= 0 ? "kk-rw-pos" : "kk-rw-neg"}>{fmt(p.moneyDelta)}</span>
                  <span className={p.tensionDelta < 0 ? "kk-rw-pos" : ""}>{fmt(p.tensionDelta)}</span>
                  <span className="kk-rw-pos">→ {p.energyTo}</span>
                  <span className="kk-rw-pos">↺</span>
                </div>
              ))}
            </div>
            {worldNewsText.trim() && (
              <p className="kk-modal-hint" style={{ marginTop: 8 }}>
                Мировые новости будут записаны в журнал.
              </p>
            )}
            <div className="kk-modal-foot">
              <button className="kk-btn ghost sm" onClick={() => setStep(1)}>← Назад</button>
              <button className="kk-btn primary sm" disabled={busy} onClick={apply}>
                {busy ? "Применяем…" : "Применить"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="kk-modal-body">
            <p className="kk-modal-hint">Тайм-ревинд завершён. Новая дата: <b>{targetDate}</b></p>
            <div className="kk-rw-results">
              {results.map(r => (
                <div key={r.charId} className={`kk-rw-result ${r.ok ? "ok" : "fail"}`}>
                  <span>{r.ok ? "✓" : "✗"}</span>
                  <span>{proposals.find(p => p.charId === r.charId)?.name}</span>
                  {!r.ok && <span className="kk-rw-err">{r.error}</span>}
                </div>
              ))}
            </div>
            <div className="kk-modal-foot">
              <button className="kk-btn primary sm" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
