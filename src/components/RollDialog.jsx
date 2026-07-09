import { useState, useMemo } from "react";
import { rollPool, rollSnakeEyes, stepDie, successDegreeFromTotal, applySuccessMod, rollExtraDiceList, formatFaces } from "../lib/dice";
import { collectRollModifiers, collectApplicableFeatures, collectHealthPenalties } from "../lib/statusEngine";
import { canCastSpell } from "../lib/items";
import { spellActivates, activateSpellEntry, collectActiveBuffMods, consumeSpellUse } from "../lib/activeSpells";
import * as combat from "../lib/combat";
import {
  computeTensionOutcome, tensionSettings, isTensionBlocked,
  abilityTriggersTension, MENTAL_EXHAUSTION,
} from "../lib/tension";
import { buildStatusInstance } from "../lib/statusInstance";

const FATE_DEBT = "Долг судьбы";

const SRC_LABEL = { status: "Статус", feature: "Черта", artifact: "Артефакт" };

function signed(n) { return `${n > 0 ? "+" : ""}${n}`; }

// Roll a skill, attribute, toughness, or item. Self-contained: pre-roll (opt-in
// traits + manual mods folded into this dialog), rolls (or takes a GM-entered
// result), applies status/feature/artifact mods + tension, then calls onCommit.
// Reroll (жетон судьбы) is offered on the result panel — replays the same formula
// with fresh dice, spends a bennie, applies «Долг судьбы» (no status-charge recharge).
// Props:
//   ch, target: { kind: "skill"|"attribute"|"toughness"|"item", name, die, modifier, attribute, isToughness?, ... }
//   campaign, campaignStatuses, items, isGM
//   onCommit(payload) — async. Normal: { charId, rollData, outcome, exhaustionInstance, charPatch }.
//                       Reroll: { charId, rollData, reroll: true, fateDebtInstance }.
//   onClose
export default function RollDialog({ ch, target, campaign, campaignStatuses = [], items = [], isGM = false, onCommit, onClose, roster = [], onAttack }) {
  const settings = useMemo(() => tensionSettings(campaign), [campaign]);

  const isItem = target.kind === "item";
  const isToughness = !!target.isToughness || target.kind === "toughness";
  // Ability name used for tension + the log entry. For items, it's the linked skill.
  const abilityName = isItem ? (target.skillName || target.name) : target.name;
  const skillNameForMods = isItem ? target.skillName : (target.kind === "skill" ? target.name : null);
  const ctx = useMemo(
    () => ({ attribute: target.attribute, skillName: skillNameForMods, itemType: isItem ? target.itemType : null, isToughness }),
    [target, skillNameForMods, isItem, isToughness],
  );

  // Statuses + artifacts always apply; features are opt-in (pre-roll).
  const mods = useMemo(() => collectRollModifiers(ch, ctx, items, { skipFeatures: true }), [ch, ctx, items]);
  const applicableFeats = useMemo(() => collectApplicableFeatures(ch, ctx), [ch, ctx]);
  // Health penalties depend on the roll's attribute track + toughness exception (pip 5).
  const health = useMemo(() => collectHealthPenalties(ch, target.attribute, isToughness), [ch, target.attribute, isToughness]);

  // SKIP-02: active buff spells that modify this roll's attribute. Auto-applied,
  // with a per-buff opt-out; each applied buff loses one use after the roll.
  const buffMods = useMemo(
    () => collectActiveBuffMods(ch.activeSpells, items, target.attribute),
    [ch.activeSpells, items, target.attribute],
  );
  const [excludedBuffs, setExcludedBuffs] = useState(() => new Set());
  const appliedBuffs = useMemo(
    () => buffMods.filter((b) => !excludedBuffs.has(b.itemId)),
    [buffMods, excludedBuffs],
  );
  const buffNumericMod = appliedBuffs.reduce((a, b) => a + b.numericMod, 0);

  // Pre-roll state: selected traits (default all applicable checked) + manual mods.
  const [selFeats, setSelFeats] = useState(() => new Set(applicableFeats.map((f) => f.id)));
  const [situational, setSituational] = useState(0);   // manual numeric mod (к итогу)
  const [successManual, setSuccessManual] = useState(0); // manual success mod
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmReroll, setConfirmReroll] = useState(false);

  // Attack producer (B-54): after a successful roll of an attack item, let the
  // attacker pick target(s) and dispatch pending-attack docs.
  const [attackTargets, setAttackTargets] = useState(() => new Set());
  const [attackSent, setAttackSent] = useState(false);

  // GM manual-entry mode.
  const [manual, setManual] = useState(false);
  const [manualSkill, setManualSkill] = useState("");
  const [manualWild, setManualWild] = useState("");
  const [manualSnake, setManualSnake] = useState(false);

  const castCheck = isItem && target.itemType === "spell" ? canCastSpell(target.item, items) : { ok: true };

  const tensionBlocked = isTensionBlocked(ch, abilityName, target.attribute);
  const healthBlocked = health.blocked;
  const stunBlocked = !!ch.is_stunned;
  const blocked = tensionBlocked || healthBlocked || stunBlocked;
  const willTrigger = abilityTriggersTension(ch, abilityName);

  // Selected trait contributions folded on top of the always-on status/artifact mods.
  const feat = useMemo(() => {
    const sel = applicableFeats.filter((f) => selFeats.has(f.id));
    return {
      list: sel,
      numericMod: sel.reduce((a, f) => a + f.numericMod, 0),
      dieSteps: sel.reduce((a, f) => a + f.dieSteps, 0),
      successMod: sel.reduce((a, f) => a + f.successMod, 0),
      extra: sel.flatMap((f) => f.extra),
    };
  }, [applicableFeats, selFeats]);

  const dieSteps = mods.dieSteps + feat.dieSteps;
  const effDie = stepDie(target.die, dieSteps);
  const attackMod = isItem ? Number(target.attackModifier || 0) : 0;
  const baseSkillMod = (target.modifier ?? 0) - attackMod; // skill/attr part only
  const numericMod = mods.numericMod + feat.numericMod + buffNumericMod;
  const successMod = mods.successMod + feat.successMod + Number(successManual || 0);
  const extraDiceList = [...(mods.extraDiceList || []), ...feat.extra];
  const baseMod = (target.modifier ?? 0) + numericMod + Number(situational || 0) + health.mod;
  const spellCost = isItem ? Number(target.spellCost || 0) : 0;

  const canRollNow = !blocked && castCheck.ok;
  const canReroll = !manual && (ch.bennies ?? 0) >= 1;

  // Build the human-readable list of everything feeding the roll.
  const modParts = [];
  modParts.push({ label: `Грань d${effDie}`, detail: dieSteps ? `база d${target.die}, ${signed(dieSteps)} ступ.` : null, kind: "die" });
  if (baseSkillMod) modParts.push({ label: isItem ? "Навык предмета" : (target.kind === "skill" ? "Модификатор навыка" : "Модификатор"), value: baseSkillMod });
  if (attackMod) modParts.push({ label: "Бонус предмета", value: attackMod });
  for (const s of mods.sources) {
    const bits = [];
    if (s.numericMod) bits.push(`${signed(s.numericMod)} к броску`);
    if (s.dieSteps) bits.push(`${signed(s.dieSteps)} ступ.`);
    if (s.successMod) bits.push(`${signed(s.successMod)} к успеху`);
    if (s.extraCount) bits.push(`+${s.extraCount} доп. куб.`);
    modParts.push({ label: `${SRC_LABEL[s.kind] || ""}: ${s.label}`, detail: bits.join(", "), kind: s.kind });
  }
  for (const f of feat.list) {
    const bits = [];
    if (f.numericMod) bits.push(`${signed(f.numericMod)} к броску`);
    if (f.dieSteps) bits.push(`${signed(f.dieSteps)} ступ.`);
    if (f.successMod) bits.push(`${signed(f.successMod)} к успеху`);
    if (f.extra.length) bits.push(`+${f.extra.length} доп. куб.`);
    modParts.push({ label: `Черта: ${f.name}`, detail: bits.join(", "), kind: "feature" });
  }
  for (const b of appliedBuffs) modParts.push({ label: `Заклинание: ${b.name}`, value: b.numericMod, kind: "artifact" });
  if (Number(situational)) modParts.push({ label: "Ситуативный", value: Number(situational) });
  if (Number(successManual)) modParts.push({ label: "Модификатор успехов", value: Number(successManual), detail: "к успеху" });
  if (health.mod) modParts.push({ label: "Штраф здоровья", value: health.mod, kind: "health" });

  // ── Attack producer (B-54) ──
  // Show the attack section only when an item roll of an attack item succeeded
  // (and it was not a snake-eyes critical failure).
  const attackItem = isItem ? target.item : null;
  const canAttack = !!(
    attackItem && combat.isAttackItem(attackItem) &&
    typeof onAttack === "function" &&
    result && result.success && !result.snakeEyes
  );
  const attackData = useMemo(
    () => (attackItem && combat.isAttackItem(attackItem) && result && result.success && !result.snakeEyes
      ? combat.buildAttackData(attackItem, { success: result.success, raises: result.raises })
      : null),
    [attackItem, result],
  );
  // Roster minus the attacker's own character (can't target yourself here).
  const attackRoster = useMemo(() => (roster || []).filter((r) => r.id !== ch.id), [roster, ch.id]);
  const isAoe = !!attackData?.isAreaAttack;

  function toggleAttackTarget(id) {
    setAttackTargets((prev) => {
      const n = new Set(prev);
      if (isAoe) {
        if (n.has(id)) n.delete(id); else n.add(id);
      } else {
        n.clear();
        n.add(id);
      }
      return n;
    });
  }

  async function sendAttack() {
    if (busy || !attackData || !onAttack || attackTargets.size === 0) return;
    setBusy(true);
    try {
      const arr = [...attackTargets].map((tid) => {
        const t = attackRoster.find((r) => r.id === tid);
        return {
          attackerCharId: ch.id,
          attackerName: ch.name || "",
          targetCharId: tid,
          targetName: t?.name || "",
          targetKind: t?.kind || "character",
          attackData,
        };
      });
      await onAttack(arr);
      setAttackSent(true);
    } catch (e) {
      alert("Ошибка атаки: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  function toggleBuff(id) {
    setExcludedBuffs((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleFeat(id) {
    setSelFeats((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  // Rolls dice for the current effDie (fresh, or GM-manual on the initial roll).
  function rollDice(useManual) {
    if (useManual) {
      const skillRaw = Math.max(0, Number(manualSkill) || 0);
      const wildRaw = Math.max(0, Number(manualWild) || 0);
      const isWild = wildRaw > skillRaw;
      const keptRaw = isWild ? wildRaw : skillRaw;
      return { skillRaw, wildRaw, keptRaw, isWild, snakeEyes: manualSnake, keptFaces: [keptRaw] };
    }
    const pool = rollPool(effDie);
    return {
      skillRaw: pool.skill, wildRaw: pool.wild, keptRaw: pool.kept, isWild: pool.isWild,
      snakeEyes: rollSnakeEyes(pool.skillNatural, pool.wildNatural), keptFaces: pool.keptFaces,
    };
  }

  // Runs the same formula (effDie, baseMod, extraDice, half-result, successMod).
  // isReroll: fresh dice, no tension re-check, no spell cost, no status tick —
  // spends a bennie and applies «Долг судьбы» instead (Foundry reroll semantics).
  async function doRoll(isReroll) {
    if (busy) return;
    if (!isReroll && !canRollNow) return;
    if (isReroll && !canReroll) return;
    setBusy(true);
    setConfirmReroll(false);
    try {
      const dice = rollDice(!isReroll && manual);

      // Extra dice from statuses/features (non-exploding), added to the total
      // before the half-result and success checks — Foundry order.
      const extraDiceTotal = rollExtraDiceList(extraDiceList);
      const rawTotal = dice.keptRaw + extraDiceTotal + baseMod;

      // Success degree mirrors Foundry: snake-eyes/negative first (on the FULL,
      // pre-half total), then half, then success count; successMod can demote
      // a success down to a plain failure.
      const degreeBase = successDegreeFromTotal(rawTotal, { halfResult: health.halfResult, allOnes: dice.snakeEyes });
      const degree = applySuccessMod(degreeBase, successMod);
      const isSnake = degree.type === "snake_eyes";
      const raises = degree.raises;
      const finalTotal = isSnake ? rawTotal : (health.halfResult ? Math.floor(rawTotal / 2) : rawTotal);
      const mainRoll = { success: degree.success, raises, snakeEyes: isSnake };

      const outcome = (!isReroll && willTrigger) ? computeTensionOutcome(ch, abilityName, mainRoll, settings) : null;

      // Spell energy cost: deduct on a successful cast (or snake-eyes) — initial roll only.
      let charPatch = null;
      if (!isReroll && spellCost > 0 && (mainRoll.success || isSnake)) {
        const cur = ch.energy?.value ?? 0;
        charPatch = { "energy.value": Math.max(0, cur - spellCost) };
      }

      // Active-spell lifecycle. Two effects fold into one activeSpells write:
      //  (1) SKIP-02: each applied active buff-spell loses a use after the roll
      //      (Foundry consumeStatusCharges, weapon-combat.mjs:819). Depleted → drop.
      //  (2) B-55: a successful cast of an ongoing, non-attack spell adds/refreshes
      //      an entry (upkeep then charged per round by the GM "Раунд →" control).
      // Order matters: consume first (operates on current entries), then activate.
      let nextActiveSpells = ch.activeSpells;
      let activeSpellsChanged = false;
      if (!isReroll && appliedBuffs.length) {
        for (const b of appliedBuffs) {
          nextActiveSpells = consumeSpellUse(nextActiveSpells, b.itemId).activeSpells;
        }
        activeSpellsChanged = true;
      }
      if (!isReroll && isItem && target.itemType === "spell" && mainRoll.success && target.item && spellActivates(target.item)) {
        nextActiveSpells = activateSpellEntry(nextActiveSpells, target.item);
        activeSpellsChanged = true;
      }
      if (activeSpellsChanged) {
        charPatch = { ...(charPatch || {}), activeSpells: nextActiveSpells };
      }

      const rollData = {
        characterId: ch.id,
        characterName: ch.name || "",
        abilityName: target.name,
        die: effDie,
        modifier: baseMod,
        skillRaw: dice.skillRaw, wildRaw: dice.wildRaw, keptRaw: dice.keptRaw,
        keptFaces: dice.keptFaces,
        extraDiceTotal,
        finalTotal,
        snakeEyes: isSnake,
        manualEntry: !isReroll && manual,
        isReroll: !!isReroll,
        isToughness,
        halfResult: health.halfResult,
        success: mainRoll.success,
        raises,
        itemType: isItem ? target.itemType : null,
        statusModifiers: {
          numericMod, dieSteps,
          extraDice: extraDiceList.length, successMod,
          situational: Number(situational || 0),
          attackModifier: attackMod,
          healthMod: health.mod,
        },
        tension: outcome ? { increment: outcome.increment, zone: outcome.zoneAfter } : null,
      };

      const display = { ...rollData, isWild: dice.isWild, outcome, keptFaces: dice.keptFaces, spellCost: charPatch ? spellCost : 0 };
      setResult(display);

      if (isReroll) {
        const fateDebtInstance = buildStatusInstance(campaignStatuses, FATE_DEBT, "reroll", ["debt_fate"]);
        await onCommit({ charId: ch.id, rollData, reroll: true, fateDebtInstance });
      } else {
        const exhaustionInstance = outcome?.addExhaustion
          ? buildStatusInstance(campaignStatuses, MENTAL_EXHAUSTION, "tension", ["shock_mental"])
          : null;
        await onCommit({ charId: ch.id, rollData, outcome, exhaustionInstance, charPatch });
      }
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

          {health.halfResult && <div className="kk-roll-warn">{isToughness ? "Пип 5: результат броска стойкости делится пополам." : "Ранение: результат броска делится пополам."}</div>}
          {willTrigger && !blocked && <div className="kk-roll-tension-note">⚗ Способность вызывает проверку напряжения.</div>}
          {spellCost > 0 && <div className="kk-roll-tension-note">Стоимость каста: {spellCost} энергии (при успехе).</div>}
          {target.missingSkill && <div className="kk-roll-warn">Навык «{target.skillName}» не найден у персонажа — бросок идёт как d4.</div>}
          {target.needsSkill && <div className="kk-roll-warn">У предмета не задан навык — бросок идёт как d4.</div>}
          {stunBlocked && <div className="kk-roll-warn kk-roll-blocked">Оглушение (стан): броски заблокированы, пока стан активен.</div>}
          {tensionBlocked && <div className="kk-roll-warn kk-roll-blocked">Ментальное истощение: этот бросок заблокирован.</div>}
          {healthBlocked && <div className="kk-roll-warn kk-roll-blocked">Ранение: {health.reasons.join(", ") || "бросок заблокирован"} — {isToughness ? "" : "бросьте стойкость. "}бросок невозможен.</div>}
          {!castCheck.ok && <div className="kk-roll-warn kk-roll-blocked">{castCheck.reason}</div>}

          {!result && (
            <>
              {buffMods.length > 0 && (
                <div className="kk-roll-feats">
                  <div className="kk-roll-feats-title">Активные заклинания (расход применения)</div>
                  {buffMods.map((b) => (
                    <label className="kk-roll-feat" key={b.itemId}>
                      <input type="checkbox" checked={!excludedBuffs.has(b.itemId)} onChange={() => toggleBuff(b.itemId)} />
                      <span className="kk-roll-feat-name">{b.name}</span>
                      <span className="kk-roll-feat-eff">{signed(b.numericMod)}</span>
                    </label>
                  ))}
                </div>
              )}
              {applicableFeats.length > 0 && (
                <div className="kk-roll-feats">
                  <div className="kk-roll-feats-title">Черты (по желанию)</div>
                  {applicableFeats.map((f) => (
                    <label className={`kk-roll-feat ${f.isWeakness ? "weak" : ""}`} key={f.id}>
                      <input type="checkbox" checked={selFeats.has(f.id)} onChange={() => toggleFeat(f.id)} />
                      <span className="kk-roll-feat-name">{f.name}{f.isWeakness ? " ⚠" : ""}</span>
                      <span className="kk-roll-feat-eff">
                        {[f.numericMod && `${signed(f.numericMod)}`, f.dieSteps && `${signed(f.dieSteps)} ступ.`,
                          f.successMod && `${signed(f.successMod)} усп.`, f.extra.length && `+${f.extra.length} куб.`]
                          .filter(Boolean).join(", ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="kk-roll-manual-mods">
                <label className="kk-sc-field">
                  <span>Ситуативный модификатор</span>
                  <input className="kk-input sm" type="number" value={situational}
                    onChange={(e) => setSituational(e.target.value)} />
                </label>
                <label className="kk-sc-field">
                  <span>Модификатор успехов</span>
                  <input className="kk-input sm" type="number" value={successManual}
                    onChange={(e) => setSuccessManual(e.target.value)} />
                </label>
              </div>

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

              <button className="kk-btn primary kk-se-apply" onClick={() => doRoll(false)} disabled={busy || !canRollNow}>
                {busy ? "…" : manual ? "Применить" : "Бросить"}
              </button>
            </>
          )}

          {result && (
            <div className={`kk-roll-result ${result.snakeEyes ? "fail" : result.success ? "ok" : "fail"}`}>
              {result.isReroll && <div className="kk-roll-reroll-badge">↻ Переброс (жетон судьбы)</div>}
              <div className="kk-roll-dice">
                <span>Навык: {result.skillRaw}</span>
                <span>Wild: {result.wildRaw}</span>
                <span className="kk-roll-kept">
                  Оставлено: {result.isWild ? "Wild — " : ""}{formatFaces(result.keptFaces) || result.keptRaw}
                </span>
              </div>
              <div className="kk-roll-total">
                Итог: <b>{result.finalTotal}</b>{" "}
                <em>({result.keptRaw}{result.extraDiceTotal ? ` +${result.extraDiceTotal} доп.куб` : ""}{result.modifier ? signed(result.modifier) : ""}{result.halfResult ? " ÷2" : ""})</em>
              </div>
              <div className="kk-roll-verdict">
                {result.snakeEyes ? "💀 Критический провал (глаза змеи)"
                  : result.success ? `✔ Успех${result.raises > 0 ? ` · рейзы: ${result.raises}` : ""}`
                  : "✘ Провал"}
              </div>
              {result.spellCost > 0 && <div className="kk-roll-tension-res">−{result.spellCost} энергии</div>}
              {result.outcome?.triggered && (
                isGM ? (
                  <div className="kk-roll-tension-res kk-roll-tension-gm">
                    ⚗ Напряжение {result.outcome.increment > 0 ? "+" : ""}{result.outcome.increment}
                    {result.outcome.d100 ? <em className="kk-roll-tension-d100"> · d100 {result.outcome.d100.result} / порог {result.outcome.d100.threshold} ({result.outcome.d100.failed ? "провал" : "успех"})</em> : null}
                    {result.outcome.addExhaustion ? " · Ментальное истощение!" : ""}
                  </div>
                ) : (
                  <div className="kk-roll-tension-res">
                    {result.outcome.increment > 0 ? "⚗ Напряжение возросло"
                      : result.outcome.increment < 0 ? "⚗ Напряжение снизилось"
                      : "⚗ Напряжение без изменений"}
                    {result.outcome.addExhaustion ? " · Ментальное истощение!" : ""}
                  </div>
                )
              )}

              {/* Attack producer (B-54) — pick target(s) and dispatch damage. */}
              {canAttack && attackData && (
                <div className="kk-attack-section">
                  <div className="kk-attack-title">Атака</div>
                  <div className="kk-attack-summary">{combat.attackSummary(attackData)}</div>
                  {attackSent ? (
                    <div className="kk-attack-sent">✔ Урон отправлен цели{attackTargets.size > 1 ? "ям" : ""}.</div>
                  ) : attackRoster.length === 0 ? (
                    <div className="kk-attack-empty">Нет доступных целей.</div>
                  ) : (
                    <>
                      <div className="kk-attack-pick-hint">
                        {isAoe ? "Площадная атака — выберите цели:" : "Выберите цель:"}
                      </div>
                      <div className="kk-attack-targets">
                        {attackRoster.map((t) => (
                          <label className="kk-attack-target" key={t.id}>
                            <input
                              type={isAoe ? "checkbox" : "radio"}
                              name="kk-attack-target"
                              checked={attackTargets.has(t.id)}
                              onChange={() => toggleAttackTarget(t.id)}
                            />
                            <span className="kk-attack-target-name">{t.name}</span>
                            {t.kind === "npc" && <span className="kk-attack-target-kind">NPC</span>}
                          </label>
                        ))}
                      </div>
                      <button
                        className="kk-btn primary sm kk-attack-send"
                        onClick={sendAttack}
                        disabled={busy || attackTargets.size === 0}
                      >
                        {busy ? "…" : "Нанести урон"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Reroll toast — offered right after the roll (Долг судьбы). */}
              {canReroll && !confirmReroll && (
                <button className="kk-btn ghost sm kk-roll-reroll-btn" onClick={() => setConfirmReroll(true)} disabled={busy}>
                  ↻ Перебросить · жетон судьбы ({ch.bennies})
                </button>
              )}
              {confirmReroll && (
                <div className="kk-roll-reroll-confirm">
                  <div>Потратить 1 жетон судьбы на переброс? Останется: {(ch.bennies ?? 0) - 1}. Наложится «Долг судьбы».</div>
                  <div className="kk-roll-reroll-actions">
                    <button className="kk-btn primary sm" onClick={() => doRoll(true)} disabled={busy}>{busy ? "…" : "Перебросить"}</button>
                    <button className="kk-btn ghost sm" onClick={() => setConfirmReroll(false)} disabled={busy}>Отмена</button>
                  </div>
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
