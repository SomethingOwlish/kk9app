import { useState, useMemo } from "react";
import { applyTimeRewind } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

function parseIso(str) {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoStr(date) {
  return date.toISOString().slice(0, 10);
}

function mmdd(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function crossesMilestone(start, n, milestone) {
  if (!milestone) return false;
  for (let i = 1; i <= n; i++) {
    if (mmdd(addDays(start, i)) === milestone) return true;
  }
  return false;
}

function buildProposal(ch, campaign, n, startDate) {
  const idleXp = Math.round((campaign.idleExpPerDay ?? 1) * n);
  const salary = (campaign.salaryByGrade ?? {})[ch.academyYear] ?? 0;
  const graduateExpense = ch.academyYear === "graduate"
    ? Math.round((campaign.graduateDailyExpense ?? 0) * n) : 0;
  const moneyDelta = salary - graduateExpense;

  const healthRegen = Math.min(Math.floor(n / 7), ch.health?.physical?.value ?? 0);
  const mentalRegen = Math.min(Math.floor(n / 7), ch.health?.mental?.value ?? 0);

  const energyCap = ch.energy?.max ?? 0;
  const energyRestore = Math.max(0, energyCap - (ch.energy?.value ?? 0));

  const tensionReduce = Math.min(Math.floor(n / 3), ch.tension?.current ?? 0);

  const sb1 = crossesMilestone(startDate, n, campaign.semesterBreak1 ?? null);
  const sb2 = crossesMilestone(startDate, n, campaign.semesterBreak2 ?? null);
  const semesterBonus = (sb1 || sb2) ? (campaign.semesterBreakXp ?? 0) : 0;

  return { idleXp, salary, graduateExpense, moneyDelta, healthRegen, mentalRegen, energyRestore, tensionReduce, semesterBonus, sb1, sb2 };
}

export default function TimeRewindDialog({ campaign, partyMembers, onClose }) {
  const [step, setStep]         = useState(0);
  const [days, setDays]         = useState(7);
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState(null);

  const startDate = useMemo(() => parseIso(campaign?.gameDate), [campaign?.gameDate]);
  const newDate   = useMemo(() => startDate ? isoStr(addDays(startDate, days)) : null, [startDate, days]);

  const proposals = useMemo(() => {
    if (!campaign || !partyMembers.length || !startDate) return {};
    return Object.fromEntries(
      partyMembers.map(ch => [ch.id, buildProposal(ch, campaign, days, startDate)])
    );
  }, [campaign, partyMembers, days, startDate]);

  async function handleApply() {
    setApplying(true);
    setError(null);
    try {
      await applyTimeRewind(CAMPAIGN_ID, partyMembers, proposals, newDate, days);
      onClose();
    } catch (e) {
      setError(e?.message || "Ошибка при применении");
      setApplying(false);
    }
  }

  return (
    <div className="kk-modal-overlay" onClick={onClose}>
      <div className="kk-modal" onClick={e => e.stopPropagation()}>
        <div className="kk-modal-header">
          <span className="kk-modal-title">↺ Тайм-ревинд</span>
          <button className="kk-modal-close" onClick={onClose}>✕</button>
        </div>

        {step === 0 && (
          <div className="kk-modal-body">
            <div className="kk-field">
              <label>Прошло дней</label>
              <input
                className="kk-input"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            {startDate && newDate && (
              <div className="kk-rewind-dates">
                <span className="kk-rewind-from">{campaign.gameDate}</span>
                <span className="kk-rewind-arrow">→</span>
                <span className="kk-rewind-to">{newDate}</span>
              </div>
            )}
            {!startDate && (
              <div className="kk-empty" style={{ marginTop: 8 }}>
                Дата кампании не задана. Установите её в «Состоянии кампании».
              </div>
            )}
            {partyMembers.length === 0 && (
              <div className="kk-empty" style={{ marginTop: 8 }}>В отряде нет персонажей.</div>
            )}
            <div className="kk-modal-actions">
              <button className="kk-btn ghost" onClick={onClose}>Отмена</button>
              <button
                className="kk-btn"
                onClick={() => setStep(1)}
                disabled={!startDate || partyMembers.length === 0}
              >
                Просмотр →
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="kk-modal-body">
            <div className="kk-rewind-preview">
              {partyMembers.map(ch => {
                const p = proposals[ch.id];
                if (!p) return null;
                const totalXp = p.idleXp + p.semesterBonus;
                const noChanges = totalXp === 0 && p.moneyDelta === 0
                  && p.energyRestore === 0 && p.healthRegen === 0
                  && p.mentalRegen === 0 && p.tensionReduce === 0;
                return (
                  <div key={ch.id} className="kk-rewind-char">
                    <div
                      className="kk-rewind-char-name"
                      style={{ "--fac-color": ch.faculty?.color || "var(--kk-gold)" }}
                    >
                      {ch.name || "—"}
                    </div>
                    <div className="kk-rewind-tags">
                      {totalXp > 0 && (
                        <span className="kk-rtag xp">
                          +{totalXp} ОП{p.semesterBonus > 0 ? ` (+${p.semesterBonus} каникулы)` : ""}
                        </span>
                      )}
                      {p.moneyDelta > 0 && <span className="kk-rtag money">+{p.moneyDelta} ₴</span>}
                      {p.moneyDelta < 0 && <span className="kk-rtag money neg">{p.moneyDelta} ₴</span>}
                      {p.energyRestore > 0 && <span className="kk-rtag energy">⚡ → макс</span>}
                      {p.healthRegen > 0 && <span className="kk-rtag health">❤ −{p.healthRegen}</span>}
                      {p.mentalRegen > 0 && <span className="kk-rtag health">🧠 −{p.mentalRegen}</span>}
                      {p.tensionReduce > 0 && <span className="kk-rtag tension">⚗ −{p.tensionReduce}</span>}
                      {p.sb1 && <span className="kk-rtag break">Каникулы 1</span>}
                      {p.sb2 && <span className="kk-rtag break">Каникулы 2</span>}
                      {noChanges && <span className="kk-rtag none">без изменений</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="kk-rewind-newdate">
              Новая дата: <strong>{newDate}</strong>
            </div>
            {error && <div className="kk-error" style={{ marginTop: 8 }}>{error}</div>}
            <div className="kk-modal-actions">
              <button className="kk-btn ghost" onClick={() => setStep(0)}>← Назад</button>
              <button className="kk-btn primary" onClick={handleApply} disabled={applying}>
                {applying ? "Применяем…" : "Применить"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
