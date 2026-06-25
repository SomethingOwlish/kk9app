import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  watchCampaign, watchCharacterList, createCharacter, saveCharacterDebounced,
  updateCharacterNow, updateCampaignNow, addLogEntry, watchCharacterLog, clearCharacterLog, derive,
} from "./lib/db";
import { CAMPAIGN_ID } from "./lib/config";
import { FACULTIES } from "./lib/seed-faculties";
import { SKILLS_DATA } from "./lib/seed-skills";
import { advSettings, DEFAULT_ADVANCEMENT, nextAttrAction, nextAbilAction } from "./lib/advancement";

// ============================================================
// КК9 (этап 1+): роли gm/player/admin/demo, прокачка за опыт с откатом,
// логи прокачки (вкладка ГМ), кастомные навыки с категорией.
// МЫСЛЬ НА БУДУЩЕЕ: «план прокачки» (сохранить незавершённый план) — позже.
// ============================================================

const SKILL_BY_NAME = Object.fromEntries(SKILLS_DATA.map((s) => [s.name, s]));
const DICE = [4, 6, 8, 10, 12, 20];
const ATTR_ORDER=["agility","smarts","spirit","endurance","magic"];
const ATTR_LABEL={agility:"Ловкость",smarts:"Смекалка",spirit:"Дух",endurance:"Выносливость",magic:"Магия"};
const ATTR_SHORT={agility:"Ловк",smarts:"Смек",spirit:"Дух",endurance:"Вын",magic:"Магия"};
const CAT_LABEL={common:"Общие",learned:"Изученные",personal:"Личные",magic:"Магические"};
const CAT_ORDER=["common","learned","personal","magic"];
const MENU=[
  {id:"portal",label:"Портал",on:true},{id:"card",label:"Карточка",on:true},
  {id:"adv",label:"Прокачка"},{id:"gear",label:"Снаряжение"},{id:"magic",label:"Магия"},
  {id:"log",label:"Лог сессий"},{id:"scene",label:"Сцена"},{id:"shop",label:"Магазин"},
  {id:"journal",label:"Журнал кампании"},{id:"gm",label:"Год Мод · ГМ"},{id:"print",label:"Печать карточки"},{id:"set",label:"Настройки"},
];
const dieStr=(die,mod)=>`d${die}${mod?(mod>0?`+${mod}`:`${mod}`):""}`;

function attrPipSizes(die){ switch(die){ case 20:return[2,2,2,2,1]; case 12:return[1,2,2,2,1]; case 10:return[1,1,2,2,1]; case 8:return[1,1,1,2,1]; default:return[1,1,1,1,1]; } }
function computeHealthPips(attrDie){ const sizes=attrPipSizes(attrDie).map((s,i)=>i===4?1:s); const thresholds=[0]; for(let i=0;i<4;i++) thresholds.push(thresholds[i]+sizes[i]); return {sizes,thresholds,maxValue:sizes.reduce((a,b)=>a+b,0)}; }
function buildPipStates(value,sizes,thresholds){ return sizes.map((size,i)=>{ const lo=thresholds[i]; const filled=Math.max(0,Math.min(size,value-lo)); return {pip:i+1,size,lo,cells:Array.from({length:size},(_,c)=>({filled:c<filled})),started:filled>0,closed:filled>=size,knockout:i===4}; }); }
function getPath(o,p){ return p.split(".").reduce((x,k)=>x?.[k],o); }
function applyOverrides(base,ov){ const keys=Object.keys(ov); if(!keys.length) return base; const res=structuredClone(base);
  for(const p of keys){ const parts=p.split("."); let cur=res; for(let i=0;i<parts.length-1;i++) cur=cur[parts[i]]; cur[parts[parts.length-1]]=ov[p]; } return res; }
function mergeFacultySkills(skills, fac){ const have=new Set(skills.map(s=>s.name));
  const add=(fac.abilities||[]).filter(n=>!have.has(n)).map(n=>{ const r=SKILL_BY_NAME[n]; return {name:n,attr:r?.attr||"smarts",categ:r?.categ||"learned",die:4,modifier:-2}; }); return [...skills, ...add]; }

// Можно ли вообще прокачаться (хватает опыта хотя бы на 1 шаг)?
function canAdvance(ch, s){
  const xp=ch.experience||0;
  for(const k of ATTR_ORDER){ const a=ch.attributes[k]; const act=nextAttrAction(a.die,a.modifier,s,xp); if(act&&act.can&&act.type!=="blocked") return true; }
  for(const sk of (ch.skills||[])){ const attr=ch.attributes[sk.attr]; const eff={die:attr.die,mod:attr.modifier};
    const act=nextAbilAction(sk.die,sk.modifier,sk.categ,eff,s,xp); if(act&&act.can&&act.type!=="blocked") return true; }
  return false;
}

function Tip({text,children,label}){
  const [open,setOpen]=useState(false); const ref=useRef(null);
  useEffect(()=>{ if(!open) return; const c=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown",c); return ()=>document.removeEventListener("pointerdown",c); },[open]);
  return <span ref={ref} className="kk-tip" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}
    onClick={(e)=>{e.stopPropagation();setOpen(v=>!v);}} tabIndex={0} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)}
    aria-label={typeof text==="string"?text:label}>{children}{open&&<span className="kk-tip-pop" role="tooltip">{text}</span>}</span>;
}

function HealthTrack({label,attrLabel,attrDie,value,onChange,tipExtra}){
  const {sizes,thresholds,maxValue}=computeHealthPips(attrDie);
  const states=buildPipStates(value,sizes,thresholds);
  const setVal=(v)=>onChange&&onChange(Math.max(0,Math.min(maxValue,v)));
  return (<div className="kk-track">
    <div className="kk-track-head">
      <Tip text={`${label}: ${value}/${maxValue} ячеек. ${tipExtra} Пип «начат» — штраф порога. 5-й пип = нокаут.`}>
        <span className="kk-track-name kk-dotted">{label}</span></Tip>
      <span className="kk-track-meta">{value}/{maxValue} · от {attrLabel} d{attrDie}</span>
    </div>
    <div className="kk-pips">{states.map(p=>{ let ci=p.lo; return (
      <div key={p.pip} className={`kk-pip ${p.knockout?"ko":""} ${p.started?"started":""} ${p.closed?"closed":""}`}>
        {p.cells.map((c,k)=>{ const abs=++ci; return (
          <button key={k} className={`kk-cell ${c.filled?"filled":""}`} onClick={()=>setVal(value===abs?abs-1:abs)} aria-label={`${label} ${abs}`}/>);})}
        <span className="kk-pip-num">{p.pip}</span>
      </div>);})}</div>
  </div>);
}

function Stat({label,value,onChange,max,tip,accent}){
  return (<div className="kk-stat" style={accent?{["--local-accent"]:accent}:undefined}>
    <Tip text={tip}><span className="kk-stat-label kk-dotted">{label}</span></Tip>
    <div className="kk-stat-row">
      {onChange&&<button className="kk-step" onClick={()=>onChange(value-1)} aria-label="−">−</button>}
      <span className="kk-stat-val">{value}{max!=null&&<span className="kk-stat-max">/{max}</span>}</span>
      {onChange&&<button className="kk-step" onClick={()=>onChange(value+1)} aria-label="+">+</button>}
    </div>
  </div>);
}

// ── Карточка (просмотр) ─────────────────────────────────────
function Card({ch,save,isGM,canAdv,onEdit,onAdvance,onLog}){
  const toughness=derive.toughness(ch), energyMax=derive.energyMax(ch);
  const im=ch.attributes.agility.modifier+ch.attributes.smarts.modifier;
  const initStr=`d${ch.attributes.agility.die} · d${ch.attributes.smarts.die} · d6 → 2 лучших${im?(im>0?` +${im}`:` ${im}`):""}`;
  const grouped=CAT_ORDER.map(cat=>({cat,items:(ch.skills||[]).filter(s=>s.categ===cat)})).filter(g=>g.items.length);
  const fac=ch.faculty||{};
  return (<div className="kk-card">
    <header className="kk-head">
      <div className="kk-portrait" style={{["--fac-color"]:fac.color||"#c8a14e"}}>
        {ch.portrait?<img src={ch.portrait} alt=""/>:<span className="kk-portrait-ph">{(ch.name||"?").slice(0,1)}</span>}
      </div>
      <div className="kk-head-main">
        <h1 className="kk-name">{ch.name}</h1>
        <div className="kk-head-tags">
          {fac.name&&<><span className="kk-fac" style={{["--fac-color"]:fac.color||"#c8a14e"}}>{fac.name}</span><span className="kk-sep">·</span></>}
          <span>{ch.academyYear} курс, {ch.semester} семестр</span><span className="kk-sep">·</span><span>{ch.age} лет</span>
        </div>
        <div className="kk-head-econ"><span className="kk-econ">◈ {ch.money}</span><span className="kk-econ">✦ {ch.experience} опыта</span></div>
      </div>
      <div className="kk-head-actions">
        {!isGM&&canAdv&&<button className="kk-adv-btn" onClick={onAdvance}>Прокачка</button>}
        {isGM&&<button className="kk-edit-btn" onClick={onEdit}>Редактировать вручную</button>}
        {isGM&&<button className="kk-edit-btn" onClick={onLog}>Логи</button>}
      </div>
    </header>

    <section className="kk-strip">
      <Stat label="Стойкость" value={toughness} tip="2 + ⌊Дух/2⌋. Считается автоматически." accent="var(--kk-gold)"/>
      <div className="kk-stat kk-stat-wide">
        <Tip text="Пул инициативы: Ловкость + Смекалка + Wild Die d6, 2 лучших. Бросок — вне карточки.">
          <span className="kk-stat-label kk-dotted">Инициатива</span></Tip>
        <span className="kk-init">{initStr}</span>
      </div>
      <Stat label="Энергия" value={ch.energy.value} max={energyMax}
        onChange={(v)=>save({"energy.value":Math.max(0,Math.min(energyMax,v))})} tip="Максимум = возраст + грань Духа." accent="var(--kk-gold)"/>
      <Stat label="Жетоны судьбы" value={ch.bennies} max={9}
        onChange={isGM?(v)=>save({bennies:Math.max(0,Math.min(9,v))}):undefined}
        tip={isGM?"Старт 3, максимум 9. Выдаёт/снимает ГМ.":"Старт 3, максимум 9. Меняет только ГМ."} accent="var(--kk-gold)"/>
    </section>

    <section className="kk-block">
      <h2 className="kk-h2">Здоровье</h2>
      <HealthTrack label="Физическое" attrLabel="Выносливости" attrDie={ch.attributes.endurance.die}
        value={ch.health.physical.value} onChange={(v)=>save({"health.physical.value":v})} tipExtra="Растёт от Выносливости."/>
      <HealthTrack label="Ментальное" attrLabel="Духа" attrDie={ch.attributes.spirit.die}
        value={ch.health.mental.value} onChange={(v)=>save({"health.mental.value":v})} tipExtra="Растёт от Духа."/>
    </section>

    <section className="kk-block">
      <h2 className="kk-h2">Атрибуты</h2>
      <div className="kk-attrs">{ATTR_ORDER.map((k)=>{ const a=ch.attributes[k]; return (
        <div className="kk-attr" key={k}><span className="kk-attr-name">{ATTR_LABEL[k]}</span><span className="kk-attr-die">{dieStr(a.die,a.modifier)}</span></div>);})}</div>
    </section>

    <section className="kk-block">
      <h2 className="kk-h2">Навыки</h2>
      {grouped.map(g=>(<div className="kk-skill-group" key={g.cat}>
        <div className="kk-skill-cat">{CAT_LABEL[g.cat]}</div>
        <div className="kk-skills">{g.items.map(s=>{ const unt=s.die===4&&s.modifier<=-2; return (
          <div className={`kk-skill ${unt?"untrained":""}`} key={s.name}>
            <span className="kk-skill-name">{s.name}</span>
            <Tip text={`Связан с: ${ATTR_LABEL[s.attr]}. Бросок — вне карточки. Не выше атрибута.`}>
              <span className="kk-skill-attr">{ATTR_SHORT[s.attr]}</span></Tip>
            <span className="kk-skill-die">{dieStr(s.die,s.modifier)}</span>
          </div>);})}</div>
      </div>))}
    </section>
  </div>);
}

// ── Прокачка за опыт (план с откатом) ───────────────────────
function AdvRow({name,attr,cur,action,changed,onStep,onUndo}){
  const can=action&&action.can&&action.type!=="blocked";
  return (<div className={`kk-adv-row ${changed?"changed":""}`}>
    <span className="kk-adv-name">{name}{attr&&<span className="kk-skill-attr2"> {attr}</span>}</span>
    <span className="kk-adv-cur">{cur}</span>
    <span className="kk-adv-next">{action?(action.type==="blocked"?<em>{action.label}</em>:<>{action.label} · <b>{action.cost}</b></>):<em>максимум</em>}</span>
    <button className="kk-adv-plus" disabled={!can} onClick={onStep} title={can?"+ шаг":"недоступно"}>+</button>
    <button className={`kk-adv-undo ${changed?"":"hide"}`} onClick={onUndo} title="откатить ряд, вернуть очки">↺</button>
  </div>);
}

function Advance({ch,settings,onApply,onCancel}){
  const [plan,setPlan]=useState({attributes:{},abilities:{}});
  const curAttr=(k)=> plan.attributes[k]||{die:ch.attributes[k].die,mod:ch.attributes[k].modifier};
  const curAbil=(i)=> plan.abilities[i]||{die:ch.skills[i].die,mod:ch.skills[i].modifier};
  const spent=[...Object.values(plan.attributes),...Object.values(plan.abilities)].reduce((s,e)=>s+(e.spent||0),0);
  const remaining=(ch.experience||0)-spent;

  const stepAttr=(k)=>{ const c=curAttr(k); const a=nextAttrAction(c.die,c.mod,settings,remaining); if(!a||!a.can||a.type==="blocked") return;
    setPlan(p=>{ const ex=p.attributes[k]; const fromDie=ex?ex.fromDie:ch.attributes[k].die; const fromMod=ex?ex.fromMod:ch.attributes[k].modifier;
      return {...p,attributes:{...p.attributes,[k]:{die:a.result.die,mod:a.result.mod,spent:(ex?.spent||0)+a.cost,fromDie,fromMod}}}; }); };
  const undoAttr=(k)=>setPlan(p=>{ const n={...p.attributes}; delete n[k]; return {...p,attributes:n}; });
  const stepAbil=(i)=>{ const c=curAbil(i); const sk=ch.skills[i]; const attr=curAttr(sk.attr);
    const a=nextAbilAction(c.die,c.mod,sk.categ,{die:attr.die,mod:attr.mod},settings,remaining); if(!a||!a.can||a.type==="blocked") return;
    setPlan(p=>{ const ex=p.abilities[i]; const fromDie=ex?ex.fromDie:sk.die; const fromMod=ex?ex.fromMod:sk.modifier;
      return {...p,abilities:{...p.abilities,[i]:{die:a.result.die,mod:a.result.mod,spent:(ex?.spent||0)+a.cost,fromDie,fromMod}}}; }); };
  const undoAbil=(i)=>setPlan(p=>{ const n={...p.abilities}; delete n[i]; return {...p,abilities:n}; });

  function apply(){
    const attributes=structuredClone(ch.attributes);
    for(const k in plan.attributes){ attributes[k]={...attributes[k],die:plan.attributes[k].die,modifier:plan.attributes[k].mod}; }
    const skills=(ch.skills||[]).map((s,i)=> plan.abilities[i]?{...s,die:plan.abilities[i].die,modifier:plan.abilities[i].mod}:s);
    const changes=[
      ...Object.entries(plan.attributes).map(([k,e])=>({kind:"attr",name:ATTR_LABEL[k],from:dieStr(e.fromDie,e.fromMod),to:dieStr(e.die,e.mod),spent:e.spent})),
      ...Object.entries(plan.abilities).map(([i,e])=>({kind:"skill",name:ch.skills[i].name,from:dieStr(e.fromDie,e.fromMod),to:dieStr(e.die,e.mod),spent:e.spent})),
    ];
    if(!changes.length) return;
    onApply({attributes,skills,spent,changes,newExperience:(ch.experience||0)-spent});
  }

  const grouped=CAT_ORDER.map(cat=>({cat,items:(ch.skills||[]).map((s,i)=>({s,i})).filter(o=>o.s.categ===cat)})).filter(g=>g.items.length);

  return (<div className="kk-edit">
    <div className="kk-edit-bar">
      <span className="kk-edit-title">Прокачка · {ch.name}</span>
      <div className="kk-adv-pool"><span>Опыт:</span> <b>{remaining}</b> <span className="kk-adv-spent">из {ch.experience||0}{spent>0?` · потратите ${spent}`:""}</span></div>
      <div className="kk-edit-actions">
        <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
        <button className="kk-btn primary" disabled={spent<=0} onClick={apply}>Применить</button>
      </div>
    </div>

    <section className="kk-block">
      <h2 className="kk-h2">Атрибуты</h2>
      <div className="kk-adv-list">{ATTR_ORDER.map(k=>{ const c=curAttr(k); const a=nextAttrAction(c.die,c.mod,settings,remaining);
        return <AdvRow key={k} name={ATTR_LABEL[k]} cur={dieStr(c.die,c.mod)} action={a} changed={!!plan.attributes[k]} onStep={()=>stepAttr(k)} onUndo={()=>undoAttr(k)}/>; })}</div>
    </section>

    {grouped.map(g=>(<section className="kk-block" key={g.cat}>
      <h2 className="kk-h2">Навыки · {CAT_LABEL[g.cat]}</h2>
      <div className="kk-adv-list">{g.items.map(({s,i})=>{ const c=curAbil(i); const attr=curAttr(s.attr);
        const a=nextAbilAction(c.die,c.mod,s.categ,{die:attr.die,mod:attr.mod},settings,remaining);
        return <AdvRow key={s.name+i} name={s.name} attr={ATTR_SHORT[s.attr]} cur={dieStr(c.die,c.mod)} action={a} changed={!!plan.abilities[i]} onStep={()=>stepAbil(i)} onUndo={()=>undoAbil(i)}/>; })}</div>
    </section>))}

    <div className="kk-edit-foot">
      <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
      <button className="kk-btn primary" disabled={spent<=0} onClick={apply}>Применить ({spent})</button>
    </div>
  </div>);
}

// ── Лог прокачки (ГМ) ───────────────────────────────────────
function fmtDate(at){ if(!at?.toDate) return "…"; const d=at.toDate();
  return d.toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
function LogView({char,onClose,onClear}){
  const [entries,setEntries]=useState(null);
  useEffect(()=>watchCharacterLog(CAMPAIGN_ID,char.id,setEntries),[char.id]);
  return (<div className="kk-edit">
    <div className="kk-edit-bar">
      <span className="kk-edit-title">Логи · {char.name}</span>
      <div className="kk-edit-actions">
        <button className="kk-btn ghost" onClick={onClose}>Назад</button>
        <button className="kk-btn danger" disabled={!entries?.length}
          onClick={()=>{ if(confirm("Удалить все записи лога этого персонажа?")) onClear(); }}>Удалить записи</button>
      </div>
    </div>
    {entries===null&&<div className="kk-load">Загрузка…</div>}
    {entries&&entries.length===0&&<div className="kk-empty">Записей пока нет.</div>}
    {entries&&entries.map(e=>(<div className="kk-log" key={e.id}>
      <div className="kk-log-head"><span className="kk-log-date">{fmtDate(e.at)}</span><span className="kk-log-spent">−{e.spent} опыта</span></div>
      <div className="kk-log-changes">{(e.changes||[]).map((c,j)=>(
        <div className="kk-log-row" key={j}><span className="kk-log-kind">{c.kind==="attr"?"атрибут":"навык"}</span><span className="kk-log-name">{c.name}</span><span className="kk-log-delta">{c.from} → {c.to}</span><span className="kk-log-cost">{c.spent}</span></div>))}</div>
    </div>))}
  </div>);
}

// ── Ручная редактура ГМ ─────────────────────────────────────
function EditCard({ch,onSave,onCancel}){
  const [d,setD]=useState(()=>structuredClone(ch));
  const set=(patch)=>setD(p=>({...p,...patch}));
  const setAttr=(k,f,v)=>setD(p=>({...p,attributes:{...p.attributes,[k]:{...p.attributes[k],[f]:v}}}));
  const setSkill=(i,f,v)=>setD(p=>{ const sk=[...p.skills]; sk[i]={...sk[i],[f]:v}; return {...p,skills:sk}; });
  const removeSkill=(i)=>setD(p=>({...p,skills:p.skills.filter((_,j)=>j!==i)}));
  const addSkill=(name)=>{ if(!name) return; const r=SKILL_BY_NAME[name]; setD(p=>({...p,skills:[...p.skills,{name,attr:r?.attr||"smarts",categ:r?.categ||"learned",die:4,modifier:-2}]})); };
  const pickFaculty=(f)=>setD(p=>({...p,faculty:{id:null,name:f.name,key:f.key,color:f.color},skills:mergeFacultySkills(p.skills,f)}));

  const [cName,setCName]=useState(""), [cAttr,setCAttr]=useState("smarts"), [cCat,setCCat]=useState("learned");
  const addCustom=()=>{ const n=cName.trim(); if(!n) return; if(d.skills.some(s=>s.name===n)){ alert("Навык с таким именем уже есть"); return; }
    setD(p=>({...p,skills:[...p.skills,{name:n,attr:cAttr,categ:cCat,die:4,modifier:-2,custom:true}]})); setCName(""); };

  const present=new Set(d.skills.map(s=>s.name));
  const addable=SKILLS_DATA.map(s=>s.name).filter(n=>!present.has(n));

  function commit(){ onSave({ name:d.name, age:Number(d.age)||0, academyYear:String(d.academyYear), semester:Number(d.semester)||1,
    faculty:d.faculty, attributes:d.attributes, skills:d.skills, money:Number(d.money)||0, experience:Number(d.experience)||0 }); }

  return (<div className="kk-edit">
    <div className="kk-edit-bar">
      <span className="kk-edit-title">Ручная редактура · {d.name}</span>
      <div className="kk-edit-actions">
        <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
        <button className="kk-btn primary" onClick={commit}>Сохранить</button>
      </div>
    </div>

    <section className="kk-block">
      <h2 className="kk-h2">Профиль</h2>
      <div className="kk-form-grid">
        <label className="kk-field"><span>Имя</span><input className="kk-input" value={d.name} onChange={e=>set({name:e.target.value})}/></label>
        <label className="kk-field"><span>Возраст</span><input className="kk-input" type="number" value={d.age} onChange={e=>set({age:e.target.value})}/></label>
        <label className="kk-field"><span>Курс</span><input className="kk-input" value={d.academyYear} onChange={e=>set({academyYear:e.target.value})}/></label>
        <label className="kk-field"><span>Семестр</span><select className="kk-input" value={d.semester} onChange={e=>set({semester:e.target.value})}><option value={1}>1</option><option value={2}>2</option></select></label>
        <label className="kk-field"><span>Деньги</span><input className="kk-input" type="number" value={d.money} onChange={e=>set({money:e.target.value})}/></label>
        <label className="kk-field"><span>Опыт</span><input className="kk-input" type="number" value={d.experience} onChange={e=>set({experience:e.target.value})}/></label>
      </div>
    </section>

    <section className="kk-block">
      <h2 className="kk-h2">Факультет</h2>
      <div className="kk-fac-grid">{FACULTIES.map(f=>(
        <button key={f.key} className={`kk-fac-chip ${d.faculty?.key===f.key?"on":""}`} style={{["--c"]:f.color}} onClick={()=>pickFaculty(f)}>
          <span className="kk-fac-dot"/><span>{f.name.replace(" факультет","")}</span></button>))}</div>
    </section>

    <section className="kk-block">
      <h2 className="kk-h2">Атрибуты</h2>
      <div className="kk-attrs-edit">{ATTR_ORDER.map(k=>(
        <div className="kk-attr-edit" key={k}>
          <span className="kk-attr-name">{ATTR_LABEL[k]}</span>
          <select className="kk-input sm" value={d.attributes[k].die} onChange={e=>setAttr(k,"die",Number(e.target.value))}>{DICE.map(x=><option key={x} value={x}>d{x}</option>)}</select>
          <input className="kk-input sm" type="number" value={d.attributes[k].modifier} onChange={e=>setAttr(k,"modifier",Number(e.target.value))} title="модификатор"/>
        </div>))}</div>
    </section>

    <section className="kk-block">
      <h2 className="kk-h2">Навыки <span className="kk-count">{d.skills.length}</span></h2>
      <div className="kk-skills-edit">{d.skills.map((s,i)=>(
        <div className="kk-skill-edit" key={s.name+i}>
          <span className="kk-skill-name" title={s.name}>{s.name}{s.custom&&<span className="kk-custom-tag">свой</span>}</span>
          <span className="kk-skill-attr2">{ATTR_SHORT[s.attr]}</span>
          <select className="kk-input sm" value={s.die} onChange={e=>setSkill(i,"die",Number(e.target.value))}>{DICE.map(x=><option key={x} value={x}>d{x}</option>)}</select>
          <input className="kk-input sm" type="number" value={s.modifier} onChange={e=>setSkill(i,"modifier",Number(e.target.value))} title="модификатор"/>
          <button className="kk-x" onClick={()=>removeSkill(i)} title="убрать">✕</button>
        </div>))}</div>
      <div className="kk-add-skill"><select className="kk-input" defaultValue="" onChange={e=>{addSkill(e.target.value); e.target.value="";}}>
        <option value="" disabled>+ добавить существующий навык…</option>{addable.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
      <div className="kk-custom-skill">
        <span className="kk-custom-label">Кастомный навык:</span>
        <input className="kk-input sm" placeholder="название" value={cName} onChange={e=>setCName(e.target.value)} style={{width:"160px"}}/>
        <select className="kk-input sm" value={cAttr} onChange={e=>setCAttr(e.target.value)}>{ATTR_ORDER.map(k=><option key={k} value={k}>{ATTR_LABEL[k]}</option>)}</select>
        <select className="kk-input sm" value={cCat} onChange={e=>setCCat(e.target.value)}>{Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <button className="kk-btn ghost sm" onClick={addCustom}>+ добавить</button>
      </div>
      <p className="kk-note">Категория кастомного навыка задаёт множитель цены прокачки.</p>
    </section>

    <div className="kk-edit-foot">
      <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
      <button className="kk-btn primary" onClick={commit}>Сохранить</button>
    </div>
  </div>);
}

// ── Настройки кампании (ГМ) ─────────────────────────────────
function CampaignSettings({campaign,onSave,onClose}){
  const [d,setD]=useState(()=>advSettings(campaign));
  const setIn=(g,k,v)=>setD(p=>({...p,[g]:{...p[g],[k]:v}}));
  const num=(v)=>{ const n=Number(v); return Number.isFinite(n)?n:0; };
  const Field=({label,group,k,step})=>(<label className="kk-field"><span>{label}</span>
    <input className="kk-input sm" type="number" step={step||1} value={d[group][k]} onChange={e=>setIn(group,k,num(e.target.value))}/></label>);
  return (<div className="kk-edit">
    <div className="kk-edit-bar">
      <span className="kk-edit-title">Настройки кампании · прокачка</span>
      <div className="kk-edit-actions">
        <button className="kk-btn ghost" onClick={onClose}>Закрыть</button>
        <button className="kk-btn primary" onClick={()=>onSave({advancement:d})}>Сохранить</button>
      </div>
    </div>
    <section className="kk-block"><h2 className="kk-h2">Атрибуты</h2>
      <p className="kk-note">Кубик: цена шага = база × № шага от d4. Мод: база × новый мод. Потолок мода на d20 — отдельно.</p>
      <div className="kk-form-grid"><Field label="База кубика" group="attr" k="dieCostBase"/><Field label="База мода" group="attr" k="modCostBase"/><Field label="Снятие штрафа" group="attr" k="negModCost"/><Field label="Потолок мода d20 (+N)" group="attr" k="d20ModCap"/></div>
    </section>
    <section className="kk-block"><h2 className="kk-h2">Навыки</h2>
      <p className="kk-note">Кубик: база × (№ шага +1). Мод: база × (2 × новый мод). Всё ×множитель категории.</p>
      <div className="kk-form-grid"><Field label="База кубика" group="abil" k="dieCostBase"/><Field label="База мода" group="abil" k="modCostBase"/><Field label="Снятие −1" group="abil" k="negModCost"/></div>
    </section>
    <section className="kk-block"><h2 className="kk-h2">Множители по группам навыков</h2>
      <div className="kk-form-grid"><Field label="Общие" group="catMult" k="common" step={0.1}/><Field label="Изученные" group="catMult" k="learned" step={0.1}/><Field label="Магические" group="catMult" k="magic" step={0.1}/><Field label="Личные" group="catMult" k="personal" step={0.1}/></div>
    </section>
    <div className="kk-edit-foot">
      <button className="kk-btn ghost" onClick={()=>setD(structuredClone(DEFAULT_ADVANCEMENT))}>Сбросить к дефолтам</button>
      <button className="kk-btn primary" onClick={()=>onSave({advancement:d})}>Сохранить</button>
    </div>
  </div>);
}

function CampaignHead({campaign,role}){
  const badge={gm:"ГМ",admin:"АДМИН",demo:"ДЕМО",player:null}[role];
  return (<div className="kk-campaign">
    <div className="kk-campaign-name">{campaign?.name||"Кампания"}{badge&&<span className="kk-gm-badge">{badge}</span>}</div>
    <div className="kk-campaign-meta"><span>{campaign?.gameDate||"дата не задана"}</span><span className="kk-sep">·</span><span>{campaign?.weather||"погода не задана"}</span></div>
  </div>);
}

function PlayerPortal({campaign,characters,onOpen,myUid,role}){
  return (<div className="kk-portal">
    <CampaignHead campaign={campaign} role={role}/>
    <div className="kk-party-label">Отряд</div>
    <div className="kk-party">{characters.map(p=>{ const self=p.ownerUid===myUid; const col=p.faculty?.color||"#c8a14e"; return (
      <button key={p.id} className={`kk-party-card ${self?"self":""}`} style={{["--fac-color"]:col}} onClick={()=>self&&onOpen(p.id)} disabled={!self}>
        <span className="kk-party-av">{(p.name||"?").slice(0,1)}</span><span className="kk-party-name">{p.name}</span>{self&&<span className="kk-party-you">это вы</span>}
      </button>);})}</div>
  </div>);
}

function GmPortal({campaign,characters,onOpen,onSettings,role}){
  return (<div className="kk-portal">
    <CampaignHead campaign={campaign} role={role}/>
    <div className="kk-gm-actions">
      <button className="kk-big" onClick={onSettings}><span className="kk-big-t">⚙ Настройки кампании</span><span className="kk-big-s">стоимость прокачки</span></button>
    </div>
    <div className="kk-party-label">Игроки · {characters.length}</div>
    {characters.length===0&&<div className="kk-empty">В кампании ещё нет персонажей.</div>}
    <div className="kk-party">{characters.map(p=>{ const col=p.faculty?.color||"#c8a14e"; return (
      <button key={p.id} className="kk-party-card" style={{["--fac-color"]:col}} onClick={()=>onOpen(p.id)}>
        <span className="kk-party-av">{(p.name||"?").slice(0,1)}</span><span className="kk-party-name">{p.name}</span>
        <span className="kk-party-sub">{p.faculty?.name||"без факультета"}</span>
      </button>);})}</div>
  </div>);
}

function Menu({open,onClose,onNav,current,onSignOut,isGM,isAdmin,actingAs,onActAs}){
  const items=MENU.map(m=>({...m, on: m.on || (isGM && m.id==="set")}));
  return (<>
    <div className={`kk-scrim ${open?"show":""}`} onClick={onClose} aria-hidden/>
    <aside className={`kk-drawer ${open?"show":""}`} aria-hidden={!open}>
      <div className="kk-drawer-head"><span>Навигация</span><button className="kk-drawer-x" onClick={onClose} aria-label="Закрыть">✕</button></div>
      {isAdmin&&<div className="kk-role-switch">
        <div className="kk-role-label">Режим админа</div>
        <div className="kk-role-btns">{[["gm","ГМ"],["player","Игрок"],["demo","Демо"]].map(([id,lbl])=>(
          <button key={id} className={`kk-role-btn ${actingAs===id?"on":""}`} onClick={()=>onActAs(id)}>{lbl}</button>))}</div>
      </div>}
      <nav className="kk-drawer-nav">{items.map(m=>(
        <button key={m.id} disabled={!m.on} className={`kk-drawer-item ${current===m.id?"cur":""} ${m.on?"":"soon"}`} onClick={()=>m.on&&onNav(m.id)}>
          <span>{m.label}</span>{!m.on&&<em>скоро</em>}</button>))}</nav>
      <button className="kk-drawer-out" onClick={onSignOut}>Выйти</button>
    </aside>
  </>);
}

// ── Корень ──────────────────────────────────────────────────
//
// Navigation decision (B-03):
//   Top-level routes (/landing, /print/:charId) live in main.jsx.
//   Portal sub-views (card, advance, log, settings) are driven by URL inside this
//   component via useNavigate/useLocation — no separate <Route> elements needed.
//   URLs: #/ → portal · #/card/:id → card · #/card/:id/advance → advance
//          #/card/:id/log → log · #/settings → settings
//   Formal component decomposition into separate files happens in B-06.
//
export default function App({user,signOut}){
  const navigate=useNavigate();
  const {pathname}=useLocation();

  const [campaign,setCampaign]=useState(null);
  const [characters,setCharacters]=useState([]);
  const [ready,setReady]=useState(false);
  const [menu,setMenu]=useState(false);
  const [editing,setEditing]=useState(false);
  const [overrides,setOverrides]=useState({});
  // Scopes overrides to a character ID so back/forward never applies one
  // character's unsaved changes to another character's view.
  const [overridesCharId,setOverridesCharId]=useState(null);
  const [creating,setCreating]=useState(false);
  const [newName,setNewName]=useState("");
  const [actingAs,setActingAs]=useState("player");
  // Persists the last charId the GM explicitly opened via openCard so the
  // "Карточка" menu item still works after returning to the portal.
  const [lastSelectedCharId,setLastSelectedCharId]=useState(null);

  useEffect(()=>watchCampaign(CAMPAIGN_ID,setCampaign),[]);
  useEffect(()=>watchCharacterList(CAMPAIGN_ID,(list)=>{ setCharacters(list); setReady(true); }),[]);

  // Derive view and active character ID from URL
  const cardMatch=pathname.match(/^\/card\/([^/]+)/);
  const urlCharId=cardMatch?cardMatch[1]:null;

  const view=/^\/card\/[^/]+\/advance$/.test(pathname)?"advance"
    :/^\/card\/[^/]+\/log$/.test(pathname)?"log"
    :/^\/card\//.test(pathname)?"card"
    :pathname==="/settings"?"settings"
    :"portal";

  const baseRole=campaign?.members?.[user.uid];
  const isAdmin=baseRole==="admin";
  const role=isAdmin?actingAs:baseRole;
  const isGM=role==="gm";
  const settings=advSettings(campaign);

  const myChar=characters.find(c=>c.ownerUid===user.uid)||null;
  // GM: use charId from URL; fall back to lastSelectedCharId when URL has no charId
  // (e.g. after returning to the portal via back button or logo click).
  // Player: always their own character regardless of URL.
  const activeId=isGM?(urlCharId||lastSelectedCharId):myChar?.id;
  const activeChar=characters.find(c=>c.id===activeId)||null;

  useEffect(()=>{ if(!activeChar) return;
    setOverrides(prev=>{ const next={...prev}; let ch=false;
      for(const p of Object.keys(prev)){ if(getPath(activeChar,p)===prev[p]){ delete next[p]; ch=true; } } return ch?next:prev; });
  },[activeChar]);

  // Only show overrides that belong to the currently viewed character.
  const effectiveOverrides=overridesCharId===activeId?overrides:{};
  const viewCh=activeChar?applyOverrides(activeChar,effectiveOverrides):null;
  const canAdv=activeChar?canAdvance(activeChar,settings):false;

  const save=useCallback((patch)=>{ if(!activeId) return;
    setOverridesCharId(activeId);
    setOverrides(prev=>({...prev,...patch})); saveCharacterDebounced(CAMPAIGN_ID,activeId,patch,500);
  },[activeId]);

  const openCard=useCallback((id)=>{
    setLastSelectedCharId(id); setOverridesCharId(null); setOverrides({}); setEditing(false); navigate(`/card/${id}`);
  },[navigate]);

  const saveEdit=useCallback(async(patch)=>{ if(!activeId) return;
    try{ await updateCharacterNow(CAMPAIGN_ID,activeId,patch); setEditing(false); }
    catch(e){ alert("Не удалось сохранить: "+(e?.message||e)); } },[activeId]);

  const saveSettings=useCallback(async(patch)=>{
    try{ await updateCampaignNow(CAMPAIGN_ID,patch); navigate("/"); }
    catch(e){ alert("Не удалось сохранить настройки: "+(e?.message||e)); } },[navigate]);

  // Apply advancement: log first, then update (so crash during write is recoverable).
  const applyAdvance=useCallback(async({attributes,skills,spent,changes,newExperience})=>{
    if(!activeId) return;
    try{
      await addLogEntry(CAMPAIGN_ID,activeId,{ type:"advancement", spent, changes });
      await updateCharacterNow(CAMPAIGN_ID,activeId,{ attributes, skills, experience:newExperience });
      navigate(`/card/${activeId}`);
    }catch(e){ alert("Не удалось применить прокачку: "+(e?.message||e)); }
  },[activeId, navigate]);

  const clearLog=useCallback(async()=>{ if(!activeId) return;
    try{ await clearCharacterLog(CAMPAIGN_ID,activeId); }catch(e){ alert("Не удалось очистить: "+(e?.message||e)); } },[activeId]);

  const nav=useCallback((id)=>{ setMenu(false);
    if(id==="portal") navigate("/");
    else if(id==="card"){ setEditing(false); navigate(activeId?`/card/${activeId}`:`/`); }
    else if(id==="set"&&isGM){ navigate("/settings"); }
  },[isGM, navigate, activeId]);

  const current=view==="portal"?"portal":(view==="settings"?"set":(view==="advance"?"adv":"card"));
  const actAs=useCallback((r)=>{ setActingAs(r); setMenu(false); setEditing(false); navigate("/"); },[navigate]);

  async function doCreate(){ if(!newName.trim()) return; setCreating(true);
    try{ const id=crypto.randomUUID(); await createCharacter(CAMPAIGN_ID,id,{name:newName.trim(),ownerUid:user.uid}); }
    catch(e){ alert("Не удалось создать: "+(e?.message||e)); } finally{ setCreating(false); setNewName(""); } }

  const campaignLoaded=campaign!==null;

  return (<div className="kk-root">
    <style>{CSS}</style>
    <div className="kk-bg" aria-hidden/>
    <div className="kk-shell">
      <div className="kk-topbar">
        <button className="kk-burger" onClick={()=>setMenu(true)} aria-label="Меню"><span/><span/><span/></button>
        <button className="kk-logo" onClick={()=>navigate("/")}>КК<span>9</span></button>
        {view!=="portal"&&<button className="kk-back" onClick={()=>{setEditing(false);navigate("/");}}>← к порталу</button>}
      </div>

      {(!ready||!campaignLoaded) && <div className="kk-load">Загрузка кампании…</div>}

      {ready && campaignLoaded && !baseRole && (
        <div className="kk-empty">Вы не участник этой кампании. Попросите ГМа добавить ваш UID в <code>members</code>.</div>
      )}

      {ready && campaignLoaded && role==="demo" && (
        <div className="kk-empty">Режим демонстрации. Модуль ещё не готов — права заложены, функции добавим позже.</div>
      )}

      {ready && campaignLoaded && role==="player" && !myChar && (
        <div className="kk-create">
          <h2 className="kk-h2">{isAdmin?"У админа нет привязанной карточки":"У вас ещё нет персонажа"}</h2>
          <p className="kk-note">Создадим карточку — базовые навыки добавятся сами. Полный мастер создания позже.</p>
          <input className="kk-input" placeholder="Имя персонажа" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doCreate()}/>
          <button className="kk-create-btn" disabled={creating||!newName.trim()} onClick={doCreate}>{creating?"Создаём…":"Создать персонажа"}</button>
        </div>
      )}

      {ready && campaignLoaded && view==="portal" && isGM && <GmPortal campaign={campaign} characters={characters} onOpen={openCard} onSettings={()=>navigate("/settings")} role={baseRole}/>}
      {ready && campaignLoaded && view==="portal" && role==="player" && myChar && <PlayerPortal campaign={campaign} characters={characters} onOpen={openCard} myUid={user.uid} role={baseRole}/>}

      {ready && campaignLoaded && view==="settings" && isGM && <CampaignSettings campaign={campaign} onSave={saveSettings} onClose={()=>navigate("/")}/>}

      {ready && view==="card" && viewCh && !editing && <Card ch={viewCh} save={save} isGM={isGM} canAdv={canAdv} onEdit={()=>setEditing(true)} onAdvance={()=>navigate(`/card/${activeId}/advance`)} onLog={()=>navigate(`/card/${activeId}/log`)}/>}
      {ready && view==="card" && viewCh && editing && isGM && <EditCard ch={activeChar} onSave={saveEdit} onCancel={()=>setEditing(false)}/>}
      {ready && view==="log" && viewCh && isGM && <LogView char={activeChar} onClose={()=>navigate(`/card/${activeId}`)} onClear={clearLog}/>}
      {ready && view==="advance" && viewCh && !isGM && <Advance ch={activeChar} settings={settings} onApply={applyAdvance} onCancel={()=>navigate(`/card/${activeId}`)}/>}
      {ready && (view==="card"||view==="advance"||view==="log") && !viewCh && <div className="kk-empty">Персонаж не выбран. Вернитесь на портал.</div>}
    </div>
    <Menu open={menu} onClose={()=>setMenu(false)} onNav={nav} current={current} onSignOut={signOut} isGM={isGM} isAdmin={isAdmin} actingAs={actingAs} onActAs={actAs}/>
  </div>);
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Golos+Text:wght@400;500;600;700&display=swap');
.kk-root{--kk-bg:#181410;--kk-bg-2:#1d1813;--kk-stone:#241d15;--kk-surface:#2a2218;--kk-surface-2:#32281b;
  --kk-line:#48391f;--kk-line-soft:#382d1c;--kk-text:#ece2cf;--kk-text-dim:#a8967a;--kk-text-faint:#7a6a52;
  --kk-gold:#c8a14e;--kk-gold-bright:#e2c178;--kk-gold-dim:#8a6c33;--kk-danger:#bd5a3a;--kk-danger-dim:#6f3522;
  --kk-cell-empty:#2c2317;--kk-cell-line:#4a3a23;--kk-cell-fill:var(--kk-gold);--fac-color:var(--kk-gold);
  --kk-r:10px;--kk-r-sm:7px;--kk-font-d:'Playfair Display',Georgia,serif;--kk-font-b:'Golos Text',system-ui,sans-serif;
  position:relative;min-height:100vh;color:var(--kk-text);font-family:var(--kk-font-b);background:var(--kk-bg);
  -webkit-font-smoothing:antialiased;line-height:1.45;overflow:hidden;}
.kk-root *{box-sizing:border-box;} .kk-root button{font-family:inherit;color:inherit;cursor:pointer;background:none;border:none;}
.kk-bg{position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(120% 90% at 50% -10%,#271f15 0%,var(--kk-bg) 58%,#120f0b 100%),
  repeating-linear-gradient(118deg,transparent 0 40px,rgba(255,230,180,.014) 40px 41px),
  repeating-linear-gradient(32deg,transparent 0 52px,rgba(0,0,0,.20) 52px 53px);}
.kk-shell{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:14px 14px 60px;}
.kk-topbar{display:flex;align-items:center;gap:12px;margin-bottom:18px;}
.kk-burger{width:34px;height:34px;flex:none;border:1px solid var(--kk-line);border-radius:8px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;}
.kk-burger span{width:16px;height:2px;background:var(--kk-gold);border-radius:2px;} .kk-burger:hover{border-color:var(--kk-gold);}
.kk-logo{font-family:var(--kk-font-d);font-weight:700;font-size:26px;color:var(--kk-text);} .kk-logo span{color:var(--kk-gold);}
.kk-back{margin-left:auto;font-size:13px;color:var(--kk-text-dim);} .kk-back:hover{color:var(--kk-gold);}
.kk-load,.kk-create{padding:30px 16px;color:var(--kk-text-dim);text-align:center;}
.kk-create{display:flex;flex-direction:column;gap:12px;align-items:center;max-width:380px;margin:20px auto;}
.kk-input{width:100%;padding:9px 11px;border-radius:var(--kk-r-sm);border:1px solid var(--kk-line);background:var(--kk-stone);color:var(--kk-text);font-family:inherit;font-size:14px;}
.kk-input:focus{outline:none;border-color:var(--kk-gold);} .kk-input.sm{padding:6px 8px;font-size:13px;width:auto;}
.kk-create-btn{width:100%;padding:12px;border-radius:9px;background:var(--kk-gold);color:#1a140c;font-weight:600;font-size:14px;}
.kk-create-btn:hover:not(:disabled){background:var(--kk-gold-bright);} .kk-create-btn:disabled{opacity:.5;cursor:default;}
.kk-scrim{position:absolute;inset:0;z-index:40;background:rgba(8,6,4,.6);opacity:0;pointer-events:none;transition:opacity .2s;}
.kk-scrim.show{opacity:1;pointer-events:auto;}
.kk-drawer{position:absolute;top:0;left:0;bottom:0;width:270px;max-width:82%;z-index:41;background:linear-gradient(180deg,var(--kk-surface) 0%,var(--kk-stone) 100%);border-right:1px solid var(--kk-line);transform:translateX(-102%);transition:transform .22s ease;display:flex;flex-direction:column;box-shadow:14px 0 40px rgba(0,0,0,.5);}
.kk-drawer.show{transform:translateX(0);}
.kk-drawer-head{display:flex;justify-content:space-between;align-items:center;padding:16px 16px 12px;font-family:var(--kk-font-d);font-size:18px;border-bottom:1px solid var(--kk-line-soft);}
.kk-drawer-x{font-size:15px;color:var(--kk-text-dim);} .kk-drawer-x:hover{color:var(--kk-gold);}
.kk-role-switch{padding:12px 14px;border-bottom:1px solid var(--kk-line-soft);background:var(--kk-stone);}
.kk-role-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--kk-text-faint);margin-bottom:7px;}
.kk-role-btns{display:flex;gap:5px;} .kk-role-btn{flex:1;padding:7px 4px;border:1px solid var(--kk-line);border-radius:6px;font-size:12px;color:var(--kk-text-dim);}
.kk-role-btn.on{background:var(--kk-gold);color:#1a140c;border-color:var(--kk-gold);font-weight:600;} .kk-role-btn:not(.on):hover{border-color:var(--kk-gold);color:var(--kk-text);}
.kk-drawer-nav{padding:8px;overflow-y:auto;flex:1;}
.kk-drawer-item{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;padding:11px 12px;border-radius:var(--kk-r-sm);font-size:14px;color:var(--kk-text);margin-bottom:2px;}
.kk-drawer-item:hover:not(:disabled){background:var(--kk-surface-2);color:var(--kk-gold-bright);}
.kk-drawer-item.cur{background:var(--kk-surface-2);color:var(--kk-gold);box-shadow:inset 2px 0 0 var(--kk-gold);}
.kk-drawer-item.soon{color:var(--kk-text-faint);cursor:default;} .kk-drawer-item em{font-style:normal;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--kk-text-faint);}
.kk-drawer-out{margin:8px;padding:11px;border-top:1px solid var(--kk-line-soft);color:var(--kk-text-dim);font-size:13px;text-align:left;} .kk-drawer-out:hover{color:var(--kk-danger);}
.kk-tip{position:relative;display:inline-flex;outline:none;} .kk-dotted{border-bottom:1px dotted var(--kk-text-faint);cursor:help;}
.kk-tip-pop{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);width:max-content;max-width:240px;padding:9px 11px;z-index:30;background:var(--kk-surface-2);color:var(--kk-text);font-size:12px;line-height:1.4;border:1px solid var(--kk-line);border-radius:var(--kk-r-sm);box-shadow:0 8px 26px rgba(0,0,0,.55);font-weight:500;white-space:normal;text-align:left;}
.kk-tip-pop::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:var(--kk-line);}
.kk-portal{display:flex;flex-direction:column;gap:18px;}
.kk-campaign{padding:20px;border-radius:var(--kk-r);border:1px solid var(--kk-line-soft);background:linear-gradient(160deg,var(--kk-surface) 0%,var(--kk-stone) 100%);position:relative;overflow:hidden;}
.kk-campaign::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--kk-gold);}
.kk-campaign-name{font-family:var(--kk-font-d);font-weight:700;font-size:25px;display:flex;align-items:center;gap:10px;}
.kk-gm-badge{font-family:var(--kk-font-b);font-size:10px;font-weight:700;letter-spacing:.1em;background:var(--kk-gold);color:#1a140c;padding:2px 7px;border-radius:5px;}
.kk-campaign-meta{margin-top:4px;color:var(--kk-text-dim);font-size:13px;display:flex;gap:8px;align-items:center;}
.kk-gm-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;}
.kk-party-label,.kk-skill-cat{font-family:var(--kk-font-b);text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--kk-text-faint);font-weight:600;}
.kk-party{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px;}
.kk-party-card{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;border:1px solid var(--kk-line-soft);border-radius:var(--kk-r);background:var(--kk-surface);transition:border-color .15s,transform .1s;}
.kk-party-card:not(:disabled):hover{border-color:var(--fac-color);transform:translateY(-2px);} .kk-party-card.self{border-color:var(--kk-gold-dim);} .kk-party-card:disabled{opacity:.45;cursor:default;}
.kk-party-av{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;font-family:var(--kk-font-d);font-weight:600;font-size:22px;color:#1a140c;background:var(--fac-color);border:2px solid rgba(255,240,210,.14);}
.kk-party-name{font-size:13px;font-weight:600;text-align:center;} .kk-party-you{font-size:10px;color:var(--kk-gold);letter-spacing:.08em;text-transform:uppercase;} .kk-party-sub{font-size:10px;color:var(--kk-text-faint);text-align:center;}
.kk-card{display:flex;flex-direction:column;gap:18px;} .kk-head{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;}
.kk-portrait{width:88px;height:88px;flex:none;border-radius:var(--kk-r);overflow:hidden;background:var(--kk-stone);border:1px solid var(--kk-line);box-shadow:inset 0 0 0 2px var(--kk-bg),0 0 0 1px var(--fac-color);display:grid;place-items:center;}
.kk-portrait img{width:100%;height:100%;object-fit:cover;} .kk-portrait-ph{font-family:var(--kk-font-d);font-size:40px;color:var(--kk-text-faint);}
.kk-head-main{flex:1;min-width:0;} .kk-name{font-family:var(--kk-font-d);font-weight:700;font-size:30px;margin:0 0 3px;}
.kk-head-tags{display:flex;flex-wrap:wrap;align-items:center;gap:7px;font-size:13px;color:var(--kk-text-dim);}
.kk-fac{color:var(--fac-color);font-weight:600;} .kk-sep{color:var(--kk-text-faint);}
.kk-head-econ{display:flex;gap:14px;margin-top:8px;} .kk-econ{font-size:13px;color:var(--kk-gold-bright);font-weight:600;}
.kk-head-actions{display:flex;flex-direction:column;gap:6px;}
.kk-edit-btn{padding:8px 12px;border:1px solid var(--kk-gold-dim);border-radius:var(--kk-r-sm);color:var(--kk-gold);font-size:13px;font-weight:600;}
.kk-edit-btn:hover{border-color:var(--kk-gold);background:var(--kk-surface);}
.kk-adv-btn{padding:9px 16px;border-radius:var(--kk-r-sm);background:var(--kk-gold);color:#1a140c;font-size:13px;font-weight:700;}
.kk-adv-btn:hover{background:var(--kk-gold-bright);}
.kk-empty{padding:28px 18px;text-align:center;color:var(--kk-text-dim);font-size:14px;border:1px dashed var(--kk-line);border-radius:var(--kk-r);margin-top:10px;} .kk-empty code{color:var(--kk-gold-bright);}
.kk-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));gap:10px;}
.kk-stat{padding:11px 13px;border:1px solid var(--kk-line-soft);border-radius:var(--kk-r);background:var(--kk-surface);display:flex;flex-direction:column;gap:6px;--local-accent:var(--kk-text);}
.kk-stat-wide{grid-column:span 2;} .kk-stat-label{font-family:var(--kk-font-b);font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:11px;color:var(--kk-text-dim);}
.kk-stat-row{display:flex;align-items:center;gap:8px;} .kk-stat-val{font-family:var(--kk-font-d);font-size:26px;font-weight:600;color:var(--local-accent);font-variant-numeric:tabular-nums;}
.kk-stat-max{font-size:15px;color:var(--kk-text-faint);} .kk-init{font-family:var(--kk-font-b);font-weight:500;font-size:15px;color:var(--kk-text);padding-top:3px;}
.kk-step{width:27px;height:27px;flex:none;border-radius:6px;border:1px solid var(--kk-line);color:var(--kk-text-dim);font-size:17px;line-height:1;display:grid;place-items:center;} .kk-step:hover{border-color:var(--kk-gold);color:var(--kk-gold);}
.kk-block{display:flex;flex-direction:column;gap:11px;} .kk-h2{font-family:var(--kk-font-b);font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:var(--kk-text-dim);margin:0;padding-bottom:6px;border-bottom:1px solid var(--kk-line-soft);display:flex;justify-content:space-between;align-items:center;} .kk-count{color:var(--kk-text-faint);font-weight:500;}
.kk-track{display:flex;flex-direction:column;gap:7px;} .kk-track-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;} .kk-track-name{font-weight:600;font-size:14px;} .kk-track-meta{font-size:11px;color:var(--kk-text-faint);}
.kk-pips{display:flex;gap:12px;flex-wrap:wrap;} .kk-pip{position:relative;display:flex;gap:5px;padding:7px;border-radius:10px;background:var(--kk-stone);border:1px solid var(--kk-line-soft);}
.kk-pip.started{border-color:var(--kk-gold-dim);} .kk-pip.closed{border-color:var(--kk-gold);} .kk-pip.ko{border-style:dashed;} .kk-pip.ko.started{border-color:var(--kk-danger);}
.kk-cell{width:38px;height:44px;border-radius:7px;border:1px solid var(--kk-cell-line);background:var(--kk-cell-empty);box-shadow:inset 0 2px 5px rgba(0,0,0,.45);transition:background .12s,box-shadow .12s;}
.kk-cell.filled{background:var(--kk-cell-fill);border-color:var(--kk-gold-bright);box-shadow:inset 0 1px 2px rgba(255,235,190,.3),0 0 8px rgba(200,161,78,.4);}
.kk-pip.ko .kk-cell.filled{background:var(--kk-danger);border-color:var(--kk-danger);box-shadow:0 0 9px rgba(189,90,58,.55);} .kk-cell:hover{border-color:var(--kk-gold);}
.kk-pip-num{position:absolute;top:-8px;right:-5px;font-size:10px;color:var(--kk-text-faint);background:var(--kk-bg);padding:0 3px;border-radius:4px;font-family:var(--kk-font-d);}
.kk-attrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:9px;}
.kk-attr{display:flex;flex-direction:column;gap:3px;padding:11px 13px;border-radius:var(--kk-r);border:1px solid var(--kk-line-soft);background:var(--kk-surface);text-align:center;}
.kk-attr-name{font-size:12px;color:var(--kk-text-dim);font-weight:500;} .kk-attr-die{font-family:var(--kk-font-d);font-size:23px;font-weight:600;color:var(--kk-gold-bright);}
.kk-skill-group{display:flex;flex-direction:column;gap:7px;margin-bottom:6px;} .kk-skills{display:grid;grid-template-columns:repeat(auto-fill,minmax(192px,1fr));gap:5px;}
.kk-skill{display:flex;align-items:center;gap:8px;padding:7px 11px;border-radius:var(--kk-r-sm);background:var(--kk-surface);border:1px solid var(--kk-line-soft);}
.kk-skill.untrained{opacity:.55;} .kk-skill-name{flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.kk-skill-attr{font-size:10px;color:var(--kk-text-faint);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px dotted var(--kk-text-faint);}
.kk-skill-die{font-family:var(--kk-font-d);font-size:16px;font-weight:600;color:var(--kk-gold-bright);min-width:44px;text-align:right;}
.kk-note{font-size:12px;color:var(--kk-text-faint);font-style:italic;margin:6px 0 0;}
/* — Прокачка/редактура/настройки/логи — */
.kk-edit{display:flex;flex-direction:column;gap:18px;}
.kk-edit-bar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 13px;border-radius:var(--kk-r);background:var(--kk-surface-2);border:1px solid var(--kk-gold-dim);}
.kk-edit-title{font-family:var(--kk-font-d);font-size:16px;} .kk-edit-actions{display:flex;gap:8px;} .kk-edit-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:6px;}
.kk-btn{padding:9px 16px;border-radius:var(--kk-r-sm);font-size:13px;font-weight:600;} .kk-btn.sm{padding:6px 11px;}
.kk-btn.primary{background:var(--kk-gold);color:#1a140c;} .kk-btn.primary:hover:not(:disabled){background:var(--kk-gold-bright);} .kk-btn.primary:disabled{opacity:.45;cursor:default;}
.kk-btn.ghost{border:1px solid var(--kk-line);color:var(--kk-text-dim);} .kk-btn.ghost:hover{border-color:var(--kk-gold);color:var(--kk-text);}
.kk-btn.danger{border:1px solid var(--kk-danger-dim);color:var(--kk-danger);} .kk-btn.danger:hover:not(:disabled){background:var(--kk-danger);color:#1a140c;} .kk-btn.danger:disabled{opacity:.4;cursor:default;}
.kk-adv-pool{font-size:14px;color:var(--kk-text-dim);} .kk-adv-pool b{font-family:var(--kk-font-d);font-size:22px;color:var(--kk-gold-bright);} .kk-adv-spent{font-size:11px;color:var(--kk-text-faint);}
.kk-adv-list{display:flex;flex-direction:column;gap:5px;}
.kk-adv-row{display:grid;grid-template-columns:1.4fr auto 1.6fr auto auto;align-items:center;gap:10px;padding:8px 11px;border:1px solid var(--kk-line-soft);border-radius:var(--kk-r-sm);background:var(--kk-surface);}
.kk-adv-row.changed{border-color:var(--kk-gold-dim);background:var(--kk-surface-2);}
.kk-adv-name{font-size:13px;font-weight:500;} .kk-adv-name .kk-skill-attr2{color:var(--kk-text-faint);font-size:10px;text-transform:uppercase;}
.kk-adv-cur{font-family:var(--kk-font-d);font-size:16px;color:var(--kk-gold-bright);min-width:44px;}
.kk-adv-next{font-size:12px;color:var(--kk-text-dim);text-align:right;} .kk-adv-next b{color:var(--kk-gold-bright);font-family:var(--kk-font-d);} .kk-adv-next em{color:var(--kk-text-faint);font-style:italic;}
.kk-adv-plus{width:28px;height:28px;border-radius:6px;border:1px solid var(--kk-gold-dim);color:var(--kk-gold);font-size:17px;line-height:1;} .kk-adv-plus:hover:not(:disabled){background:var(--kk-gold);color:#1a140c;} .kk-adv-plus:disabled{opacity:.3;cursor:default;border-color:var(--kk-line);color:var(--kk-text-faint);}
.kk-adv-undo{width:28px;height:28px;border-radius:6px;border:1px solid var(--kk-line);color:var(--kk-text-dim);font-size:14px;} .kk-adv-undo:hover{border-color:var(--kk-danger);color:var(--kk-danger);} .kk-adv-undo.hide{visibility:hidden;}
.kk-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;} .kk-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--kk-text-dim);}
.kk-attrs-edit{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;}
.kk-attr-edit{display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid var(--kk-line-soft);border-radius:var(--kk-r-sm);background:var(--kk-surface);} .kk-attr-edit .kk-attr-name{flex:1;text-align:left;}
.kk-skills-edit{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px;}
.kk-skill-edit{display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid var(--kk-line-soft);border-radius:var(--kk-r-sm);background:var(--kk-surface);}
.kk-skill-edit .kk-skill-name{flex:1;} .kk-skill-attr2{font-size:10px;color:var(--kk-text-faint);text-transform:uppercase;width:34px;}
.kk-custom-tag{font-size:9px;color:var(--kk-gold);border:1px solid var(--kk-gold-dim);border-radius:4px;padding:0 4px;margin-left:5px;text-transform:uppercase;}
.kk-x{width:24px;height:24px;flex:none;border-radius:5px;border:1px solid var(--kk-line);color:var(--kk-text-faint);font-size:12px;} .kk-x:hover{border-color:var(--kk-danger);color:var(--kk-danger);}
.kk-add-skill{margin-top:8px;} .kk-add-skill .kk-input{max-width:280px;}
.kk-custom-skill{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin-top:8px;} .kk-custom-label{font-size:12px;color:var(--kk-text-dim);}
.kk-fac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;}
.kk-fac-chip{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:var(--kk-r-sm);border:1px solid var(--kk-line-soft);background:var(--kk-stone);font-size:13px;color:var(--kk-text);text-align:left;}
.kk-fac-chip:hover{border-color:var(--c);} .kk-fac-chip.on{border-color:var(--c);box-shadow:inset 0 0 0 1px var(--c);}
.kk-fac-dot{width:13px;height:13px;flex:none;border-radius:50%;background:var(--c);border:1px solid rgba(255,255,255,.18);}
.kk-log{border:1px solid var(--kk-line-soft);border-radius:var(--kk-r-sm);background:var(--kk-surface);padding:10px 12px;margin-bottom:7px;}
.kk-log-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;} .kk-log-date{font-size:12px;color:var(--kk-text-dim);} .kk-log-spent{font-size:13px;font-weight:600;color:var(--kk-danger);}
.kk-log-changes{display:flex;flex-direction:column;gap:3px;} .kk-log-row{display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;align-items:center;font-size:12px;}
.kk-log-kind{font-size:9px;text-transform:uppercase;color:var(--kk-text-faint);} .kk-log-name{color:var(--kk-text);} .kk-log-delta{font-family:var(--kk-font-d);color:var(--kk-gold-bright);} .kk-log-cost{color:var(--kk-text-faint);}
@media (max-width:560px){.kk-strip{grid-template-columns:1fr 1fr;} .kk-name{font-size:25px;} .kk-cell{width:32px;height:40px;} .kk-edit-bar{flex-direction:column;align-items:stretch;} .kk-adv-row{grid-template-columns:1fr auto auto auto;} .kk-adv-next{grid-column:1 / -1;text-align:left;}}
`;
