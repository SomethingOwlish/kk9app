export const DEFAULT_BACKGROUNDS = [
  { key: "ally",     label: "Союзник из прошлого", cost: 2, desc: "НПС который встретит вас после События и будет доброжелателен" },
  { key: "artifact", label: "Артефакт",            cost: 3, desc: "У вас есть артефакт — вы пока не знаете как он работает" },
  { key: "memory",   label: "Память о КК9",        cost: 2, desc: "В детстве вы видели проявления КК9. Память стёрта — но вы вспомните" },
];

const DIE_SCALE = [4, 6, 8, 10, 12, 20];

export function nextUpCost(die, modifier) {
  if (modifier < 0) return 1;
  if (die === 4) return 1;
  return 2;
}

export function skillPointsSpent(baseDie, baseMod, curDie, curMod) {
  let n = 0;
  if (baseMod < 0 && curMod >= 0) n += 1;
  const oi = DIE_SCALE.indexOf(baseDie);
  const ci = DIE_SCALE.indexOf(curDie);
  for (let i = oi; i < ci; i++) {
    n += DIE_SCALE[i] === 4 ? 1 : 2;
  }
  return n;
}
