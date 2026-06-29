import { useState, useCallback } from "react";
import { updateCharacterNow } from "../lib/db";
import { tensionAdjustPatch, tensionClearPatch, tensionSettings } from "../lib/tension";

export default function PartyRow({ ch, campaignId, campaign, onOpen, onRemove }) {
  const [modal, setModal] = useState(null); // 'xp' | 'money' | null
  const [modalVal, setModalVal] = useState("");

  const col = ch.faculty?.color || "var(--kk-gold)";
  const physFilled = ch.health?.physical?.value ?? 0;
  const mentFilled = ch.health?.mental?.value ?? 0;
  const energyCur = ch.energy?.value ?? 0;
  const penalty = ch.tension?.energyPenalty ?? 0;
  const energyMax = Math.max(0, (ch.energy?.max ?? 0) - penalty);
  const tension = ch.tension?.current ?? 0;
  const overcap = ch.tension?.overcap ?? 0;
  const tensionMax = ch.tension?.max ?? 0;
  const settings = tensionSettings(campaign);

  const quick = useCallback((patch) => {
    updateCharacterNow(campaignId, ch.id, patch).catch(console.error);
  }, [campaignId, ch.id]);

  const openModal = (type) => {
    setModal(type);
    setModalVal(type === "xp" ? "50" : "100");
  };

  const applyModal = () => {
    const n = parseInt(modalVal, 10);
    if (isNaN(n)) return;
    if (modal === "xp")    quick({ experience: (ch.experience ?? 0) + n });
    if (modal === "money") quick({ money: (ch.money ?? 0) + n });
    setModal(null);
  };

  return (
    <>
      <div className="kk-party-row" style={{ "--fac-color": col }}>
        <button className="kk-party-row-av" onClick={onOpen} title="Открыть карточку">
          {ch.portrait
            ? <img src={ch.portrait} alt={ch.name}/>
            : <span className="kk-portrait-ph">{(ch.name || "?")[0]}</span>}
        </button>
        <div className="kk-party-row-info" onClick={onOpen} style={{ cursor: "pointer" }}>
          <div className="kk-party-row-name">{ch.name || "—"}</div>
          <div className="kk-party-row-sub">{ch.faculty?.name || "без факультета"} · {ch.academyYear || "1"} курс</div>
          <div className="kk-party-row-vitals">
            <span title="Физический урон">❤ {physFilled}</span>
            <span title="Ментальный урон">🧠 {mentFilled}</span>
            <span title="Энергия (макс. с учётом напряжения)">⚡ {energyCur}/{energyMax}</span>
            <span title="Напряжение" className="kk-vital-tension">⚗ {tension}/{tensionMax}</span>
            {overcap > 0 && <span title="Перегруз напряжения" className="kk-vital-overcap">⚠ {overcap}</span>}
          </div>
        </div>
        <div className="kk-party-row-acts">
          <button className="kk-qa-btn" title="− Напряжение"
            onClick={() => { const p = tensionAdjustPatch(ch, -1, settings); if (p) quick(p); }}>⚗−</button>
          <button className="kk-qa-btn" title="+ Напряжение"
            onClick={() => { const p = tensionAdjustPatch(ch, 1, settings); if (p) quick(p); }}>⚗+</button>
          {(tension > 0 || overcap > 0) && (
            <button className="kk-qa-btn" title="Сбросить напряжение" onClick={() => quick(tensionClearPatch())}>⚗0</button>
          )}
          <button className="kk-qa-btn" title="+ Бенни" onClick={() => quick({ bennies: Math.min(9, (ch.bennies ?? 0) + 1) })}>◆</button>
          <button className="kk-qa-btn" title="Опыт" onClick={() => openModal("xp")}>★</button>
          <button className="kk-qa-btn" title="Деньги" onClick={() => openModal("money")}>₽</button>
          <button className="kk-qa-btn kk-qa-remove" title="Убрать из отряда" onClick={onRemove}>✕</button>
        </div>
      </div>

      {modal && (
        <div className="kk-qa-modal-overlay" onClick={() => setModal(null)}>
          <div className="kk-qa-modal" onClick={e => e.stopPropagation()}>
            <div className="kk-qa-modal-title">
              {modal === "xp" ? `Опыт — ${ch.name}` : `Деньги — ${ch.name}`}
            </div>
            <input
              className="kk-input kk-qa-modal-input"
              type="number"
              value={modalVal}
              onChange={e => setModalVal(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applyModal(); if (e.key === "Escape") setModal(null); }}
              autoFocus
            />
            <div className="kk-qa-modal-hint">Отрицательное значение — вычесть</div>
            <div className="kk-qa-modal-btns">
              <button className="kk-btn ghost sm" onClick={() => setModal(null)}>Отмена</button>
              <button className="kk-btn sm" onClick={applyModal}>Применить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
