// Foundry embedded item → KK9 Firestore item doc (FEAT-20, TASK-103).
// Source fields are snake_case (`system.*`); target fields are the camelCase names
// the SPA reads (see src/lib/db.js / src/views/ItemsView.jsx). Cached *_name fields
// are kept for display; *_uuid fields are remapped to *Ref ids (null + warning if
// unresolved). Unknown item types are skipped by the caller.
import { stripHtml, num, str, bool } from "./util.js";

export const KNOWN_ITEM_TYPES = new Set([
  "weapon", "gear", "artifact", "spell", "device", "vehicle",
  "contact", "language", "status", "feature", "ability", "faculty",
]);

// Item types that become rows in the campaign `items` collection.
export const COLLECTION_ITEM_TYPES = new Set([
  "weapon", "gear", "artifact", "spell", "device", "vehicle", "feature",
]);

const ref = (map, uuid, field, owner) => map.resolve(uuid, field, owner);

export function mapItem(item, ownerCharacterId, map) {
  const s = item.system || {};
  const owner = item.name || item._id;
  const base = {
    type: item.type,
    name: str(item.name),
    description: stripHtml(s.description),
    ownerCharacterId: ownerCharacterId ?? null,
  };

  switch (item.type) {
    case "weapon":
      return {
        ...base,
        skillName: str(s.skill_name),
        skillRef: ref(map, s.skill_uuid, "weapon.skill_uuid", owner),
        damageLevel: str(s.damage_level, "light"),
        damageType: str(s.damage_type, "physical"),
        range: num(s.range), ap: num(s.ap), rof: num(s.rof, 1),
        size: str(s.size, "small"),
        equipped: str(s.equipped, "home"),
        condition: str(s.condition, "perfect"),
        attackModifier: num(s.attack_modifier),
        conditionChance: num(s.condition_chance),
        hasStatus: bool(s.has_status),
        statusName: str(s.status_name),
        statusRef: ref(map, s.status_uuid, "weapon.status_uuid", owner),
      };
    case "gear":
      return {
        ...base,
        gearType: str(s.gear_type, "utility"),
        size: str(s.size, "small"),
        condition: str(s.condition, "perfect"),
        quantity: num(s.quantity, 1),
        equipped: str(s.equipped, "home"),
        energyRestore: num(s.energy_restore),
        soakType: str(s.soak_type, "bonus"),
        soakAbsoluteCapacity: num(s.soak_absolute_capacity),
        soakAbsoluteCurrent: num(s.soak_absolute_current),
        soakBonusDie: num(s.soak_bonus_die),
        soakBonusModifier: num(s.soak_bonus_modifier),
        soakUses: num(s.soak_uses),
        healthBufferPip: num(s.health_buffer_pip),
        healthBufferTrack: str(s.health_buffer_track, "physical"),
        damageLevel: str(s.damage_level, "light"),
        damageType: str(s.damage_type, "physical"),
        skillName: str(s.skill_name),
        skillRef: ref(map, s.skill_uuid, "gear.skill_uuid", owner),
        attackModifier: num(s.attack_modifier),
        conditionChance: num(s.condition_chance),
        hasStatus: bool(s.has_status),
        statusName: str(s.status_name),
        statusRef: ref(map, s.status_uuid, "gear.status_uuid", owner),
      };
    case "artifact":
      return {
        ...base,
        artifactType: str(s.artifact_type, "ring"),
        artifactClass: str(s.artifact_class, "simple"),
        artifactAge: num(s.artifact_age),
        rarity: str(s.rarity, "common"),
        creator: str(s.creator),
        activationCondition: str(s.activation_condition),
        ringMaterial: str(s.ring_material),
        ringStone: str(s.ring_stone),
        size: str(s.size, "finger"),
        condition: str(s.condition, "good"),
        equipped: str(s.equipped, "home"),
        active: bool(s.active),
        destroyed: bool(s.destroyed),
        energyRestore: num(s.energy_restore),
        bonuses: mapBonuses(s.bonuses),
        skillBonuses: mapSkillBonuses(s.skill_bonuses, map, owner),
        soakType: str(s.soak_type, "bonus"),
        soakAbsoluteCapacity: num(s.soak_absolute_capacity),
        soakAbsoluteCurrent: num(s.soak_absolute_current),
        soakBonusDie: num(s.soak_bonus_die),
        soakBonusModifier: num(s.soak_bonus_modifier),
        soakBonusUses: num(s.soak_bonus_uses),
        healthBufferPip: num(s.health_buffer_pip),
        healthBufferTrack: str(s.health_buffer_track, "physical"),
        damageLevel: str(s.damage_level, "light"),
        damageType: str(s.damage_type, "physical"),
        skillName: str(s.skill_name),
        skillRef: ref(map, s.skill_uuid, "artifact.skill_uuid", owner),
        attackModifier: num(s.attack_modifier),
        conditionChance: num(s.condition_chance),
        hasStatus: bool(s.has_status),
        statusName: str(s.status_name),
        statusRef: ref(map, s.status_uuid, "artifact.status_uuid", owner),
      };
    case "spell":
      return {
        ...base,
        spellType: str(s.spell_type, "utility"),
        cost: num(s.cost),
        upkeepCost: num(s.upkeep_cost),
        range: num(s.range),
        duration: num(s.duration),
        durationHours: num(s.duration_hours),
        uses: num(s.uses),
        noWandNeeded: bool(s.no_wand_needed),
        isAoe: bool(s.is_aoe),
        skillName: str(s.skill_name),
        skillRef: ref(map, s.skill_uuid, "spell.skill_uuid", owner),
        contestedSkillName: str(s.contested_skill_name),
        contestedSkillRef: ref(map, s.contested_skill_uuid, "spell.contested_skill_uuid", owner),
        snakeEyesStatusName: str(s.snake_eyes_status_name),
        snakeEyesStatusRef: ref(map, s.snake_eyes_status_uuid, "spell.snake_eyes_status_uuid", owner),
        damageLevel: str(s.damage_level, "light"),
        damageType: str(s.damage_type, "physical"),
        hasStatus: bool(s.has_status),
        statusName: str(s.status_name),
        statusRef: ref(map, s.status_uuid, "spell.status_uuid", owner),
        bonuses: mapBonuses(s.bonuses),
        skillBonuses: mapSkillBonuses(s.skill_bonuses, map, owner),
        soakType: str(s.soak_type, "bonus"),
        soakAbsoluteCapacity: num(s.soak_absolute_capacity),
        soakAbsoluteCurrent: num(s.soak_absolute_current),
        toughnessBonus: num(s.toughness_bonus),
        healthBufferPip: num(s.health_buffer_pip),
        healthBufferTrack: str(s.health_buffer_track, "physical"),
        active: bool(s.active),
      };
    case "device":
      return {
        ...base,
        deviceType: str(s.device_type, "gadget"),
        creator: str(s.creator),
        condition: str(s.condition, "perfect"),
        charges: num(s.charges),
        maxCharges: num(s.max_charges),
        equipped: str(s.equipped, "home"),
        worksUpper: bool(s.works_upper),
        worksLower: bool(s.works_lower),
        bonusSkillName: str(s.bonus_skill_name),
        bonusSkillRef: ref(map, s.bonus_skill_uuid, "device.bonus_skill_uuid", owner),
        bonusValue: num(s.bonus_value),
        damageLevel: str(s.damage_level, "light"),
        damageType: str(s.damage_type, "physical"),
        range: num(s.range),
        attackSkillName: str(s.attack_skill_name),
        attackSkillRef: ref(map, s.attack_skill_uuid, "device.attack_skill_uuid", owner),
        attackModifier: num(s.attack_modifier),
        conditionChance: num(s.condition_chance),
        hasStatus: bool(s.has_status),
        statusName: str(s.status_name),
        statusRef: ref(map, s.status_uuid, "device.status_uuid", owner),
        soakType: str(s.soak_type, "bonus"),
        soakBonusDie: num(s.soak_bonus_die),
        soakBonusModifier: num(s.soak_bonus_modifier),
        healthBufferPip: num(s.health_buffer_pip),
        healthBufferTrack: str(s.health_buffer_track, "physical"),
      };
    case "vehicle":
      return {
        ...base,
        vehicleType: str(s.vehicle_type, "ground"),
        speed: num(s.speed),
        toughness: num(s.toughness),
        capacity: num(s.capacity),
      };
    case "language":
      return { ...base, world: str(s.world, "upper"), isDead: bool(s.is_dead) };
    case "feature":
      return {
        ...base,
        kind: str(s.kind, "character"),
        isWeakness: bool(s.is_weakness),
        restrictions: str(s.restrictions),
        costTrack: str(s.cost_track, "physical"),
        narrative: stripHtml(s.narrative),
        talentName: str(s.talent_name),
        talentRef: ref(map, s.talent_uuid, "feature.talent_uuid", owner),
      };
    case "status":
      return {
        ...base,
        statusTypes: Array.isArray(s.status_types) ? s.status_types : [],
        applyStun: bool(s.apply_stun),
        removalInstruction: str(s.removal_instruction),
        durationMode: str(s.duration?.mode, "time"),
        durationValue: num(s.duration?.value),
        durationAutoReduce: bool(s.duration?.auto_reduce),
        effects: mapEffects(s.effects, map, owner),
      };
    case "ability":
      return {
        ...base,
        attr: str(s.linkedAttribute, "smarts"),
        categ: str(s.category, "learned"),
        die: num(s.die, 4),
        modifier: num(s.modifier, -2),
        isBase: bool(s.isBase),
        facultyRef: ref(map, s.faculty_id, "ability.faculty_id", owner),
      };
    default:
      return base;
  }
}

function mapBonuses(b) {
  const o = b || {};
  return {
    agility: num(o.agility), smarts: num(o.smarts), spirit: num(o.spirit),
    endurance: num(o.endurance), magic: num(o.magic), toughness: num(o.toughness),
  };
}

// skill_bonuses[] {item_uuid, item_name, bonus} → {itemRef, itemName, bonus}.
function mapSkillBonuses(arr, map, owner) {
  return (arr || []).map((b) => ({
    itemName: str(b.item_name),
    itemRef: map.resolve(b.item_uuid, "skill_bonuses.item_uuid", owner),
    bonus: num(b.bonus),
  }));
}

// status effects[] — full payload preserved (D-14); only target_skills uuids remap.
function mapEffects(arr, map, owner) {
  return (arr || []).map((e) => {
    const out = { ...e };
    if (e.roll_modifier?.target_skills) {
      out.roll_modifier = {
        ...e.roll_modifier,
        target_skills: e.roll_modifier.target_skills.map((t) => ({
          name: str(t.name),
          ref: map.resolve(t.uuid, "effects.target_skills.uuid", owner),
        })),
      };
    }
    return out;
  });
}
