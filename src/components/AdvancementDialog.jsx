import { useState } from "react";
import { nextAttrAction, nextAbilAction } from "../lib/advancement";
import { ATTR_ORDER, ATTR_LABEL, ATTR_SHORT, CAT_ORDER, CAT_LABEL, dieStr } from "../lib/constants";

function AdvRow({ name, attr, cur, action, changed, onStep, onUndo }) {
  const can = action && action.can && action.type !== "blocked";
  return (
    <div className={`kk-adv-row ${changed ? "changed" : ""}`}>
      <span className="kk-adv-name">{name}{attr && <span className="kk-skill-attr2"> {attr}</span>}</span>
      <span className="kk-adv-cur">{cur}</span>
      <span className="kk-adv-next">{action ? (action.type === "blocked" ? <em>{action.label}</em> : <>{action.label} · <b>{action.cost}</b></>) : <em>максимум</em>}</span>
      <button className="kk-adv-plus" disabled={!can} onClick={onStep} title={can ? "+ шаг" : "недоступно"}>+</button>
      <button className={`kk-adv-undo ${changed ? "" : "hide"}`} onClick={onUndo} title="откатить ряд, вернуть очки">↺</button>
    </div>
  );
}

export default function AdvancementDialog({ ch, settings, onApply, onCancel }) {
  const [plan, setPlan] = useState({ attributes: {}, abilities: {} });

  const curAttr = (k) => plan.attributes[k] || { die: ch.attributes[k].die, mod: ch.attributes[k].modifier };
  const curAbil = (i) => plan.abilities[i] || { die: ch.skills[i].die, mod: ch.skills[i].modifier };
  const spent = [...Object.values(plan.attributes), ...Object.values(plan.abilities)].reduce((s, e) => s + (e.spent || 0), 0);
  const remaining = (ch.experience || 0) - spent;

  const stepAttr = (k) => {
    const c = curAttr(k);
    const a = nextAttrAction(c.die, c.mod, settings, remaining);
    if (!a || !a.can || a.type === "blocked") return;
    setPlan(p => {
      const ex = p.attributes[k];
      const fromDie = ex ? ex.fromDie : ch.attributes[k].die;
      const fromMod = ex ? ex.fromMod : ch.attributes[k].modifier;
      return { ...p, attributes: { ...p.attributes, [k]: { die: a.result.die, mod: a.result.mod, spent: (ex?.spent || 0) + a.cost, fromDie, fromMod } } };
    });
  };
  const undoAttr = (k) => setPlan(p => { const n = { ...p.attributes }; delete n[k]; return { ...p, attributes: n }; });

  const stepAbil = (i) => {
    const c = curAbil(i);
    const sk = ch.skills[i];
    const attr = curAttr(sk.attr);
    const a = nextAbilAction(c.die, c.mod, sk.categ, { die: attr.die, mod: attr.mod }, settings, remaining);
    if (!a || !a.can || a.type === "blocked") return;
    setPlan(p => {
      const ex = p.abilities[i];
      const fromDie = ex ? ex.fromDie : sk.die;
      const fromMod = ex ? ex.fromMod : sk.modifier;
      return { ...p, abilities: { ...p.abilities, [i]: { die: a.result.die, mod: a.result.mod, spent: (ex?.spent || 0) + a.cost, fromDie, fromMod } } };
    });
  };
  const undoAbil = (i) => setPlan(p => { const n = { ...p.abilities }; delete n[i]; return { ...p, abilities: n }; });

  function apply() {
    const attributes = structuredClone(ch.attributes);
    for (const k in plan.attributes) {
      attributes[k] = { ...attributes[k], die: plan.attributes[k].die, modifier: plan.attributes[k].mod };
    }
    const skills = (ch.skills || []).map((s, i) => plan.abilities[i] ? { ...s, die: plan.abilities[i].die, modifier: plan.abilities[i].mod } : s);
    const changes = [
      ...Object.entries(plan.attributes).map(([k, e]) => ({ kind: "attr", name: ATTR_LABEL[k], from: dieStr(e.fromDie, e.fromMod), to: dieStr(e.die, e.mod), spent: e.spent })),
      ...Object.entries(plan.abilities).map(([i, e]) => ({ kind: "skill", name: ch.skills[i].name, from: dieStr(e.fromDie, e.fromMod), to: dieStr(e.die, e.mod), spent: e.spent })),
    ];
    if (!changes.length) return;
    onApply({ attributes, skills, spent, changes, newExperience: (ch.experience || 0) - spent });
  }

  const grouped = CAT_ORDER.map(cat => ({
    cat,
    items: (ch.skills || []).map((s, i) => ({ s, i })).filter(o => o.s.categ === cat),
  })).filter(g => g.items.length);

  return (
    <div className="kk-edit">
      <div className="kk-edit-bar">
        <span className="kk-edit-title">Прокачка · {ch.name}</span>
        <div className="kk-adv-pool">
          <span>Опыт:</span> <b>{remaining}</b>
          <span className="kk-adv-spent"> из {ch.experience || 0}{spent > 0 ? ` · потратите ${spent}` : ""}</span>
        </div>
        <div className="kk-edit-actions">
          <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
          <button className="kk-btn primary" disabled={spent <= 0} onClick={apply}>Применить</button>
        </div>
      </div>

      <section className="kk-block">
        <h2 className="kk-h2">Атрибуты</h2>
        <div className="kk-adv-list">{ATTR_ORDER.map(k => {
          const c = curAttr(k);
          const a = nextAttrAction(c.die, c.mod, settings, remaining);
          return <AdvRow key={k} name={ATTR_LABEL[k]} cur={dieStr(c.die, c.mod)} action={a} changed={!!plan.attributes[k]} onStep={() => stepAttr(k)} onUndo={() => undoAttr(k)}/>;
        })}</div>
      </section>

      {grouped.map(g => (
        <section className="kk-block" key={g.cat}>
          <h2 className="kk-h2">Навыки · {CAT_LABEL[g.cat]}</h2>
          <div className="kk-adv-list">{g.items.map(({ s, i }) => {
            const c = curAbil(i);
            const attr = curAttr(s.attr);
            const a = nextAbilAction(c.die, c.mod, s.categ, { die: attr.die, mod: attr.mod }, settings, remaining);
            return <AdvRow key={s.name + i} name={s.name} attr={ATTR_SHORT[s.attr]} cur={dieStr(c.die, c.mod)} action={a} changed={!!plan.abilities[i]} onStep={() => stepAbil(i)} onUndo={() => undoAbil(i)}/>;
          })}</div>
        </section>
      ))}

      <div className="kk-edit-foot">
        <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
        <button className="kk-btn primary" disabled={spent <= 0} onClick={apply}>Применить ({spent})</button>
      </div>
    </div>
  );
}
