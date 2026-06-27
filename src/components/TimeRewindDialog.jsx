import { useState } from "react";
import { buildTimeRewindProposals, applyTimeRewind, addJournalPage } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

function fmt(n) {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

export default function TimeRewindDialog({ campaign, partyMembers, onClose }) {
  const [step, setStep] = useState(1); // 1=days, 2=review, 3=done
  const [days, setDays] = useState(1);
  const [proposals, setProposals] = useState([]);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const buildProposals = () => {
    const p = buildTimeRewindProposals(partyMembers, days, campaign);
    setProposals(p);
    setStep(2);
  };

  const apply = async () => {
    setBusy(true);
    try {
      const res = await applyTimeRewind(CAMPAIGN_ID, proposals, days, campaign.gameDate);
      setResults(res);
      // Write campaign journal entry (non-critical)
      addJournalPage(CAMPAIGN_ID, "campaign", {
        title: `Тайм-ревинд: +${days} дн.`,
        body: proposals.map(p =>
          `${p.name}: опыт ${fmt(p.xpDelta)}, деньги ${fmt(p.moneyDelta)}, напряжение ${fmt(p.tensionDelta)}`
        ).join("\n"),
      }).catch(() => {});
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
            <p className="kk-modal-hint">Сколько дней прошло с последней сессии?</p>
            <div className="kk-modal-days-row">
              <button className="kk-step" onClick={() => setDays(d => Math.max(1, d - 1))}>−</button>
              <input
                className="kk-input kk-modal-days-input"
                type="number"
                min={1}
                value={days}
                onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
              />
              <button className="kk-step" onClick={() => setDays(d => d + 1)}>+</button>
              <span className="kk-modal-days-label">дн.</span>
            </div>
            {partyMembers.length === 0 && <div className="kk-modal-warn">В отряде нет персонажей.</div>}
            <div className="kk-modal-foot">
              <button className="kk-btn ghost sm" onClick={onClose}>Отмена</button>
              <button className="kk-btn primary sm" disabled={partyMembers.length === 0} onClick={buildProposals}>Далее →</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="kk-modal-body">
            <p className="kk-modal-hint">Изменения за <b>{days}</b> дн.:</p>
            <div className="kk-rw-table">
              <div className="kk-rw-header">
                <span>Персонаж</span>
                <span title="Опыт">XP</span>
                <span title="Деньги">₽</span>
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
            <p className="kk-modal-hint">Тайм-ревинд завершён.</p>
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
