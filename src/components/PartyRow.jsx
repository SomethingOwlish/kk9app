import { useState } from "react";
import { addBennie, addExperience, addMoney, removeFromParty } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

export default function PartyRow({ ch, onOpen }) {
  const [busy, setBusy] = useState(false);

  const col = ch.faculty?.color || "#c8a14e";

  async function act(fn) {
    setBusy(true);
    try { await fn(); } catch (e) { alert("Ошибка: " + (e?.message || e)); }
    finally { setBusy(false); }
  }

  const physFilled = ch.health?.physical?.value ?? 0;
  const menFilled  = ch.health?.mental?.value  ?? 0;

  return (
    <div className="kk-party-row" style={{ "--fac-color": col }}>
      <div className="kk-party-row-left">
        <button className="kk-party-av sm" onClick={() => onOpen(ch.id)}>
          {(ch.name || "?").slice(0, 1)}
        </button>
        <div className="kk-party-row-info">
          <button className="kk-party-row-name" onClick={() => onOpen(ch.id)}>
            {ch.name || "(без имени)"}
          </button>
          <div className="kk-party-row-meta">
            {ch.faculty?.name || "—"} · XP {ch.experience ?? 0} · {ch.money ?? 0}₽
          </div>
          <div className="kk-party-row-bars">
            <span className="kk-pr-bar-label">Физ {physFilled}</span>
            <span className="kk-pr-bar-label">Псих {menFilled}</span>
            <span className="kk-pr-bar-label">
              Энерг {ch.energy?.value ?? 0}/{ch.energy?.max ?? 0}
            </span>
          </div>
        </div>
      </div>
      <div className="kk-party-row-actions">
        <button
          className="kk-btn sm ghost"
          disabled={busy}
          onClick={() => act(() => addBennie(CAMPAIGN_ID, ch.id))}
          title="Добавить бенни"
        >
          🎲+1
        </button>
        <button
          className="kk-btn sm ghost"
          disabled={busy}
          onClick={() => act(() => addExperience(CAMPAIGN_ID, ch.id, 1))}
          title="Добавить 1 опыт"
        >
          XP+1
        </button>
        <button
          className="kk-btn sm ghost"
          disabled={busy}
          onClick={() => act(() => addMoney(CAMPAIGN_ID, ch.id, 10))}
          title="Добавить 10 рублей"
        >
          ₽+10
        </button>
        <button
          className="kk-btn sm danger"
          disabled={busy}
          onClick={() => act(() => removeFromParty(CAMPAIGN_ID, ch.id))}
          title="Убрать из партии"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
