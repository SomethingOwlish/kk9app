// ============================================================
// КК9 — движок прокачки. Формулы 1:1 из advancement.mjs,
// но цены берутся из настроек кампании (campaign.advancement),
// а не из game.settings. Потолок атрибута на d20 = d20ModCap (по умолч. +5).
// ============================================================

export const DIE_SCALE = [4, 6, 8, 10, 12, 20];

// Дефолтные настройки стоимости — стартовые, ГМ правит в настройках кампании.
export const DEFAULT_ADVANCEMENT = {
  attr: { dieCostBase: 100, modCostBase: 30, negModCost: 50, d20ModCap: 5 },
  abil: { dieCostBase: 15, modCostBase: 10, negModCost: 5 },
  catMult: { common: 0.8, learned: 1.0, magic: 1.5, personal: 2.0 },
};

// Слить дефолты с настройками кампании.
export function advSettings(campaign) {
  const a = campaign?.advancement || {};
  return {
    attr:   { ...DEFAULT_ADVANCEMENT.attr,   ...(a.attr || {}) },
    abil:   { ...DEFAULT_ADVANCEMENT.abil,   ...(a.abil || {}) },
    catMult:{ ...DEFAULT_ADVANCEMENT.catMult,...(a.catMult || {}) },
  };
}

function dieIndex(d) { const i = DIE_SCALE.indexOf(d); return i < 0 ? 0 : i; }

// Потолок мода по кубику (таблица). d20 для атрибута переопределяется настройкой.
const MOD_CAP_BY_DIE = { 4: 1, 6: 2, 8: 2, 10: 2, 12: 7, 20: 999 };
export function attrMaxMod(die, s) { return die === 20 ? s.attr.d20ModCap : (MOD_CAP_BY_DIE[die] ?? 0); }
export function abilDieCap(die) { return MOD_CAP_BY_DIE[die] ?? 0; }

// Потолок мода СПОСОБНОСТИ: не выше эффективного атрибута (кубик+мод).
export function calcAbilModCeiling(abilDie, attrDie = 20, attrMod = 0) {
  const dieCap = abilDieCap(abilDie);
  const room = (attrDie + attrMod) - abilDie;
  return Math.max(0, Math.min(dieCap, room));
}

// ── Цены ────────────────────────────────────────────────────
export function calcAttrDieCost(from, to, s) {
  const fi = dieIndex(from), ti = dieIndex(to); if (ti <= fi) return 0;
  let c = 0; for (let i = fi; i < ti; i++) c += s.attr.dieCostBase * (i + 1); return c;
}
export function calcAttrModStepCost(toMod, s) { return toMod <= 0 ? 0 : s.attr.modCostBase * toMod; }
export function calcAttrNegModCost(s) { return s.attr.negModCost; }

export function calcAbilDieCost(from, to, cat, s) {
  const fi = dieIndex(from), ti = dieIndex(to); if (ti <= fi) return 0;
  const m = s.catMult[cat] ?? 1; let c = 0;
  for (let i = fi; i < ti; i++) c += s.abil.dieCostBase * (i + 2); return Math.round(c * m);
}
export function calcAbilModStepCost(toMod, cat, s) {
  if (toMod <= 0) return 0; const m = s.catMult[cat] ?? 1;
  return Math.round(s.abil.modCostBase * (2 * toMod) * m);
}
export function calcAbilNegModStepCost(cat, s) {
  const m = s.catMult[cat] ?? 1; return Math.round(s.abil.negModCost * m);
}

// ── Следующий доступный шаг (одно действие на строку) ───────
// Возвращает { type, label, cost, can, result:{die,mod} } или null/blocked.
export function nextAttrAction(die, mod, s, remaining) {
  if (mod < 0) { const cost = calcAttrNegModCost(s); return { type: "neg", label: `Снять штраф (${mod} → 0)`, cost, can: cost <= remaining, result: { die, mod: 0 } }; }
  const ceil = attrMaxMod(die, s);
  if (mod < ceil) { const n = mod + 1; const cost = calcAttrModStepCost(n, s); return { type: "mod", label: `+1 мод (→ +${n})`, cost, can: cost <= remaining, result: { die, mod: n } }; }
  const idx = dieIndex(die);
  if (idx < DIE_SCALE.length - 1) { const nd = DIE_SCALE[idx + 1]; const cost = calcAttrDieCost(die, nd, s); return { type: "die", label: `d${die} → d${nd} (мод → 0)`, cost, can: cost <= remaining, result: { die: nd, mod: 0 } }; }
  return null; // потолок
}
export function nextAbilAction(die, mod, cat, attrEff, s, remaining) {
  if (mod < 0) { const cost = calcAbilNegModStepCost(cat, s); return { type: "neg", label: `Снять −1 (${mod} → ${mod + 1})`, cost, can: cost <= remaining, result: { die, mod: mod + 1 } }; }
  const ceil = calcAbilModCeiling(die, attrEff.die, attrEff.mod);
  if (mod < ceil) { const n = mod + 1; const cost = calcAbilModStepCost(n, cat, s); return { type: "mod", label: `+1 мод (→ +${n})`, cost, can: cost <= remaining, result: { die, mod: n } }; }
  const idx = dieIndex(die);
  if (idx < DIE_SCALE.length - 1) {
    const nd = DIE_SCALE[idx + 1];
    if (nd <= attrEff.die) { const cost = calcAbilDieCost(die, nd, cat, s); return { type: "die", label: `d${die} → d${nd} (мод → 0)`, cost, can: cost <= remaining, result: { die: nd, mod: 0 } }; }
    return { type: "blocked", label: `макс. — ограничено атрибутом d${attrEff.die}` };
  }
  return { type: "blocked", label: "макс." };
}
