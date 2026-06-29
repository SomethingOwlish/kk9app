// ============================================================
// КК9 — Логика предметов: активация/снаряжение, зависимость колец,
// и подготовка цели броска для предмета (FEAT, item roller).
// Чистый модуль — без Firestore. Портировано из docs/OldCode/kk9
// (weapon-combat.mjs: _checkRingEquipped/_guardRing, sheets.mjs toggles).
// ============================================================

// Предметы, которые можно «активировать» (вкл/выкл эффект).
export const ACTIVATABLE_TYPES = new Set(["artifact", "spell", "gear", "device"]);
// Предметы, которые можно «снаряжать» (носить/держать наготове).
export const EQUIPPABLE_TYPES = new Set(["weapon", "artifact", "gear", "device"]);

/** Есть ли у персонажа активный (надетый) артефакт-кольцо. */
export function hasActiveRing(items = []) {
  return (items || []).some(
    (it) => it.type === "artifact" && it.artifactType === "ring" && it.active && !it.destroyed,
  );
}

/** Требует ли заклинание кольцо/жезл для каста. */
export function spellNeedsRing(spell) {
  return !!spell && !spell.noWandNeeded;
}

/**
 * Можно ли скастовать заклинание прямо сейчас.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canCastSpell(spell, items = []) {
  if (spellNeedsRing(spell) && !hasActiveRing(items)) {
    return { ok: false, reason: "Нужно активное кольцо (артефакт). Активируйте кольцо или включите «Без жезла»." };
  }
  return { ok: true };
}

const DAMAGE_LEVEL_LABEL = { light: "Лёгкий", heavy: "Тяжёлый", lethal: "Летальный" };

/**
 * Строит цель броска (target) для предмета, опираясь на навык персонажа.
 * Возвращает объект, совместимый с RollDialog:
 *   { kind:"item", itemType, itemId, name, die, modifier, attribute, skillName,
 *     attackModifier, missingSkill, item }
 * Если у персонажа нет такого навыка — missingSkill=true, die=4.
 */
export function buildItemRollTarget(item, ch) {
  const skillName = item.skillName || "";
  const skill = (ch?.skills || []).find((s) => s.name === skillName);
  const attackModifier = Number(item.attackModifier || 0);
  const baseMod = (skill?.modifier ?? 0) + attackModifier;

  const dmgBits = [];
  if (item.damageLevel) dmgBits.push(DAMAGE_LEVEL_LABEL[item.damageLevel] || item.damageLevel);
  if (item.range > 0) dmgBits.push(`${item.range}м`);
  if (item.ap > 0) dmgBits.push(`БП ${item.ap}`);

  return {
    kind: "item",
    itemType: item.type,
    itemId: item.id,
    name: item.name,
    die: skill?.die ?? 4,
    modifier: baseMod,
    attribute: skill?.attr ?? null,
    skillName,
    attackModifier,
    missingSkill: !!skillName && !skill,
    needsSkill: !skillName,
    spellCost: item.type === "spell" ? Number(item.cost || 0) : 0,
    damageInfo: dmgBits.join(" · "),
    statusName: item.hasStatus ? item.statusName : "",
    item,
  };
}
