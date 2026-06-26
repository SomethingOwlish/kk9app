import { useCallback } from "react";
import { updateCharacterNow } from "../lib/db";

export default function PartyRow({ ch, campaignId, onOpen, onRemove }) {
  const col = ch.faculty?.color || "var(--kk-gold)";
  const physFilled = ch.health?.physical?.value ?? 0;
  const mentFilled = ch.health?.mental?.value ?? 0;
  const energyCur = ch.energy?.value ?? 0;
  const energyMax = ch.energy?.max ?? 0;
  const tension = ch.tension?.current ?? 0;

  const quick = useCallback((patch) => {
    updateCharacterNow(campaignId, ch.id, patch).catch(console.error);
  }, [campaignId, ch.id]);

  return (
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
          <span title="Энергия">⚡ {energyCur}/{energyMax}</span>
          {tension > 0 && <span title="Напряжение" className="kk-vital-tension">⚗ {tension}</span>}
        </div>
      </div>
      <div className="kk-party-row-acts">
        <button className="kk-qa-btn" title="+ Бенни" onClick={() => quick({ bennies: Math.min(9, (ch.bennies ?? 0) + 1) })}>🎲</button>
        <button className="kk-qa-btn" title="+ 1 ОП"  onClick={() => quick({ experience: (ch.experience ?? 0) + 1 })}>⭐</button>
        <button className="kk-qa-btn" title="+ 10 ₽"  onClick={() => quick({ money: (ch.money ?? 0) + 10 })}>💰</button>
        <button className="kk-qa-btn kk-qa-remove" title="Убрать из отряда" onClick={onRemove}>✕</button>
      </div>
    </div>
  );
}
