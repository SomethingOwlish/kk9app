// ============================================================
// КК9 — отдых, конец раунда и выдача жетона. Чистые функции, без Firestore.
// Порт Foundry: sleepActor (gm-board.mjs:68), _processRoundEnd
// (weapon-combat.mjs:549) и хук снятия напряжения при выдаче жетона
// (kk9.mjs:3597). Правила — ширма мастера, разделы 8–10.
// ============================================================

import { reduceTension, effectiveTensionMax, effectiveEnergyMax, MENTAL_EXHAUSTION } from "./tension";
import { npcKind } from "./npc";

// Энергия за один сон.
export const SLEEP_ENERGY = 8;
// Короткая защита слетает во сне: заклинание защиты длительностью до 8 часов
// (бессрочные — durationHours −1 — не трогаются).
const SHORT_DEFENSE_HOURS = 8;

function hasExhaustion(ch) {
  return (ch?.activeStatuses || []).some((s) => s.name === MENTAL_EXHAUSTION);
}

// Снять напряжение на `amount`. Возвращает патч: напряжение, оверкап, штраф к
// энергии и — когда оверкап обнулён и напряжение ниже максимума — снятое
// «Ментальное истощение» (то же условие, что у восстановления в tension.js).
export function tensionRecoveryPatch(ch, amount, statuses = ch?.activeStatuses || []) {
  if (!ch?.tension || !(amount > 0)) return {};
  const t = { ...ch.tension, max: effectiveTensionMax(ch) };
  const next = reduceTension(t, amount);
  const patch = {
    "tension.current": next.current,
    "tension.overcap": next.overcap,
    "tension.energyPenalty": next.energyPenalty,
  };
  if (hasExhaustion(ch) && next.overcap === 0 && next.current < (t.max ?? 0)) {
    patch.activeStatuses = statuses.filter((s) => s.name !== MENTAL_EXHAUSTION);
  }
  return patch;
}

// Можно ли спать: на 5-м пороге любой шкалы — нельзя. Пороги считаются по
// значению шкалы так же, как в Foundry: значение ≥ 5 — последний порог.
export function sleepBlockedReason(ch) {
  if ((ch?.health?.physical?.value ?? 0) >= 5) return "критическое физическое состояние";
  if ((ch?.health?.mental?.value ?? 0) >= 5) return "критическое ментальное состояние";
  return null;
}

/**
 * «Выспаться». Возвращает { patch, log } или { blocked } — ничего не пишет.
 *   - снимает стан;
 *   - снимает статусы-заряды (duration mode "charges");
 *   - гасит короткую защиту (заклинание защиты до 8 часов);
 *   - здоровье −1 порог на каждой шкале (лёгкий НПС — −2: его шкала 0/1/3/5);
 *   - энергия +8 до максимума;
 *   - напряжение −1.
 * @param {object} ch     — персонаж / НПС
 * @param {object[]} items — предметы кампании (тип заклинания по itemId)
 */
export function sleepPatch(ch, items = []) {
  const blocked = sleepBlockedReason(ch);
  if (blocked) return { blocked };

  const patch = {};
  const log = [];

  if (ch.is_stunned) { patch.is_stunned = false; log.push("оглушение снято"); }

  let statuses = ch.activeStatuses || [];
  const kept = statuses.filter((s) => s.durationMode !== "charges");
  if (kept.length !== statuses.length) {
    log.push(`статусы-заряды сняты (${statuses.length - kept.length})`);
    statuses = kept;
    patch.activeStatuses = statuses;
  }

  const itemById = new Map((items || []).map((it) => [it.id, it]));
  const spells = ch.activeSpells || [];
  const keptSpells = spells.filter((s) => {
    const it = itemById.get(s.itemId);
    if (!it || it.spellType !== "defense") return true;
    const h = it.durationHours ?? 0;
    return h === -1 || h > SHORT_DEFENSE_HOURS;
  });
  if (keptSpells.length !== spells.length) {
    patch.activeSpells = keptSpells;
    log.push(`заклинания защиты сняты (${spells.length - keptSpells.length})`);
  }

  const step = npcKind(ch) === "npc-light" ? 2 : 1;
  const phys = ch.health?.physical?.value ?? 0;
  const ment = ch.health?.mental?.value ?? 0;
  if (phys > 0) { patch["health.physical.value"] = Math.max(0, phys - step); log.push("физ. здоровье восстановлено"); }
  if (ment > 0) { patch["health.mental.value"] = Math.max(0, ment - step); log.push("мент. здоровье восстановлено"); }

  if (ch.energy) {
    const cur = ch.energy.value ?? 0;
    const next = Math.min(cur + SLEEP_ENERGY, effectiveEnergyMax(ch));
    if (next > cur) { patch["energy.value"] = next; log.push(`энергия +${next - cur}`); }
  }

  if (ch.tension && (ch.tension.current ?? 0) > 0) {
    Object.assign(patch, tensionRecoveryPatch(ch, 1, statuses));
    log.push("напряжение −1");
  }

  return { patch, log };
}

/**
 * Конец раунда боя (категория 3 статусов): у статусов с длительностью в зарядах
 * или раундах (counter) и галочкой «авто» списывается единица; на нуле статус
 * снимается. Признак «авто» живёт в определении статуса кампании.
 * @returns {{ patch:object, expired:string[] }}
 */
export function roundStatusPatch(ch, campaignStatuses = []) {
  const statuses = ch?.activeStatuses || [];
  if (!statuses.length) return { patch: {}, expired: [] };
  const defOf = (s) => campaignStatuses.find((d) => d.id === s.definitionId)
    || campaignStatuses.find((d) => d.name === s.name);

  let changed = false;
  const next = [];
  const expired = [];
  for (const s of statuses) {
    const auto = s.autoReduce ?? defOf(s)?.duration?.auto_reduce ?? false;
    const counted = s.durationMode === "charges" || s.durationMode === "counter";
    if (!auto || !counted || s.durationRemaining == null) { next.push(s); continue; }
    changed = true;
    const left = s.durationRemaining - 1;
    if (left <= 0) { expired.push(s.name); continue; }
    next.push({ ...s, durationRemaining: left });
  }
  if (!changed) return { patch: {}, expired };
  const patch = { activeStatuses: next };
  const stunned = next.some((s) => s.apply_stun);
  if (stunned !== !!ch.is_stunned) patch.is_stunned = stunned;
  return { patch, expired };
}

/**
 * Выдача жетона судьбы снимает напряжение, равное НОВОМУ числу жетонов.
 * Только выдача: трата (переброс) напряжение не трогает.
 */
export function bennieGrantPatch(ch, newBennies) {
  const old = ch?.bennies ?? 0;
  if (!(newBennies > old)) return {};
  return tensionRecoveryPatch(ch, newBennies);
}
