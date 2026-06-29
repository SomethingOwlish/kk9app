// ============================================================
// КК9 — Статусные эффекты при бросках (FEAT-16).
// Чистый модуль: сбор модификаторов броска, штрафы здоровья,
// и тик периодических статусов (урон/исцеление по времени).
// ============================================================

import { derivePipHealthPenalty } from "./derive";

// Категория 1 — тикает на каждом броске.
const TICK_EVERY_ROLL = new Set(["bleed", "burn", "acid", "electric", "shock_mental"]);
// Категория 2 — тикает раз в progress_every бросков.
const TICK_PERIODIC = new Set(["poison", "infection", "disease", "cold"]);

const attrTargetKey = {
  agility: "target_agility",
  smarts: "target_smarts",
  spirit: "target_spirit",
  endurance: "target_endurance",
  magic: "target_magic",
};

/**
 * Сводит модификаторы броска из активных статусов для конкретного навыка/атрибута.
 * @param {object} ch          — персонаж
 * @param {object} ctx         — { attribute, skillName }
 * @returns {{ numericMod, dieSteps, extraDice, successMod }}
 */
export function collectRollModifiers(ch, ctx = {}) {
  let numericMod = 0, dieSteps = 0, extraDice = 0, successMod = 0;
  const tKey = attrTargetKey[ctx.attribute];
  for (const inst of ch?.activeStatuses || []) {
    for (const eff of inst.effects || []) {
      if (!eff.enabled || eff.type !== "roll_modifier") continue;
      const rm = eff.roll_modifier || {};
      const hits =
        rm.target_all ||
        (tKey && rm[tKey]) ||
        (ctx.attribute === "initiative" && (rm.target_initiative || rm.target_agility || rm.target_smarts)) ||
        (ctx.skillName && Array.isArray(rm.target_skills) && rm.target_skills.includes(ctx.skillName));
      if (!hits) continue;
      numericMod += rm.modifier ?? 0;
      dieSteps   += rm.die_change ?? 0;
      extraDice  += rm.extra_dice ?? 0;
      successMod += rm.success_modifier ?? 0;
    }
  }
  return { numericMod, dieSteps, extraDice, successMod };
}

/**
 * Штрафы здоровья к броску. Pip 4/5 физического трека → результат пополам.
 * @returns {{ halfResult: boolean }}
 */
export function collectHealthPenalties(ch) {
  return { halfResult: derivePipHealthPenalty(ch) };
}

// Применяет один эффект-пейлоад к аккумулятору значений (изменяет acc).
function applyPayload(acc, eff) {
  const h = eff.health || {};
  if (eff.type === "health" && h.track && h.amount) {
    const key = h.track === "mental" ? "mental" : "physical";
    const delta = h.mode === "heal" ? -h.amount : h.amount;
    acc.health[key] = Math.max(0, (acc.health[key] ?? 0) + delta);
  }
  const en = eff.energy || {};
  if (eff.type === "energy" && en.amount) {
    const delta = en.mode === "drain" ? -en.amount : en.amount;
    acc.energy = Math.max(0, (acc.energy ?? 0) + delta);
  }
}

/**
 * Тик периодических статусов после броска.
 * Категория 1 (кровотечение, горение, …) тикает каждый бросок;
 * категория 2 (яд, инфекция, …) — раз в progress_every бросков.
 * Применяет пейлоады эффектов, списывает заряд, удаляет статус при 0.
 *
 * @param {object} ch          — персонаж
 * @returns {object|null} merge-патч или null, если ничего не изменилось
 */
export function tickStatuses(ch) {
  const statuses = ch?.activeStatuses || [];
  if (statuses.length === 0) return null;

  const acc = {
    health: {
      physical: ch.health?.physical?.value ?? 0,
      mental: ch.health?.mental?.value ?? 0,
    },
    energy: ch.energy?.value ?? 0,
  };

  let changed = false;
  const next = [];

  for (const s of statuses) {
    const types = s.status_types || [];
    const isCat1 = types.some((t) => TICK_EVERY_ROLL.has(t));
    const isCat2 = types.some((t) => TICK_PERIODIC.has(t));
    if (!isCat1 && !isCat2) { next.push(s); continue; }

    const every = isCat2 ? Math.max(1, s.progress_every ?? s.progressEvery ?? 1) : 1;
    const tickCount = (s.tickCount ?? 0) + 1;
    const fires = tickCount % every === 0;

    let updated = { ...s, tickCount };
    changed = true;

    if (fires) {
      for (const eff of s.effects || []) applyPayload(acc, eff);
      // Списываем заряд для счётчиковых/зарядовых статусов.
      if ((s.durationMode === "charges" || s.durationMode === "counter") && s.durationRemaining != null) {
        updated.durationRemaining = s.durationRemaining - 1;
      }
    }

    if (updated.durationRemaining != null && updated.durationRemaining <= 0) {
      // статус истёк — не добавляем в next
      continue;
    }
    next.push(updated);
  }

  if (!changed) return null;

  const patch = { activeStatuses: next };
  if (acc.health.physical !== (ch.health?.physical?.value ?? 0)) patch["health.physical.value"] = acc.health.physical;
  if (acc.health.mental !== (ch.health?.mental?.value ?? 0)) patch["health.mental.value"] = acc.health.mental;
  if (acc.energy !== (ch.energy?.value ?? 0)) patch["energy.value"] = acc.energy;
  return patch;
}
