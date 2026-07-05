import { useState, useMemo } from "react";
import * as combat from "../lib/combat";
import * as soak from "../lib/soak";
import { healthMax } from "../lib/portrait";
import { buildStatusInstance } from "../lib/statusInstance";

const BLEED_STATUS = "Кровотечение";

const OUTCOME_LABEL = {
  "absorbed": "Поглощено (абсолютная защита)",
  "companion-stun": "Спутник — только стан",
  "bypass-auto-damage": "Стойкость пробита — урон автоматически",
  "resisted": "Устоял",
  "bleed": "Кровотечение",
  "half-damage": "Урон пополам",
  "full-damage": "Полный урон",
};

// Gather the target's resistance abilities in soak's expected shape
// [{ id, name, die, modifier, attr }]. On this data model they live on
// character.skills (and possibly .features); match by RESIST_ABILITY_NAMES.
function gatherResistAbilities(ch) {
  const names = new Set(soak.RESIST_ABILITY_NAMES);
  const out = [];
  const seen = new Set();
  const push = (a, idx, src) => {
    if (!a || !names.has(a.name) || seen.has(a.name)) return;
    seen.add(a.name);
    out.push({
      id: a.id || `${src}:${idx}:${a.name}`,
      name: a.name,
      die: a.die || 4,
      modifier: a.modifier || 0,
      attr: a.attr || a.linkedAttribute || "spirit",
    });
  };
  (ch?.skills || []).forEach((s, i) => push(s, i, "skill"));
  (ch?.features || []).forEach((f, i) => push(f, i, "feature"));
  return out;
}

// Adapter: convert a soak.resolveSoak() result into a db.resolveAttackOnSelf plan.
//   1) healthPatch: cap each track's added pips at healthMax(attr die).
//      physical → endurance die, mental → spirit die (mirrors PartyCard/derive).
//   2) itemPatches: group soak's [{itemId,field,value}] by itemId (skip null ids —
//      those are activeSpells target-doc patches, out of scope for B-54).
//   3) statusInstances: "bleed" → campaign status «Кровотечение»; {attackStatusUuid}
//      → the attack's statusName. Missing campaign status is skipped.
function buildPlan(res, ch, attackData, campaignStatuses) {
  // 1) health cap per track.
  const healthPatch = {};
  const physMax = healthMax(ch.attributes?.endurance?.die ?? 4);
  const mentMax = healthMax(ch.attributes?.spirit?.die ?? 4);
  if (res.damageApplied?.physical > 0) {
    const cur = ch.health?.physical?.value || 0;
    // TODO: cross-track overflow (Foundry applyDamageToActor) — cap for now.
    healthPatch["health.physical.value"] = Math.min(physMax, cur + res.damageApplied.physical);
  }
  if (res.damageApplied?.mental > 0) {
    const cur = ch.health?.mental?.value || 0;
    // TODO: cross-track overflow (Foundry applyDamageToActor) — cap for now.
    healthPatch["health.mental.value"] = Math.min(mentMax, cur + res.damageApplied.mental);
  }

  // 2) group item patches by itemId (skip null-id activeSpells patches).
  const byItem = new Map();
  for (const p of res.itemPatches || []) {
    if (!p || p.itemId == null) continue;
    if (!byItem.has(p.itemId)) byItem.set(p.itemId, {});
    byItem.get(p.itemId)[p.field] = p.value;
  }
  const itemPatches = [...byItem.entries()].map(([itemId, fields]) => ({ itemId, fields }));

  // 3) status instances.
  const statusInstances = [];
  for (const st of res.statusesToApply || []) {
    if (st === "bleed") {
      const inst = buildStatusInstance(campaignStatuses, BLEED_STATUS, "attack", ["bleed"]);
      if (inst.definitionId) statusInstances.push(inst);
    } else if (st && st.attackStatusUuid) {
      const name = attackData?.statusName || "";
      if (name) {
        const inst = buildStatusInstance(campaignStatuses, name, "attack", []);
        if (inst.definitionId) statusInstances.push(inst);
      }
    }
  }

  return {
    healthPatch,
    statusInstances,
    itemPatches,
    soakSuccesses: res.soakSuccesses,
    degree: res.degree,
    resolveNote: OUTCOME_LABEL[res.outcome] || res.outcome,
  };
}

// Defender-side resolve panel (B-54). One attack, resolved on the defender's own
// character. Runs the pure soak math, converts it into a resolveAttackOnSelf plan,
// and hands the plan up via onResolve.
export default function AttackResolvePanel({ attack, ch, items = [], campaignStatuses = [], onResolve, onDismiss, isGM = false }) {
  const attackData = useMemo(() => attack?.attackData || {}, [attack]);
  const abilities = useMemo(() => gatherResistAbilities(ch), [ch]);
  const eligible = useMemo(
    () => soak.getEligibleAbilities(ch, attackData, abilities),
    [ch, attackData, abilities],
  );
  const bonuses = useMemo(
    () => soak.collectSoakBonuses(ch, attackData, items),
    [ch, attackData, items],
  );

  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function resolve(selectedAbilityIds) {
    if (busy) return;
    setBusy(true);
    try {
      // resolveSoak handles unresistable / bypassSoak internally per its outcomes.
      const soakRes = soak.resolveSoak({
        target: ch,
        attackData,
        items,
        abilities,
        selectedAbilityIds,
        // selectedBonusIds omitted → auto-apply ALL eligible bonuses (Foundry).
      });
      setRes(soakRes);
      const plan = buildPlan(soakRes, ch, attackData, campaignStatuses);
      await onResolve(plan);
    } catch (e) {
      alert("Ошибка сопротивления: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="kk-attack-resolve">
      <div className="kk-attack-resolve-head">
        <span className="kk-attack-resolve-from">{attack.attackerName || "Атакующий"} → {ch.name}</span>
        {attackData.unresistable && <span className="kk-attack-tag">неотразимо</span>}
      </div>
      <div className="kk-attack-resolve-summary">{combat.attackSummary(attackData)}</div>

      {!res && (
        <>
          {eligible.length > 0 && (
            <div className="kk-attack-resolve-abils">
              <div className="kk-attack-resolve-abils-title">Способности сопротивления</div>
              {eligible.map((a) => (
                <label className={`kk-attack-resolve-abil ${a.unavailable ? "unavail" : ""}`} key={a.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    disabled={a.unavailable}
                    onChange={() => toggle(a.id)}
                  />
                  <span className="kk-attack-resolve-abil-name">
                    d{a.die}{a.modifier ? (a.modifier > 0 ? ` +${a.modifier}` : ` ${a.modifier}`) : ""} · {a.name}
                  </span>
                  {a.unavailable && <span className="kk-attack-resolve-abil-why">{a.unavailableReason}</span>}
                </label>
              ))}
            </div>
          )}

          {bonuses.length > 0 && (
            <div className="kk-attack-resolve-bonuses">
              Авто-бонусы соака: {bonuses.map((b) => b.name).join(", ")}
            </div>
          )}

          <div className="kk-attack-resolve-actions">
            <button className="kk-btn primary sm" disabled={busy}
              onClick={() => resolve([...selected])}>
              {busy ? "…" : "Сопротивляться"}
            </button>
            <button className="kk-btn ghost sm" disabled={busy}
              onClick={() => resolve([])}>
              Без защиты
            </button>
            {isGM && (
              <button className="kk-btn ghost sm" disabled={busy}
                onClick={() => { if (!busy) onDismiss(); }}>
                Отклонить
              </button>
            )}
          </div>
        </>
      )}

      {res && (
        <div className="kk-attack-resolve-result">
          <div className="kk-attack-resolve-outcome">{OUTCOME_LABEL[res.outcome] || res.outcome}</div>
          <div className="kk-attack-resolve-degree">
            Стойкость: {res.degree?.label || "—"} ({res.soakSuccesses} усп. против {res.attackSuccesses} усп. атаки)
          </div>
          {(res.damageApplied?.physical > 0 || res.damageApplied?.mental > 0) && (
            <div className="kk-attack-resolve-dmg">
              Урон: {res.damageApplied.physical > 0 ? `${res.damageApplied.physical} физ. ` : ""}
              {res.damageApplied.mental > 0 ? `${res.damageApplied.mental} мент.` : ""}
            </div>
          )}
          {(res.reasons || []).length > 0 && (
            <div className="kk-attack-resolve-reasons">{res.reasons.join(" · ")}</div>
          )}
        </div>
      )}
    </div>
  );
}
