import { nextAttrAction, nextAbilAction } from "./advancement";
import { ATTR_ORDER } from "./constants";

export function getPath(o, p) { return p.split(".").reduce((x, k) => x?.[k], o); }

export function applyOverrides(base, ov) {
  const keys = Object.keys(ov);
  if (!keys.length) return base;
  const res = structuredClone(base);
  for (const p of keys) {
    const parts = p.split(".");
    let cur = res;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]];
    cur[parts[parts.length - 1]] = ov[p];
  }
  return res;
}

export function canAdvance(ch, s) {
  const xp = ch.experience || 0;
  for (const k of ATTR_ORDER) {
    const a = ch.attributes[k];
    if (nextAttrAction(a.die, a.modifier, s, xp)?.can) return true;
  }
  for (const sk of (ch.skills || [])) {
    const attr = ch.attributes[sk.attr];
    if (nextAbilAction(sk.die, sk.modifier, sk.categ, { die: attr.die, mod: attr.modifier }, s, xp)?.can) return true;
  }
  return false;
}
