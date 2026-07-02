// ============================================================
// КК9 — Статусные эффекты при бросках (FEAT-16 / B-53).
// Чистый модуль: сбор модификаторов броска, штрафы здоровья,
// и тик периодических статусов (урон/исцеление/напряжение/энергия,
// прогрессия, стан). Порт Foundry weapon-combat.mjs:
//   _applyStatusEffects / triggerStatusEffectsOnRoll / _tickProgression /
//   collectStatusModifiers.
// ============================================================

import { deriveHealthModForAttr } from "./derive";
import { effectiveEnergyMax, tensionAdjustPatch, TENSION_DEFAULTS } from "./tension";

function rUid() { return Math.random().toString(36).slice(2, 10); }

// Категория 1 — тикает на каждом броске (STATUS_CATEGORY_1).
const TICK_EVERY_ROLL = new Set(["bleed", "burn", "acid", "electric", "shock_mental"]);
// Категория 2 — тикает раз в N бросков (STATUS_CATEGORY_2). N — настройка мира
// (Foundry `status.charges_per_trigger`, по умолчанию 3), НЕ progress_every.
const TICK_PERIODIC = new Set(["poison", "infection", "disease", "cold"]);
const DEFAULT_CHARGES_PER_TRIGGER = 3;

const attrTargetKey = {
  agility: "target_agility",
  smarts: "target_smarts",
  spirit: "target_spirit",
  endurance: "target_endurance",
  magic: "target_magic",
};

// Does a roll_modifier-shaped payload apply to the current roll context?
// ctx: { attribute, skillName, itemType, isToughness }
function modifierHits(rm, ctx, tKey) {
  return !!(
    rm.target_all ||
    (tKey && rm[tKey]) ||
    (ctx.isToughness && rm.target_toughness) ||
    (ctx.attribute === "initiative" && (rm.target_initiative || rm.target_agility || rm.target_smarts)) ||
    (ctx.skillName && Array.isArray(rm.target_skills) && rm.target_skills.includes(ctx.skillName)) ||
    // Item-type targeting: an item roll (weapon/gear/artifact/device) can be hit by
    // target_all_items or the type-specific flag (target_weapon/gear/artifact/device).
    (ctx.itemType && (rm.target_all_items || rm[`target_${ctx.itemType}`]))
  );
}

// Reconcile the extra-die schema (B-52 deferred → B-53): produce per-die entries
// { faces, mode } from either the Foundry-shaped extra_die_enabled/faces/mode OR
// the legacy numeric extra_dice count (N × additive d6).
function extraDiceFromRm(rm) {
  const list = [];
  if (rm.extra_die_enabled) {
    list.push({ faces: rm.extra_die_faces || 6, mode: rm.extra_die_mode === "subtract" ? "subtract" : "add" });
  }
  const legacy = Number(rm.extra_dice || 0);
  for (let i = 0; i < legacy; i++) list.push({ faces: 6, mode: "add" });
  return list;
}

/**
 * Сводит модификаторы броска для конкретного навыка/атрибута/предмета из трёх
 * источников: активные статусы, черты персонажа, активные артефакты.
 *
 * @param {object} ch    — персонаж
 * @param {object} ctx   — { attribute, skillName, itemType, isToughness }
 * @param {Array}  items — предметы персонажа (для бонусов активных артефактов)
 * @returns {{ numericMod, dieSteps, extraDiceList, successMod, sources }}
 *   extraDiceList — [{ faces, mode }] к броску (см. rollExtraDiceList).
 *   sources — вклады { label, kind, numericMod, dieSteps, extraCount, successMod }.
 */
export function collectRollModifiers(ch, ctx = {}, items = [], opts = {}) {
  let numericMod = 0, dieSteps = 0, successMod = 0;
  const extraDiceList = [];
  const sources = [];
  const tKey = attrTargetKey[ctx.attribute];

  const add = (label, kind, parts) => {
    const p = {
      numericMod: parts.numericMod || 0,
      dieSteps: parts.dieSteps || 0,
      successMod: parts.successMod || 0,
      extra: parts.extra || [],
    };
    if (!p.numericMod && !p.dieSteps && !p.successMod && p.extra.length === 0) return;
    numericMod += p.numericMod;
    dieSteps   += p.dieSteps;
    successMod += p.successMod;
    extraDiceList.push(...p.extra);
    sources.push({
      label, kind,
      numericMod: p.numericMod, dieSteps: p.dieSteps, successMod: p.successMod,
      extraCount: p.extra.length,
    });
  };

  // 1 — статусы
  for (const inst of ch?.activeStatuses || []) {
    for (const eff of inst.effects || []) {
      if (!eff.enabled || eff.type !== "roll_modifier") continue;
      const rm = eff.roll_modifier || {};
      if (!modifierHits(rm, ctx, tKey)) continue;
      add(inst.name || "Статус", "status", {
        numericMod: rm.modifier ?? 0,
        dieSteps: rm.die_change ?? 0,
        successMod: rm.success_modifier ?? 0,
        extra: extraDiceFromRm(rm),
      });
    }
  }

  // 2 — черты персонажа (imена полей совпадают со статусом).
  // Пре-ролл (B-57): черты — выбираемые. По умолчанию collectRollModifiers их
  // включает (обратная совместимость); RollDialog передаёт opts.skipFeatures и
  // добавляет только отмеченные галочками через collectApplicableFeatures.
  if (!opts.skipFeatures) {
    for (const feat of ch?.features || []) {
      const rm = feat?.modifier;
      if (!rm || typeof rm !== "object") continue;
      if (!modifierHits(rm, ctx, tKey)) continue;
      add(feat.name || "Черта", "feature", {
        numericMod: rm.modifier ?? 0,
        dieSteps: rm.die_change ?? 0,
        successMod: rm.success_modifier ?? 0,
        extra: extraDiceFromRm(rm),
      });
    }
  }

  // 3 — активные артефакты (бонусы к атрибуту/навыку; с учётом состояния — B-54)
  for (const it of items || []) {
    if (it.type !== "artifact" || !it.active || it.destroyed) continue;
    const mult = conditionBonusMult(it.condition);
    const attrRaw = ctx.attribute && it.bonuses ? Number(it.bonuses[ctx.attribute] || 0) : 0;
    const attrBonus = Math.floor(attrRaw * mult);
    let skillBonus = 0;
    if (ctx.skillName && Array.isArray(it.skillBonuses)) {
      for (const sb of it.skillBonuses) {
        if (sb.skillName === ctx.skillName) skillBonus += Math.floor(Number(sb.bonus || 0) * mult);
      }
    }
    add(it.name || "Артефакт", "artifact", { numericMod: attrBonus + skillBonus });
  }

  return { numericMod, dieSteps, extraDiceList, successMod, sources };
}

/**
 * Пре-ролл (B-57): применимые к текущему броску черты персонажа — для
 * чек-боксов в диалоге броска. Фильтр тот же, что и в collectRollModifiers
 * (modifierHits), но каждая черта отдаётся отдельно, чтобы игрок мог выбрать,
 * какие применить (порт preroll.mjs `_isApplicable` + список черт).
 *
 * @param {object} ch  — персонаж
 * @param {object} ctx — { attribute, skillName, itemType, isToughness }
 * @returns {Array<{ id, name, isWeakness, numericMod, dieSteps, successMod, extra }>}
 */
export function collectApplicableFeatures(ch, ctx = {}) {
  const tKey = attrTargetKey[ctx.attribute];
  const out = [];
  const feats = ch?.features || [];
  feats.forEach((feat, i) => {
    const rm = feat?.modifier;
    if (!rm || typeof rm !== "object") return;
    if (!modifierHits(rm, ctx, tKey)) return;
    const numericMod = rm.modifier ?? 0;
    const dieSteps = rm.die_change ?? 0;
    const successMod = rm.success_modifier ?? 0;
    const extra = extraDiceFromRm(rm);
    if (!numericMod && !dieSteps && !successMod && extra.length === 0) return;
    out.push({
      id: feat.id || `${feat.name || "feat"}#${i}`,
      name: feat.name || "Черта",
      isWeakness: !!feat.is_weakness,
      numericMod, dieSteps, successMod, extra,
    });
  });
  return out;
}

// Коэффициент состояния предмета для бонусов (B-54 groundwork):
// perfect=1.5, worn=0.5, broken=0, иначе=1. Порт soak.mjs `_condMult`.
export function conditionBonusMult(condition) {
  if (condition === "broken")  return 0;
  if (condition === "perfect") return 1.5;
  if (condition === "worn")    return 0.5;
  return 1;
}

/**
 * Штрафы здоровья к конкретному броску (оба трека). Прокси к derive.
 * @returns {{ mod:number, halfResult:boolean, blocked:boolean, reasons:string[] }}
 */
export function collectHealthPenalties(ch, attrKey = null, isToughness = false) {
  return deriveHealthModForAttr(ch, attrKey, isToughness);
}

// Builds a runtime status instance from a campaign status definition — used by
// progression spawns (mirror of StatusEditor.apply()).
function buildInstanceFromDef(def) {
  const dur = def.duration || {};
  const durationRemaining =
    dur.mode === "counter" || dur.mode === "charges" ? (dur.value ?? null) : null;
  return {
    _uid: rUid(),
    definitionId: def.id || "",
    name: def.name,
    status_types: def.status_types || [],
    apply_stun: def.apply_stun ?? false,
    durationMode: dur.mode || "time",
    durationRemaining,
    effects: def.effects || [],
    progresses: def.progresses ?? false,
    progress_every: def.progress_every ?? 1,
    progress_into_names: def.progress_into_names || [],
    progressCount: 0,
    tickCount: 0,
    source: "progression",
  };
}

// Применяет один эффект-пейлоад к аккумулятору (health/energy current+restore).
// tension.current накапливается отдельно (нужны настройки/оверкап). energy.max /
// tension.max — производные (derive.deriveStatusMaxMods), в тике не применяются.
function applyPayload(acc, eff, effEnergyMax) {
  if (eff.type === "health") {
    const h = eff.health || {};
    if (h.track && h.amount) {
      const key = h.track === "mental" ? "mental" : "physical";
      const delta = h.mode === "heal" ? -h.amount : h.amount;
      acc.health[key] = Math.max(0, (acc.health[key] ?? 0) + delta);
    }
  } else if (eff.type === "energy") {
    const en = eff.energy || {};
    if (en.mode === "current" && en.amount) {
      acc.energy = Math.max(0, Math.min(effEnergyMax, (acc.energy ?? 0) + en.amount));
    } else if (en.mode === "restore" && en.amount) {
      acc.energy = Math.min(effEnergyMax, (acc.energy ?? 0) + Math.abs(en.amount));
    }
  } else if (eff.type === "tension") {
    const te = eff.tension || {};
    if (te.mode === "current" && te.amount) acc.tensionDelta += te.amount;
  }
}

/**
 * Тик периодических статусов после броска.
 *   Категория 1 (кровотечение, горение, …) — каждый бросок.
 *   Категория 2 (яд, инфекция, …) — раз в N бросков (opts.chargesPerTrigger, 3).
 * Применяет эффекты (урон/исцеление/энергия/напряжение), прогрессию
 * (progress_every срабатываний → progress_into_names / стак себя, снимает
 * progresses), списывает заряд, удаляет статус при 0, пересчитывает стан.
 *
 * @param {object} ch    — персонаж
 * @param {object} opts  — { campaignStatuses:[], settings, chargesPerTrigger }
 * @returns {object|null} merge-патч или null
 */
export function tickStatuses(ch, opts = {}) {
  const statuses = ch?.activeStatuses || [];
  if (statuses.length === 0) return null;

  const campaignStatuses = opts.campaignStatuses || [];
  const settings = opts.settings || TENSION_DEFAULTS;
  const N = Math.max(1, opts.chargesPerTrigger || DEFAULT_CHARGES_PER_TRIGGER);
  const effEnergyMax = effectiveEnergyMax(ch);
  const findDef = (name) => campaignStatuses.find((d) => d.name === name);

  const acc = {
    health: {
      physical: ch.health?.physical?.value ?? 0,
      mental: ch.health?.mental?.value ?? 0,
    },
    energy: ch.energy?.value ?? 0,
    tensionDelta: 0,
  };

  let changed = false;
  const next = [];
  const spawned = [];

  for (const s of statuses) {
    const types = s.status_types || [];
    const isCat1 = types.some((t) => TICK_EVERY_ROLL.has(t));
    const isCat2 = types.some((t) => TICK_PERIODIC.has(t));
    if (!isCat1 && !isCat2) { next.push(s); continue; }

    changed = true;

    // Cadence: cat1 fires every roll; cat2 fires every N rolls.
    let tickCount = (s.tickCount ?? 0) + 1;
    let fires;
    if (isCat1) {
      fires = true;
      tickCount = 0;
    } else {
      fires = tickCount >= N;
      if (fires) tickCount = 0;
    }

    let updated = { ...s, tickCount };

    if (fires) {
      for (const eff of s.effects || []) {
        if (eff.enabled === false) continue;
        applyPayload(acc, eff, effEnergyMax);
      }

      // Прогрессия: считаем срабатывания эффекта, при достижении progress_every —
      // накладываем progress_into_names (или стакаем себя), снимаем progresses.
      if (updated.progresses) {
        const every = Math.max(1, updated.progress_every ?? 1);
        const pc = (updated.progressCount ?? 0) + 1;
        if (pc >= every) {
          updated.progressCount = 0;
          updated.progresses = false; // fires once
          const targets = updated.progress_into_names || [];
          if (targets.length === 0) {
            const def = findDef(updated.name);
            if (def) spawned.push(buildInstanceFromDef(def));
          } else {
            for (const nm of targets) {
              const def = findDef(nm);
              if (def) spawned.push(buildInstanceFromDef(def));
            }
          }
        } else {
          updated.progressCount = pc;
        }
      }

      // Списываем заряд (charges/counter c auto_reduce).
      if ((updated.durationMode === "charges" || updated.durationMode === "counter")
          && updated.durationRemaining != null) {
        updated.durationRemaining = updated.durationRemaining - 1;
      }
    }

    // Истёк — не переносим.
    if (updated.durationRemaining != null && updated.durationRemaining <= 0) continue;
    next.push(updated);
  }

  if (spawned.length) { next.push(...spawned); changed = true; }
  if (!changed && acc.tensionDelta === 0) return null;

  const patch = {};
  const finalStatuses = next;

  if (changed) {
    patch.activeStatuses = finalStatuses;
    // Стан: держится, пока на персонаже есть хоть один apply_stun статус.
    const stunnedNow = finalStatuses.some((s) => s.apply_stun);
    if (stunnedNow !== !!ch.is_stunned) patch.is_stunned = stunnedNow;
  }
  if (acc.health.physical !== (ch.health?.physical?.value ?? 0)) patch["health.physical.value"] = acc.health.physical;
  if (acc.health.mental !== (ch.health?.mental?.value ?? 0)) patch["health.mental.value"] = acc.health.mental;
  if (acc.energy !== (ch.energy?.value ?? 0)) patch["energy.value"] = acc.energy;
  if (acc.tensionDelta !== 0) {
    const tp = tensionAdjustPatch(ch, acc.tensionDelta, settings);
    if (tp) Object.assign(patch, tp);
  }

  return Object.keys(patch).length ? patch : null;
}
