// ============================================================
// КК9 — Система психического напряжения (FEAT-16, полная версия).
// Портировано из docs/OldCode/kk9/module/relations.mjs и адаптировано
// под React/Firestore: чистые функции, без записи в БД.
//
// Поток: после броска навыка caller вызывает computeTensionOutcome(...),
// получает дескриптор { patch, addExhaustion, removeExhaustion, log } и
// сам применяет patch (updateCharacterNow) + статус истощения (applyStatus).
// ============================================================

import {
  TENSION_ABILITIES, TENSION_HEAVY, TENSION_RESTORE,
} from "./dice";
import { deriveStatusMaxMods } from "./derive";

export const MENTAL_EXHAUSTION = "Ментальное истощение";

// Значения по умолчанию (Foundry world settings). GM может переопределить
// через campaign.tension.* — см. tensionSettings().
export const TENSION_DEFAULTS = {
  failThreshold: 10,   // d100 ≤ failThreshold + current → провал
  energyPenalty: 3,    // штраф к макс. энергии за каждый вход в оверкап
  overcapLimit: 10,    // оверкап ≥ лимита → Ментальное истощение
  heavyIncrement: 2,   // прирост при провале «тяжёлых» способностей
};

export function tensionSettings(campaign) {
  const t = campaign?.tension || {};
  return {
    failThreshold:  Number.isFinite(t.failThreshold)  ? t.failThreshold  : TENSION_DEFAULTS.failThreshold,
    energyPenalty:  Number.isFinite(t.energyPenalty)  ? t.energyPenalty  : TENSION_DEFAULTS.energyPenalty,
    overcapLimit:   Number.isFinite(t.overcapLimit)   ? t.overcapLimit   : TENSION_DEFAULTS.overcapLimit,
    heavyIncrement: Number.isFinite(t.heavyIncrement) ? t.heavyIncrement : TENSION_DEFAULTS.heavyIncrement,
  };
}

// Способность вызывает проверку напряжения, если она в явном списке
// ИЛИ это навык магической категории (categ === "magic") у персонажа.
export function abilityTriggersTension(ch, abilityName) {
  if (TENSION_ABILITIES.has(abilityName)) return true;
  return (ch?.skills || []).some((s) => s.name === abilityName && s.categ === "magic");
}

export function isHeavyTension(abilityName) {
  return TENSION_HEAVY.has(abilityName);
}
export function isRestoreTension(abilityName) {
  return TENSION_RESTORE.has(abilityName);
}

// Активен ли статус Ментального истощения.
function hasExhaustionStatus(ch) {
  return (ch?.activeStatuses || []).some((s) => s.name === MENTAL_EXHAUSTION);
}

// Эффективный максимум напряжения с учётом статус-модификаторов (tension.mode=max).
export function effectiveTensionMax(ch) {
  const raw = ch?.tension?.max ?? 0;
  return Math.max(0, raw + deriveStatusMaxMods(ch).tensionMaxMod);
}

// Зона напряжения: green | yellow | red | exhausted.
export function getTensionZone(ch, settings = TENSION_DEFAULTS) {
  const t = ch?.tension;
  if (!t) return "none";
  const max = effectiveTensionMax(ch);
  if ((t.overcap ?? 0) >= settings.overcapLimit) return "exhausted";
  if ((t.current ?? 0) >= max) return "red";
  if ((t.current ?? 0) >= Math.floor(max * 0.5)) return "yellow";
  return "green";
}

// Блокировка броска: истощённый персонаж не может бросать «напряжённые»
// способности и (по правилам) навыки, связанные со Смекалкой.
export function isTensionBlocked(ch, abilityName, linkedAttribute) {
  if (!hasExhaustionStatus(ch)) return false;
  if (abilityTriggersTension(ch, abilityName)) return true;
  if (linkedAttribute === "smarts") return true;
  return false;
}

// Скрытый бросок d100 напряжения. Возвращает { result, threshold, failed }.
function rollTensionD100(current, settings) {
  const threshold = settings.failThreshold + (current ?? 0);
  const result = Math.floor(Math.random() * 100) + 1;
  return { result, threshold, failed: result <= threshold };
}

// Применяет прирост напряжения к текущему состоянию, считает оверкап и
// накопленный штраф к энергии (как в Foundry: штраф за каждый вход в оверкап).
function applyIncrease(t, amount, settings) {
  const max = t.max ?? 0;
  const curBefore = t.current ?? 0;
  const overcapBefore = t.overcap ?? 0;
  const penaltyBefore = t.energyPenalty ?? 0;
  const newCurrent = curBefore + amount;

  const overcapDelta = Math.max(0, newCurrent - max) - Math.max(0, curBefore - max);
  const newOvercap = overcapBefore + overcapDelta;
  // Штраф к энергии начисляется, когда напряжение оказывается за порогом.
  const newPenalty = newCurrent > max ? penaltyBefore + settings.energyPenalty : penaltyBefore;

  return { current: newCurrent, overcap: newOvercap, energyPenalty: newPenalty, max };
}

/**
 * Главный расчёт напряжения после броска навыка.
 * @param {object} ch          — документ персонажа
 * @param {string} abilityName — имя навыка/способности
 * @param {object} mainRoll    — результат основного броска { success, snakeEyes }
 * @param {object} settings    — tensionSettings(campaign)
 * @returns {object|null} дескриптор или null, если напряжение не применимо
 *   { triggered, restore, d100, increment, tensionPatch, addExhaustion, removeExhaustion, zoneBefore, zoneAfter }
 */
export function computeTensionOutcome(ch, abilityName, mainRoll, settings = TENSION_DEFAULTS) {
  if (!ch?.tension) return null;
  // Work against the effective max (folds tension.mode=max status modifiers).
  const t = { ...ch.tension, max: effectiveTensionMax(ch) };

  const zoneBefore = getTensionZone(ch, settings);

  // Восстановление (Медитация/Секс): успех снимает напряжение ×2, глаза змеи → +1.
  if (isRestoreTension(abilityName)) {
    if (mainRoll?.snakeEyes) {
      const next = applyIncrease(t, 1, settings);
      return {
        triggered: true, restore: true, d100: null, increment: 1,
        tensionPatch: tensionToPatch(next),
        addExhaustion: false, removeExhaustion: false,
        zoneBefore, zoneAfter: getZoneOf(next, settings),
      };
    }
    if (!mainRoll?.success) return null;
    const raises = mainRoll.raises ?? 0;
    const reduceBy = (1 + raises) * 2; // 1 успех + по 2 за каждый рейз? → правила: успехи ×2.
    const next = reduceTension(t, reduceBy, settings);
    return {
      triggered: true, restore: true, d100: null, increment: -reduceBy,
      tensionPatch: tensionToPatch(next),
      addExhaustion: false,
      removeExhaustion: next.overcap === 0 && next.current < (t.max ?? 0) && hasExhaustionStatus(ch),
      zoneBefore, zoneAfter: getZoneOf(next, settings),
    };
  }

  if (!abilityTriggersTension(ch, abilityName)) return null;

  // Скрытый d100.
  const d100 = rollTensionD100(t.current ?? 0, settings);
  const baseInc = d100.failed ? (isHeavyTension(abilityName) ? settings.heavyIncrement : 1) : 0;
  const increment = baseInc + (mainRoll?.snakeEyes ? 1 : 0);

  if (increment === 0) {
    return {
      triggered: true, restore: false, d100, increment: 0,
      tensionPatch: null, addExhaustion: false, removeExhaustion: false,
      zoneBefore, zoneAfter: zoneBefore,
    };
  }

  const next = applyIncrease(t, increment, settings);
  const zoneAfter = getZoneOf(next, settings);
  return {
    triggered: true, restore: false, d100, increment,
    tensionPatch: tensionToPatch(next),
    addExhaustion: zoneAfter === "exhausted" && zoneBefore !== "exhausted",
    removeExhaustion: false,
    zoneBefore, zoneAfter,
  };
}

// Снижение напряжения (тайм-ревинд, восстановление, ГМ).
export function reduceTension(t, amount) {
  const cur = t.current ?? 0;
  const overcap = t.overcap ?? 0;
  const max = t.max ?? 0;
  const newCurrent = Math.max(0, cur - amount);
  const newOvercap = Math.max(0, Math.min(overcap, Math.max(0, newCurrent - max)));
  // Полное обнуление оверкапа снимает накопленный штраф к энергии.
  const newPenalty = newOvercap === 0 && newCurrent < max ? 0 : (t.energyPenalty ?? 0);
  return { current: newCurrent, overcap: newOvercap, energyPenalty: newPenalty, max };
}

// Ручная корректировка напряжения ГМом (+/−). Возвращает merge-патч,
// корректно пересчитывая оверкап и штраф к энергии.
export function tensionAdjustPatch(ch, delta, settings = TENSION_DEFAULTS) {
  const t = ch?.tension;
  if (!t) return null;
  const next = delta >= 0 ? applyIncrease(t, delta, settings) : reduceTension(t, -delta, settings);
  return tensionToPatch(next);
}

// Полный сброс напряжения (ГМ).
export function tensionClearPatch() {
  return { "tension.current": 0, "tension.overcap": 0, "tension.energyPenalty": 0 };
}

function getZoneOf(state, settings) {
  if ((state.overcap ?? 0) >= settings.overcapLimit) return "exhausted";
  if ((state.current ?? 0) >= (state.max ?? 0)) return "red";
  if ((state.current ?? 0) >= Math.floor((state.max ?? 0) * 0.5)) return "yellow";
  return "green";
}

function tensionToPatch(state) {
  return {
    "tension.current": state.current,
    "tension.overcap": state.overcap,
    "tension.energyPenalty": state.energyPenalty,
  };
}

// Эффективный максимум энергии: база − штраф напряжения + статус-моды (energy.mode=max).
export function effectiveEnergyMax(ch) {
  const raw = ch?.energy?.max ?? 0;
  const statusMod = deriveStatusMaxMods(ch).energyMaxMod;
  return Math.max(0, raw - (ch?.tension?.energyPenalty ?? 0) + statusMod);
}
