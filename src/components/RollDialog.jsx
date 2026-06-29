import { useState, useMemo } from "react";
import { rollPool, rollSnakeEyes, stepDie, buildRollResult, formatFaces } from "../lib/dice";
import { collectRollModifiers, collectHealthPenalties } from "../lib/statusEngine";
import { canCastSpell } from "../lib/items";
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

const SRC_LABEL = { status: "Статус", feature: "Черта", artifact: "Артефакт" };

function signed(n) { return `${n > 0 ? "+" : ""}${n}`; }

// Roll a skill, attribute, or item. Self-contained: rolls (or takes a GM-entered
// result), applies status/feature/artifact mods + tension, then calls onCommit.
// Props:
//   ch, target: { kind: "skill"|"attribute"|"item", name, die, modifier, attribute, ... }
//   campaign, campaignStatuses, items, isGM
//   onCommit({ charId, rollData, outcome, exhaustionInstance, charPatch }) — async
//   onClose
export default function RollDialog({ ch, target, campaign, campaignStatuses = [], items = [], isGM = false, onCommit, onClose }) {
  const settings = useMemo(() => tensionSettings(campaign), [campaign]);

  // Ability name used for tension + the log entry. For items, it's the linked skill.
  const isItem = target.kind === "item";
  const abilityName = isItem ? (target.skillName || target.name) : target.name;
  const skillNameForMods = isItem ? target.skillName : (target.kind === "skill" ? target.name : null);

  const mods = useMemo(
    () => collectRollModifiers(ch, { attribute: target.attribute, skillName: skillNameForMods }, items),
    [ch, target, items, skillNameForMods],
  );
  const health = useMemo(() => collectHealthPenalties(ch), [ch]);
  const [situational, setSituational] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  // GM manual-entry mode.
  const [manual, setManual] = useState(false);
  const [manualSkill, setManualSkill] = useState("");
  const [manualWild, setManualWild] = useState("");
  const [manualSnake, setManualSnake] = useState(false);

  // Ring dependency for spell items.
  const castCheck = isItem && target.itemType === "spell" ? canCastSpell(target.item, items) : { ok: true };

  const blocked = isTensionBlocked(ch, abilityName, target.attribute);
  const willTrigger = abilityTriggersTension(ch, abilityName);
  const effDie = stepDie(target.die, mods.dieSteps);
  const attackMod = isItem ? Number(target.attackModifier || 0) : 0;
  const baseSkillMod = (target.modifier ?? 0) - attackMod; // skill/attr part only
  const baseMod = (target.modifier ?? 0) + mods.numericMod + Number(situational || 0);
  const spellCost = isItem ? Number(target.spellCost || 0) : 0;

  const canRollNow = !blocked && castCheck.ok;

  // Build the human-readable list of everything feeding the roll.
  const modParts = [];
  modParts.push({ label: `Грань d${effDie}`, detail: mods.dieSteps ? `база d${target.die}, ${signed(mods.dieSteps)} ступ.` : null, kind: "die" });
  if (baseSkillMod) modParts.push({ label: isItem ? "Навык предмета" : (target.kind === "skill" ? "Модификатор навыка" : "Модификатор"), value: baseSkillMod });
  if (attackMod) modParts.push({ label: "Бонус предмета", value: attackMod });
  for (const s of mods.sources) {
    const bits = [];
    if (s.numericMod) bits.push(`${signed(s.numericMod)} к броску`);
    if (s.dieSteps) bits.push(`${signed(s.dieSteps)} ступ.`);
    if (s.successMod) bits.push(`${signed(s.successMod)} к успеху`);
    if (s.extraDice) bits.push(`+${s.extraDice} доп. куб.`);
    modParts.push({ label: `${SRC_LABEL[s.kind] || ""}: ${s.label}`, detail: bits.join(", "), kind: s.kind });
  }
  if (Number(situational)) modParts.push({ label: "Ситуативный", value: Number(situational) });

  async function roll() {
    if (busy || !canRollNow) return;
    setBusy(true);
    try {
      let skillRaw, wildRaw, keptRaw, isWild, snakeEyes, keptFaces;
      if (manual) {
        skillRaw = Math.max(0, Number(manualSkill) || 0);
        wildRaw = Math.max(0, Number(manualWild) || 0);
        isWild = wildRaw > skillRaw;
        keptRaw = isWild ? wildRaw : skillRaw;
        snakeEyes = manualSnake;
        keptFaces = [keptRaw];
      } else {
        const pool = rollPool(effDie);
        skillRaw = pool.skill;
        wildRaw = pool.wild;
        keptRaw = pool.kept;
        isWild = pool.isWild;
        snakeEyes = rollSnakeEyes(pool.skillNatural, pool.wildNatural);
        keptFaces = pool.keptFaces;
      }

      const built = buildRollResult(keptRaw, baseMod, health.halfResult);
      const raises = Math.max(0, built.raises + (mods.successMod || 0));
      const mainRoll = { success: built.success && !snakeEyes, raises, snakeEyes };

      const outcome = willTrigger ? computeTensionOutcome(ch, abilityName, mainRoll, settings) : null;

      // Spell energy cost: deduct on a successful cast (or snake-eyes), like old code.
      let charPatch = null;
      if (spellCost > 0 && (mainRoll.success || snakeEyes)) {
        const cur = ch.energy?.value ?? 0;
        charPatch = { "energy.value": Math.max(0, cur - spellCost) };
      }

      const rollData = {
        characterId: ch.id,
        characterName: ch.name || "",
        abilityName: target.name,
        die: effDie,
        modifier: baseMod,
        skillRaw, wildRaw, keptRaw,
        keptFaces,
        finalTotal: built.total,
        snakeEyes,
        manualEntry: manual,
        halfResult: health.halfResult,
        success: mainRoll.success,
        raises,
        itemType: isItem ? target.itemType : null,
        statusModifiers: {
          numericMod: mods.numericMod, dieSteps: mods.dieSteps,
          extraDice: mods.extraDice, successMod: mods.successMod,
          situational: Number(situational || 0),
          attackModifier: attackMod,
        },
        tension: outcome ? { increment: outcome.increment, zone: outcome.zoneAfter } : null,
      };

      const display = { ...rollData, isWild, outcome, keptFaces, spellCost: charPatch ? spellCost : 0 };
      setResult(display);

      const exhaustionInstance = outcome?.addExhaustion ? buildExhaustion(campaignStatuses) : null;
      await onCommit({ charId: ch.id, rollData, outcome, exhaustionInstance, charPatch });
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
          {isItem && target.damageInfo && <div className="kk-roll-iteminfo">{target.damageInfo}{target.statusName ? ` · » ${target.statusName}` : ""}</div>}

          {/* Everything that affects the roll, listed separately. */}
          <div className="kk-roll-breakdown">
            <div className="kk-roll-breakdown-title">Что влияет на бросок</div>
            {modParts.map((p, i) => (
              <div className="kk-roll-part" key={i}>
                <span className="kk-roll-part-label">{p.label}</span>
                <span className="kk-roll-part-val">
                  {p.value != null ? signed(p.value) : (p.detail || "")}
                </span>
              </div>
            ))}
            <div className="kk-roll-part kk-roll-part-total">
              <span className="kk-roll-part-label">Итоговый модификатор</span>
              <span className="kk-roll-part-val">{signed(baseMod)}</span>
            </div>
          </div>

          {health.halfResult && <div className="kk-roll-warn">Ранение: результат броска делится пополам.</div>}
          {willTrigger && !blocked && <div className="kk-roll-tension-note">⚗ Способность вызывает проверку напряжения.</div>}
          {spellCost > 0 && <div className="kk-roll-tension-note">Стоимость каста: {spellCost} энергии (при успехе).</div>}
          {target.missingSkill && <div className="kk-roll-warn">Навык «{target.skillName}» не найден у персонажа — бросок идёт как d4.</div>}
          {target.needsSkill && <div className="kk-roll-warn">У предмета не задан навык — бросок идёт как d4.</div>}
          {blocked && <div className="kk-roll-warn kk-roll-blocked">Ментальное истощение: этот бросок заблокирован.</div>}
          {!castCheck.ok && <div className="kk-roll-warn kk-roll-blocked">{castCheck.reason}</div>}

          {!result && (
            <>
              <label className="kk-sc-field">
                <span>Ситуативный модификатор</span>
                <input className="kk-input sm" type="number" value={situational}
                  onChange={(e) => setSituational(e.target.value)} />
              </label>

              {isGM && (
                <label className="kk-roll-manual-toggle">
                  <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} />
                  <span>Ввести результат вручную (ГМ)</span>
                </label>
              )}

              {isGM && manual && (
                <div className="kk-roll-manual">
                  <label className="kk-sc-field">
                    <span>Навык (d{effDie}, сырой)</span>
                    <input className="kk-input sm" type="number" min={0} value={manualSkill}
                      onChange={(e) => setManualSkill(e.target.value)} />
                  </label>
                  <label className="kk-sc-field">
                    <span>Wild (d6, сырой)</span>
                    <input className="kk-input sm" type="number" min={0} value={manualWild}
                      onChange={(e) => setManualWild(e.target.value)} />
                  </label>
                  <label className="kk-roll-manual-toggle">
                    <input type="checkbox" checked={manualSnake} onChange={(e) => setManualSnake(e.target.checked)} />
                    <span>Глаза змеи (крит. провал)</span>
                  </label>
                </div>
              )}

              <button className="kk-btn primary kk-se-apply" onClick={roll} disabled={busy || !canRollNow}>
                {busy ? "…" : manual ? "Применить" : "Бросить"}
              </button>
            </>
          )}

          {result && (
            <div className={`kk-roll-result ${result.snakeEyes ? "fail" : result.success ? "ok" : "fail"}`}>
              <div className="kk-roll-dice">
                <span>Навык: {result.skillRaw}</span>
                <span>Wild: {result.wildRaw}</span>
                <span className="kk-roll-kept">
                  Оставлено: {result.isWild ? "Wild — " : ""}{formatFaces(result.keptFaces) || result.keptRaw}
                </span>
              </div>
              <div className="kk-roll-total">
                Итог: <b>{result.finalTotal}</b>{" "}
                <em>({result.keptRaw}{result.modifier ? signed(result.modifier) : ""}{result.halfResult ? " ÷2" : ""})</em>
              </div>
              <div className="kk-roll-verdict">
                {result.snakeEyes ? "💀 Критический провал (глаза змеи)"
                  : result.success ? `✔ Успех${result.raises > 0 ? ` · рейзы: ${result.raises}` : ""}`
                  : "✘ Провал"}
              </div>
              {result.spellCost > 0 && <div className="kk-roll-tension-res">−{result.spellCost} энергии</div>}
              {result.outcome?.triggered && (
                isGM ? (
                  // GM sees the full tension roll: hidden d100, threshold, exact change.
                  <div className="kk-roll-tension-res kk-roll-tension-gm">
                    ⚗ Напряжение {result.outcome.increment > 0 ? "+" : ""}{result.outcome.increment}
                    {result.outcome.d100 ? <em className="kk-roll-tension-d100"> · d100 {result.outcome.d100.result} / порог {result.outcome.d100.threshold} ({result.outcome.d100.failed ? "провал" : "успех"})</em> : null}
                    {result.outcome.addExhaustion ? " · Ментальное истощение!" : ""}
                  </div>
                ) : (
                  // Player sees only the qualitative outcome — no numbers.
                  <div className="kk-roll-tension-res">
                    {result.outcome.increment > 0 ? "⚗ Напряжение возросло"
                      : result.outcome.increment < 0 ? "⚗ Напряжение снизилось"
                      : "⚗ Напряжение без изменений"}
                    {result.outcome.addExhaustion ? " · Ментальное истощение!" : ""}
                  </div>
                )
              )}
              <button className="kk-btn ghost sm" onClick={onClose} style={{ marginTop: ".6rem" }}>Закрыть</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
