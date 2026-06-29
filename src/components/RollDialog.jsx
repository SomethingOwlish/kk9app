import { useState, useMemo } from "react";
import { rollPool, rollSnakeEyes, stepDie, buildRollResult } from "../lib/dice";
import { collectRollModifiers, collectHealthPenalties } from "../lib/statusEngine";
import {
  computeTensionOutcome, tensionSettings, isTensionBlocked,
  abilityTriggersTension, MENTAL_EXHAUSTION,
} from "../lib/tension";

function rUid() { return Math.random().toString(36).slice(2, 10); }

// Builds a "Ментальное истощение" status instance from the campaign library.
function buildExhaustion(campaignStatuses) {
  const def = campaignStatuses.find((s) => s.name === MENTAL_EXHAUSTION);
  return {
    _uid: rUid(),
    definitionId: def?.id || "",
    name: MENTAL_EXHAUSTION,
    status_types: def?.status_types || ["shock_mental"],
    durationMode: def?.duration?.mode || "time",
    durationRemaining: null,
    effects: def?.effects || [],
    source: "tension",
  };
}

// Roll a skill or attribute. Self-contained: rolls, applies status mods + tension,
// then calls onCommit to persist (character patch + roll-log entry).
// Props:
//   ch, target: { kind: "skill"|"attribute", name, die, modifier, attribute }
//   campaign, campaignStatuses
//   onCommit({ charId, rollData, outcome, exhaustionInstance }) — async
//   onClose
export default function RollDialog({ ch, target, campaign, campaignStatuses = [], onCommit, onClose }) {
  const settings = useMemo(() => tensionSettings(campaign), [campaign]);
  const mods = useMemo(
    () => collectRollModifiers(ch, { attribute: target.attribute, skillName: target.kind === "skill" ? target.name : null }),
    [ch, target],
  );
  const health = useMemo(() => collectHealthPenalties(ch), [ch]);
  const [situational, setSituational] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const blocked = isTensionBlocked(ch, target.name, target.attribute);
  const willTrigger = abilityTriggersTension(ch, target.name);
  const effDie = stepDie(target.die, mods.dieSteps);
  const baseMod = (target.modifier ?? 0) + mods.numericMod + Number(situational || 0);

  async function roll() {
    if (busy || blocked) return;
    setBusy(true);
    try {
      const pool = rollPool(effDie);
      const snakeEyes = rollSnakeEyes(pool.skillNatural, pool.wildNatural);
      const built = buildRollResult(pool.kept, baseMod, health.halfResult);
      const raises = Math.max(0, built.raises + (mods.successMod || 0));
      const mainRoll = { success: built.success && !snakeEyes, raises, snakeEyes };

      const outcome = willTrigger ? computeTensionOutcome(ch, target.name, mainRoll, settings) : null;

      const rollData = {
        characterId: ch.id,
        characterName: ch.name || "",
        abilityName: target.name,
        die: effDie,
        modifier: baseMod,
        skillRaw: pool.skill,
        wildRaw: pool.wild,
        keptRaw: pool.kept,
        finalTotal: built.total,
        snakeEyes,
        halfResult: health.halfResult,
        success: mainRoll.success,
        raises,
        statusModifiers: {
          numericMod: mods.numericMod, dieSteps: mods.dieSteps,
          extraDice: mods.extraDice, successMod: mods.successMod,
          situational: Number(situational || 0),
        },
        tension: outcome ? { increment: outcome.increment, zone: outcome.zoneAfter } : null,
      };

      const display = { ...rollData, isWild: pool.isWild, outcome };
      setResult(display);

      const exhaustionInstance = outcome?.addExhaustion ? buildExhaustion(campaignStatuses) : null;
      await onCommit({ charId: ch.id, rollData, outcome, exhaustionInstance });
    } catch (e) {
      alert("Ошибка броска: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kk-modal-backdrop" onClick={onClose}>
      <div className="kk-se-modal kk-roll-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kk-se-head">
          <span className="kk-se-title">Бросок: {target.name}</span>
          <button className="kk-sc-close" onClick={onClose}>✕</button>
        </div>

        <div className="kk-roll-body">
          <div className="kk-roll-summary">
            <span>Грань: <b>d{effDie}</b>{mods.dieSteps ? <em className="kk-roll-mod"> (база d{target.die}, статус {mods.dieSteps > 0 ? "+" : ""}{mods.dieSteps})</em> : null}</span>
            <span>Модификатор: <b>{baseMod > 0 ? "+" : ""}{baseMod}</b></span>
          </div>

          {(mods.numericMod || mods.successMod || mods.extraDice) ? (
            <div className="kk-roll-statusmods">
              Статусы: {mods.numericMod ? `${mods.numericMod > 0 ? "+" : ""}${mods.numericMod} к броску ` : ""}
              {mods.successMod ? `${mods.successMod > 0 ? "+" : ""}${mods.successMod} к успеху ` : ""}
              {mods.extraDice ? `+${mods.extraDice} доп. кубов` : ""}
            </div>
          ) : null}
          {health.halfResult && <div className="kk-roll-warn">Ранение: результат броска делится пополам.</div>}
          {willTrigger && !blocked && <div className="kk-roll-tension-note">⚗ Способность вызывает проверку напряжения.</div>}
          {blocked && <div className="kk-roll-warn kk-roll-blocked">Ментальное истощение: этот бросок заблокирован.</div>}

          <label className="kk-sc-field">
            <span>Ситуативный модификатор</span>
            <input className="kk-input sm" type="number" value={situational}
              onChange={(e) => setSituational(e.target.value)} />
          </label>

          {!result && (
            <button className="kk-btn primary kk-se-apply" onClick={roll} disabled={busy || blocked}>
              {busy ? "…" : "Бросить"}
            </button>
          )}

          {result && (
            <div className={`kk-roll-result ${result.snakeEyes ? "fail" : result.success ? "ok" : "fail"}`}>
              <div className="kk-roll-dice">
                <span>Навык: {result.skillRaw}</span>
                <span>Wild: {result.wildRaw}</span>
                <span className="kk-roll-kept">Оставлено: {result.keptRaw}{result.isWild ? " (wild)" : ""}</span>
              </div>
              <div className="kk-roll-total">
                Итог: <b>{result.finalTotal}</b> {result.modifier ? <em>({result.keptRaw}{result.modifier > 0 ? "+" : ""}{result.modifier})</em> : null}
              </div>
              <div className="kk-roll-verdict">
                {result.snakeEyes ? "💀 Критический провал (глаза змеи)"
                  : result.success ? `✔ Успех${result.raises > 0 ? ` · рейзы: ${result.raises}` : ""}`
                  : "✘ Провал"}
              </div>
              {result.outcome?.triggered && result.outcome.increment !== 0 && (
                <div className="kk-roll-tension-res">
                  ⚗ Напряжение {result.outcome.increment > 0 ? "+" : ""}{result.outcome.increment}
                  {result.outcome.addExhaustion ? " · Ментальное истощение!" : ""}
                </div>
              )}
              <button className="kk-btn ghost sm" onClick={onClose} style={{ marginTop: ".6rem" }}>Закрыть</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
