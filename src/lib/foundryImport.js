// ============================================================
// КК9 — импорт карточки игрока из Foundry VTT (in-app instrument).
//
// Разбирает ОДИН экспорт актёра-персонажа Foundry ({name,type,system,items[]})
// в наш документ персонажа 1-в-1, плюс встроенные предметы (weapon/gear/…).
//
// Это браузерная версия конвертера tools/import/ (FEAT-20): без node:crypto и
// без файловой системы. У одиночного актёра нет доступа к другим документам,
// поэтому ВСЕ внешние ссылки (relations→другой персонаж, contacts→организация,
// artifact_refs/companion_refs/daemon_refs) не резолвятся: кэш-имена
// сохраняются, id становится null, и по каждой такой ссылке пишется warning.
// Встроенные предметы (в actor.items[]) импортируются как предметы новой
// карточки. Черты (feature-предметы) кладутся в character.features[] — этого
// CLI-конвертер не делал.
// ============================================================

// ── Браузер-безопасные хелперы (портированы из tools/import/lib/util.js) ──
function stripHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const num = (v, dflt = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};
const str = (v, dflt = "") => (v == null ? dflt : String(v));
const bool = (v) => v === true || v === "true";
function tailId(uuid) {
  if (!uuid) return null;
  const parts = String(uuid).split(".");
  return parts[parts.length - 1] || null;
}

const ATTR_KEYS = ["agility", "smarts", "spirit", "endurance", "magic"];

// Типы встроенных предметов, которые становятся строками коллекции items.
const COLLECTION_ITEM_TYPES = new Set([
  "weapon", "gear", "artifact", "spell", "device", "vehicle",
]);
const KNOWN_ITEM_TYPES = new Set([
  "weapon", "gear", "artifact", "spell", "device", "vehicle",
  "contact", "language", "status", "feature", "ability", "faculty",
]);

// ── Атрибуты ────────────────────────────────────────────────
function mapAttributes(src = {}) {
  const out = {};
  for (const k of ATTR_KEYS) {
    const a = src[k] || {};
    out[k] = { die: num(a.die, 4), modifier: num(a.modifier) };
  }
  return out;
}

// system.skills — объект по id способности; customSkills[] — свободные.
// abilityIndex (id → {name, attr, categ}) строится из ability-предметов актёра.
function mapSkills(s, abilityIndex, warnings, owner) {
  const skills = [];
  const skillObj = s.skills && typeof s.skills === "object" ? s.skills : {};
  for (const [key, val] of Object.entries(skillObj)) {
    if (!val || typeof val !== "object") continue;
    const meta = abilityIndex.get(key) || abilityIndex.get(tailId(key))
      || (val.name ? { name: val.name, attr: val.linkedAttribute, categ: val.category } : null);
    if (!meta) { warnings.push({ kind: "unmapped-skill", owner, detail: key }); continue; }
    skills.push({
      name: str(meta.name), attr: str(meta.attr, "smarts"), categ: str(meta.categ, "learned"),
      die: num(val.die, 4), modifier: num(val.modifier, -2),
    });
  }
  for (const c of (s.customSkills || [])) {
    skills.push({
      name: str(c.name), attr: str(c.linkedAttribute, "smarts"), categ: "personal",
      die: num(c.die, 4), modifier: num(c.modifier, -2),
    });
  }
  return skills;
}

// Внешние ссылки не резолвятся в одиночном импорте: кэш-данные храним, id=null.
function mapRelations(arr, warnings, owner) {
  return (arr || []).map((r) => {
    if (r.uuid) warnings.push({ kind: "unresolved-ref", owner, detail: `relation → ${str(r.name) || r.uuid}` });
    return {
      ref: null,
      name: str(r.name),
      portrait: str(r.img),
      level: num(r.level),
      tags: Array.isArray(r.tags) ? r.tags : [],
      notes: stripHtml(r.notes),
    };
  });
}

function mapActiveStatuses(arr, warnings, owner) {
  return (arr || []).map((a) => {
    if (a.itemId) warnings.push({ kind: "unresolved-ref", owner, detail: `active status → ${str(a.statusName) || a.itemId}` });
    return {
      definitionId: null,
      name: str(a.statusName),
      statusTypes: Array.isArray(a.status_types) ? a.status_types : [],
      durationMode: str(a.duration_mode, "time"),
      durationRemaining: num(a.duration_value),
      effects: [],
    };
  });
}

// feature-предмет Foundry → запись character.features[] (встроенная, как в приложении).
function mapFeatureItem(item) {
  const s = item.system || {};
  return {
    name: str(item.name),
    description: stripHtml(s.description),
    kind: str(s.kind, "character"),
    isWeakness: bool(s.is_weakness),
    restrictions: str(s.restrictions),
    costTrack: str(s.cost_track, "physical"),
    narrative: stripHtml(s.narrative),
    talentName: str(s.talent_name),
  };
}

// Встроенный предмет коллекции Foundry → документ items (браузерная версия mapItem).
// Внешние *_uuid не резолвятся (id=null) — кэш-имена *_name сохраняются.
function mapCollectionItem(item, ownerCharacterId) {
  const s = item.system || {};
  const base = {
    type: item.type,
    name: str(item.name),
    description: stripHtml(s.description),
    ownerCharacterId: ownerCharacterId ?? null,
  };
  const bonuses = (b) => {
    const o = b || {};
    return {
      agility: num(o.agility), smarts: num(o.smarts), spirit: num(o.spirit),
      endurance: num(o.endurance), magic: num(o.magic), toughness: num(o.toughness),
    };
  };
  const skillBonuses = (arr) => (arr || []).map((b) => ({
    itemName: str(b.item_name), itemRef: null, bonus: num(b.bonus),
  }));
  switch (item.type) {
    case "weapon":
      return {
        ...base,
        skillName: str(s.skill_name), skillRef: null,
        damageLevel: str(s.damage_level, "light"), damageType: str(s.damage_type, "physical"),
        range: num(s.range), ap: num(s.ap), rof: num(s.rof, 1),
        size: str(s.size, "small"), equipped: str(s.equipped, "home"),
        condition: str(s.condition, "perfect"), attackModifier: num(s.attack_modifier),
        conditionChance: num(s.condition_chance), hasStatus: bool(s.has_status),
        statusName: str(s.status_name), statusRef: null,
      };
    case "gear":
      return {
        ...base,
        gearType: str(s.gear_type, "utility"), size: str(s.size, "small"),
        condition: str(s.condition, "perfect"), quantity: num(s.quantity, 1),
        equipped: str(s.equipped, "home"), energyRestore: num(s.energy_restore),
        soakType: str(s.soak_type, "bonus"), soakAbsoluteCapacity: num(s.soak_absolute_capacity),
        soakAbsoluteCurrent: num(s.soak_absolute_current), soakBonusDie: num(s.soak_bonus_die),
        soakBonusModifier: num(s.soak_bonus_modifier), soakUses: num(s.soak_uses),
        healthBufferPip: num(s.health_buffer_pip), healthBufferTrack: str(s.health_buffer_track, "physical"),
        damageLevel: str(s.damage_level, "light"), damageType: str(s.damage_type, "physical"),
        skillName: str(s.skill_name), skillRef: null, attackModifier: num(s.attack_modifier),
        conditionChance: num(s.condition_chance), hasStatus: bool(s.has_status),
        statusName: str(s.status_name), statusRef: null,
      };
    case "artifact":
      return {
        ...base,
        artifactType: str(s.artifact_type, "ring"), artifactClass: str(s.artifact_class, "simple"),
        artifactAge: num(s.artifact_age), rarity: str(s.rarity, "common"), creator: str(s.creator),
        activationCondition: str(s.activation_condition), ringMaterial: str(s.ring_material),
        ringStone: str(s.ring_stone), size: str(s.size, "finger"), condition: str(s.condition, "good"),
        equipped: str(s.equipped, "home"), active: bool(s.active), destroyed: bool(s.destroyed),
        energyRestore: num(s.energy_restore), bonuses: bonuses(s.bonuses),
        skillBonuses: skillBonuses(s.skill_bonuses),
        soakType: str(s.soak_type, "bonus"), soakAbsoluteCapacity: num(s.soak_absolute_capacity),
        soakAbsoluteCurrent: num(s.soak_absolute_current), soakBonusDie: num(s.soak_bonus_die),
        soakBonusModifier: num(s.soak_bonus_modifier), soakBonusUses: num(s.soak_bonus_uses),
        healthBufferPip: num(s.health_buffer_pip), healthBufferTrack: str(s.health_buffer_track, "physical"),
        damageLevel: str(s.damage_level, "light"), damageType: str(s.damage_type, "physical"),
        skillName: str(s.skill_name), skillRef: null, attackModifier: num(s.attack_modifier),
        conditionChance: num(s.condition_chance), hasStatus: bool(s.has_status),
        statusName: str(s.status_name), statusRef: null,
      };
    case "spell":
      return {
        ...base,
        spellType: str(s.spell_type, "utility"), cost: num(s.cost), upkeepCost: num(s.upkeep_cost),
        range: num(s.range), duration: num(s.duration), durationHours: num(s.duration_hours),
        uses: num(s.uses), noWandNeeded: bool(s.no_wand_needed), isAoe: bool(s.is_aoe),
        skillName: str(s.skill_name), skillRef: null,
        contestedSkillName: str(s.contested_skill_name), contestedSkillRef: null,
        snakeEyesStatusName: str(s.snake_eyes_status_name), snakeEyesStatusRef: null,
        damageLevel: str(s.damage_level, "light"), damageType: str(s.damage_type, "physical"),
        hasStatus: bool(s.has_status), statusName: str(s.status_name), statusRef: null,
        bonuses: bonuses(s.bonuses), skillBonuses: skillBonuses(s.skill_bonuses),
        soakType: str(s.soak_type, "bonus"), soakAbsoluteCapacity: num(s.soak_absolute_capacity),
        toughnessBonus: num(s.toughness_bonus), healthBufferPip: num(s.health_buffer_pip),
        healthBufferTrack: str(s.health_buffer_track, "physical"), active: bool(s.active),
      };
    case "device":
      return {
        ...base,
        deviceType: str(s.device_type, "gadget"), creator: str(s.creator),
        condition: str(s.condition, "perfect"), charges: num(s.charges), maxCharges: num(s.max_charges),
        equipped: str(s.equipped, "home"), worksUpper: bool(s.works_upper), worksLower: bool(s.works_lower),
        bonusSkillName: str(s.bonus_skill_name), bonusSkillRef: null, bonusValue: num(s.bonus_value),
        damageLevel: str(s.damage_level, "light"), damageType: str(s.damage_type, "physical"),
        range: num(s.range), attackSkillName: str(s.attack_skill_name), attackSkillRef: null,
        attackModifier: num(s.attack_modifier), conditionChance: num(s.condition_chance),
        hasStatus: bool(s.has_status), statusName: str(s.status_name), statusRef: null,
        soakType: str(s.soak_type, "bonus"), soakBonusDie: num(s.soak_bonus_die),
        soakBonusModifier: num(s.soak_bonus_modifier), healthBufferPip: num(s.health_buffer_pip),
        healthBufferTrack: str(s.health_buffer_track, "physical"),
      };
    case "vehicle":
      return {
        ...base,
        vehicleType: str(s.vehicle_type, "ground"), speed: num(s.speed),
        toughness: num(s.toughness), capacity: num(s.capacity),
      };
    default:
      return base;
  }
}

// Языки: Foundry держит их в system.languages[] и/или как language-предметы.
function mapLanguages(s, items) {
  const out = [];
  const seen = new Set();
  const push = (name) => {
    const n = str(name).trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push({ name: n, itemId: null });
  };
  for (const l of (s.languages || [])) push(l.name);
  for (const it of items) if (it.type === "language") push(it.name);
  return out;
}

// ── Главный разбор одного актёра ────────────────────────────
// Возвращает { ok, error?, doc, gmNotes, items, warnings, summary }.
export function parseFoundryActor(actor) {
  if (!actor || typeof actor !== "object") {
    return { ok: false, error: "Пустой или некорректный JSON." };
  }
  if (actor.type && actor.type !== "character") {
    return { ok: false, error: `Это актёр типа «${actor.type}», а не персонаж (character). Импортируйте карточку игрока.` };
  }
  const s = actor.system || {};
  if (!actor.system) {
    return { ok: false, error: "В JSON нет поля system — это не похоже на экспорт актёра Foundry." };
  }
  const owner = actor.name || actor._id || "актёр";
  const warnings = [];
  const items = Array.isArray(actor.items) ? actor.items : [];

  // abilityIndex из ability-предметов самого актёра.
  const abilityIndex = new Map();
  for (const it of items) {
    if (it.type === "ability") {
      const a = it.system || {};
      const meta = { name: str(it.name), attr: str(a.linkedAttribute, "smarts"), categ: str(a.category, "learned") };
      if (it._id) abilityIndex.set(it._id, meta);
    }
    if (it.type && !KNOWN_ITEM_TYPES.has(it.type)) {
      warnings.push({ kind: "unknown-item-type", owner, detail: it.type });
    }
  }

  const tension = s.tension || {};
  const doc = {
    type: "character",
    name: str(actor.name),
    portrait: str(actor.img),
    age: num(s.age, 15),
    gender: str(s.gender),
    birthplace: str(s.birthplace),
    dormitory: str(s.dormitory),
    height: str(s.height),
    build: str(s.build),
    allergies: str(s.allergies),
    weaknesses: str(s.weaknesses),
    biography: stripHtml(s.biography) || str(s.biography_text),
    faculty: {
      name: str(s.faculty_name),
      key: str(s.faculty_key),
      color: str(s.faculty_color, "#c8a14e"),
    },
    facultyRef: null,
    academyYear: str(s.academy_year, "1"),
    semester: num(s.semester, 1),
    attributes: mapAttributes(s.attributes),
    health: {
      physical: { value: num(s.health?.physical?.value), toughness: num(s.health?.physical?.toughness, 4) },
      mental: { value: num(s.health?.mental?.value) },
    },
    energy: { value: num(s.energy?.value), max: num(s.energy?.max) },
    tension: {
      current: num(tension.current),
      overcap: num(tension.overcap),
      energyPenalty: num(tension.energy_penalty),
      max: num(tension.max),
    },
    overflow_damage: num(s.overflow_damage),
    bennies: num(s.bennies, 3),
    money: num(s.money),
    experience: num(s.experience),
    notes: [],
    activeSpells: (s.active_spells || []).map((sp) => {
      if (sp.itemId) warnings.push({ kind: "unresolved-ref", owner, detail: `active spell → ${sp.itemId}` });
      return {
        ref: null,
        usesRemaining: num(sp.uses_remaining),
        durationRemaining: num(sp.duration_remaining),
        upkeepCost: num(sp.upkeep_cost),
      };
    }),
    activeStatuses: mapActiveStatuses(s.active_statuses, warnings, owner),
    magicLevels: (s.magicLevels || []).map((m) => {
      if (m.itemId) warnings.push({ kind: "unresolved-ref", owner, detail: `magic level → ${str(m.level) || m.itemId}` });
      return { ref: null, level: str(m.level) };
    }),
    customSkills: [],
    languages: mapLanguages(s, items),
    features: items.filter((it) => it.type === "feature").map(mapFeatureItem),
    skills: mapSkills(s, abilityIndex, warnings, owner),
    relations: mapRelations(s.relations, warnings, owner),
    refs: { artifacts: [], companions: [], daemons: [], contacts: [] },
  };

  // Внешние ссылки-массивы — не резолвятся, только предупреждаем.
  for (const [field, arr] of [
    ["artifact_refs", s.artifact_refs], ["companion_refs", s.companion_refs],
    ["daemon_refs", s.daemon_refs], ["contact_refs", s.contact_refs],
  ]) {
    for (let i = 0; i < (arr || []).length; i++) warnings.push({ kind: "unresolved-ref", owner, detail: `${field}` });
  }

  // Встроенные предметы коллекции → items[] новой карточки.
  const mappedItems = items
    .filter((it) => COLLECTION_ITEM_TYPES.has(it.type))
    .map((it) => mapCollectionItem(it, null));

  const summary = {
    name: doc.name,
    faculty: doc.faculty.name,
    academyYear: doc.academyYear,
    semester: doc.semester,
    age: doc.age,
    skills: doc.skills.length,
    languages: doc.languages.length,
    features: doc.features.length,
    relations: doc.relations.length,
    activeStatuses: doc.activeStatuses.length,
    activeSpells: doc.activeSpells.length,
    magicLevels: doc.magicLevels.length,
    items: mappedItems.length,
    itemsByType: mappedItems.reduce((acc, it) => { acc[it.type] = (acc[it.type] || 0) + 1; return acc; }, {}),
    warnings: warnings.length,
  };

  return { ok: true, doc, gmNotes: stripHtml(s.gm_notes), items: mappedItems, warnings, summary };
}
