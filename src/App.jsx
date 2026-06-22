import React, { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// КК9 — Прототип портала и карточки игрока (этап 1) · v2
// Правки: тёплый «старый камень» (без синевы), широкие пипы,
// шрифты Playfair Display + Golos Text, глобальное меню «всё на свете».
// Данные — мок. Бросков нет. Вся палитра — в :root.
// ============================================================

function attrPipSizes(die) {
  switch (die) {
    case 20: return [2, 2, 2, 2, 1];
    case 12: return [1, 2, 2, 2, 1];
    case 10: return [1, 1, 2, 2, 1];
    case 8:  return [1, 1, 1, 2, 1];
    default: return [1, 1, 1, 1, 1];
  }
}
function computeHealthPips(attrDie) {
  const sizes = attrPipSizes(attrDie).map((s, i) => (i === 4 ? 1 : s));
  const thresholds = [0];
  for (let i = 0; i < 4; i++) thresholds.push(thresholds[i] + sizes[i]);
  return { sizes, thresholds, maxValue: sizes.reduce((a, b) => a + b, 0) };
}
function buildPipStates(value, sizes, thresholds) {
  return sizes.map((size, i) => {
    const lo = thresholds[i];
    const filled = Math.max(0, Math.min(size, value - lo));
    return {
      pip: i + 1, size, lo,
      cells: Array.from({ length: size }, (_, c) => ({ filled: c < filled })),
      started: filled > 0, closed: filled >= size, knockout: i === 4,
    };
  });
}

const ATTR_LABEL = { agility: "Ловкость", smarts: "Смекалка", spirit: "Дух", endurance: "Выносливость", magic: "Магия" };
const ATTR_SHORT = { agility: "Ловк", smarts: "Смек", spirit: "Дух", endurance: "Вын", magic: "Магия" };
const CAT_LABEL  = { common: "Общие", learned: "Изученные", personal: "Личные", magic: "Магические" };
const CAT_ORDER  = ["common", "learned", "personal", "magic"];

const MOCK = {
  name: "Адель Вернер", portrait: "", age: 17,
  facultyName: "Аналитика", facultyColor: "#c4a36a", course: 2, semester: 1,
  money: 340, experience: 12, bennies: 3,
  attributes: {
    agility:{die:8,modifier:0}, smarts:{die:6,modifier:0}, spirit:{die:8,modifier:0},
    endurance:{die:10,modifier:0}, magic:{die:6,modifier:0},
  },
  health: { physical: 3, mental: 1 }, energy: 18,
  skills: [
    { name:"Атлетика", attr:"endurance", die:6, modifier:0, categ:"common" },
    { name:"Плавание", attr:"endurance", die:4, modifier:-2, categ:"learned" },
    { name:"Общая эрудиция", attr:"smarts", die:6, modifier:0, categ:"common" },
    { name:"Наблюдательность", attr:"smarts", die:8, modifier:0, categ:"common" },
    { name:"Анализ", attr:"smarts", die:8, modifier:1, categ:"common" },
    { name:"Языки", attr:"smarts", die:4, modifier:-2, categ:"common" },
    { name:"Знание Нижнего Мира", attr:"smarts", die:6, modifier:0, categ:"common" },
    { name:"Техника", attr:"smarts", die:4, modifier:-2, categ:"learned" },
    { name:"Электроника", attr:"smarts", die:6, modifier:0, categ:"common" },
    { name:"Ориентирование", attr:"smarts", die:4, modifier:-2, categ:"learned" },
    { name:"Эмпатия", attr:"spirit", die:6, modifier:0, categ:"common" },
    { name:"Самоконтроль", attr:"spirit", die:6, modifier:0, categ:"learned" },
    { name:"Убеждение", attr:"spirit", die:4, modifier:-2, categ:"common" },
    { name:"Обман", attr:"spirit", die:4, modifier:-2, categ:"learned" },
    { name:"Запугивание", attr:"spirit", die:4, modifier:-2, categ:"common" },
    { name:"Исполнение", attr:"spirit", die:4, modifier:-2, categ:"common" },
    { name:"Интуиция", attr:"magic", die:6, modifier:0, categ:"common" },
    { name:"Рукопашный бой", attr:"agility", die:6, modifier:0, categ:"common" },
    { name:"Скрытность", attr:"agility", die:8, modifier:0, categ:"common" },
    { name:"Координация", attr:"agility", die:6, modifier:0, categ:"common" },
    { name:"Кулинария", attr:"agility", die:4, modifier:-2, categ:"learned" },
    { name:"Расследование", attr:"smarts", die:6, modifier:0, categ:"common" },
    { name:"Программирование", attr:"smarts", die:8, modifier:0, categ:"learned" },
  ],
};

const PARTY = [
  { name:"Адель Вернер", facultyColor:"#c4a36a", self:true },
  { name:"Кай Лестрем", facultyColor:"#c4847c" },
  { name:"Норн", facultyColor:"#9caf7c" },
  { name:"Тео Брандт", facultyColor:"#b09cc4" },
];
const CAMPAIGN = { name:"Кадеты Корпуса 9", date:"14.03.2031", weather:"Морось, +4°" };

// Глобальное меню «всё на свете»
const MENU = [
  { id:"portal", label:"Портал", on:true },
  { id:"card",   label:"Моя карточка", on:true },
  { id:"rel",    label:"Связи", on:true },
  { id:"adv",    label:"Прокачка" },
  { id:"gear",   label:"Снаряжение" },
  { id:"magic",  label:"Магия" },
  { id:"log",    label:"Лог сессий" },
  { id:"scene",  label:"Сцена" },
  { id:"shop",   label:"Магазин" },
  { id:"journal",label:"Журнал кампании" },
  { id:"gm",     label:"Год Мод · ГМ" },
  { id:"print",  label:"Печать карточки" },
  { id:"set",    label:"Настройки" },
];

function Tip({ text, children, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <span ref={ref} className="kk-tip"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      tabIndex={0} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      aria-label={typeof text === "string" ? text : label}>
      {children}
      {open && <span className="kk-tip-pop" role="tooltip">{text}</span>}
    </span>
  );
}

const dieStr = (die, mod) => `d${die}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ""}`;

function HealthTrack({ label, attrLabel, attrDie, value, onChange, tipExtra }) {
  const { sizes, thresholds, maxValue } = computeHealthPips(attrDie);
  const states = buildPipStates(value, sizes, thresholds);
  const setVal = (v) => onChange(Math.max(0, Math.min(maxValue, v)));
  return (
    <div className="kk-track">
      <div className="kk-track-head">
        <Tip text={`${label}: ${value}/${maxValue} ячеек. ${tipExtra} Пип «начат» — штраф порога навешен. 5-й пип = нокаут (без сознания / при смерти).`}>
          <span className="kk-track-name kk-dotted">{label}</span>
        </Tip>
        <span className="kk-track-meta">{value}/{maxValue} · от {attrLabel} d{attrDie}</span>
      </div>
      <div className="kk-pips">
        {states.map((p) => {
          let cellIdx = p.lo;
          return (
            <div key={p.pip} className={`kk-pip ${p.knockout ? "ko" : ""} ${p.started ? "started" : ""} ${p.closed ? "closed" : ""}`}>
              {p.cells.map((c, ci) => {
                const abs = ++cellIdx;
                return (
                  <button key={ci} className={`kk-cell ${c.filled ? "filled" : ""}`}
                    onClick={() => setVal(value === abs ? abs - 1 : abs)} aria-label={`${label} ячейка ${abs}`} />
                );
              })}
              <span className="kk-pip-num">{p.pip}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, onChange, max, tip, accent }) {
  return (
    <div className="kk-stat" style={accent ? { ["--local-accent"]: accent } : undefined}>
      <Tip text={tip}><span className="kk-stat-label kk-dotted">{label}</span></Tip>
      <div className="kk-stat-row">
        {onChange && <button className="kk-step" onClick={() => onChange(value - 1)} aria-label="−">−</button>}
        <span className="kk-stat-val">{value}{max != null && <span className="kk-stat-max">/{max}</span>}</span>
        {onChange && <button className="kk-step" onClick={() => onChange(value + 1)} aria-label="+">+</button>}
      </div>
    </div>
  );
}

function Card({ ch, setCh, tab, setTab }) {
  const upd = (patch) => setCh((c) => ({ ...c, ...patch }));
  const toughness = 2 + Math.floor(ch.attributes.spirit.die / 2);
  const energyMax = ch.age + ch.attributes.spirit.die;
  const im = ch.attributes.agility.modifier + ch.attributes.smarts.modifier;
  const initStr = `d${ch.attributes.agility.die} · d${ch.attributes.smarts.die} · d6 → 2 лучших${im ? (im > 0 ? ` +${im}` : ` ${im}`) : ""}`;
  const grouped = CAT_ORDER.map((cat) => ({ cat, items: ch.skills.filter((s) => s.categ === cat) })).filter((g) => g.items.length);

  return (
    <div className="kk-card">
      <header className="kk-head">
        <div className="kk-portrait" style={{ ["--fac-color"]: ch.facultyColor }}>
          {ch.portrait ? <img src={ch.portrait} alt="" /> : <span className="kk-portrait-ph">{ch.name.slice(0, 1)}</span>}
        </div>
        <div className="kk-head-main">
          <h1 className="kk-name">{ch.name}</h1>
          <div className="kk-head-tags">
            <span className="kk-fac" style={{ ["--fac-color"]: ch.facultyColor }}>{ch.facultyName}</span>
            <span className="kk-sep">·</span><span>{ch.course} курс, {ch.semester} семестр</span>
            <span className="kk-sep">·</span><span>{ch.age} лет</span>
          </div>
          <div className="kk-head-econ">
            <Tip text="Деньги. Тратятся в магазине (этап 2+). Накрутить себе нельзя — закроют Security Rules.">
              <span className="kk-econ kk-dotted">◈ {ch.money}</span></Tip>
            <Tip text="Опыт. Распределяется в прокачке по навыкам и атрибутам.">
              <span className="kk-econ kk-dotted">✦ {ch.experience} опыта</span></Tip>
          </div>
        </div>
      </header>

      <nav className="kk-tabs">
        <button className={tab === "main" ? "on" : ""} onClick={() => setTab("main")}>Основное</button>
        <button className={tab === "rel" ? "on" : ""} onClick={() => setTab("rel")}>Связи</button>
        <button className="kk-tab-soon" disabled>Снаряжение <em>скоро</em></button>
        <button className="kk-tab-soon" disabled>Магия <em>скоро</em></button>
      </nav>

      {tab === "rel" && (
        <div className="kk-empty">Связи, контакты и спутники переносим отдельной сущностью на следующем шаге. Сюда же ведёт клик по другому игроку на портале.</div>
      )}

      {tab === "main" && (
        <>
          <section className="kk-strip">
            <Stat label="Стойкость" value={toughness} tip="Стойкость = 2 + ⌊Дух/2⌋. Считается автоматически." accent="var(--kk-gold)" />
            <div className="kk-stat kk-stat-wide">
              <Tip text="Пул инициативы: кубики Ловкости и Смекалки + Wild Die d6, оставляем 2 лучших. Бросок — вне карточки.">
                <span className="kk-stat-label kk-dotted">Инициатива</span></Tip>
              <span className="kk-init">{initStr}</span>
            </div>
            <Stat label="Энергия" value={ch.energy} max={energyMax}
              onChange={(v) => upd({ energy: Math.max(0, Math.min(energyMax, v)) })}
              tip="Энергия. Максимум = возраст + грань Духа." accent="var(--kk-gold)" />
            <Stat label="Жетоны судьбы" value={ch.bennies} max={9}
              onChange={(v) => upd({ bennies: Math.max(0, Math.min(9, v)) })}
              tip="Жетоны судьбы. У нового персонажа 3, максимум 9." accent="var(--kk-gold)" />
          </section>

          <section className="kk-block">
            <h2 className="kk-h2">Здоровье</h2>
            <HealthTrack label="Физическое" attrLabel="Выносливости" attrDie={ch.attributes.endurance.die}
              value={ch.health.physical} onChange={(v) => upd({ health: { ...ch.health, physical: v } })}
              tipExtra="Размер пипов растёт от Выносливости." />
            <HealthTrack label="Ментальное" attrLabel="Духа" attrDie={ch.attributes.spirit.die}
              value={ch.health.mental} onChange={(v) => upd({ health: { ...ch.health, mental: v } })}
              tipExtra="Размер пипов растёт от Духа." />
          </section>

          <section className="kk-block">
            <h2 className="kk-h2">Атрибуты</h2>
            <div className="kk-attrs">
              {Object.entries(ch.attributes).map(([key, a]) => (
                <div className="kk-attr" key={key}>
                  <span className="kk-attr-name">{ATTR_LABEL[key]}</span>
                  <span className="kk-attr-die">{dieStr(a.die, a.modifier)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="kk-block">
            <h2 className="kk-h2">Навыки</h2>
            {grouped.map((g) => (
              <div className="kk-skill-group" key={g.cat}>
                <div className="kk-skill-cat">{CAT_LABEL[g.cat]}</div>
                <div className="kk-skills">
                  {g.items.map((s) => {
                    const untrained = s.die === 4 && s.modifier <= -2;
                    return (
                      <div className={`kk-skill ${untrained ? "untrained" : ""}`} key={s.name}>
                        <span className="kk-skill-name">{s.name}</span>
                        <Tip text={`Связан с: ${ATTR_LABEL[s.attr]}. Бросок — вне карточки. Не может быть выше связанного атрибута.`}>
                          <span className="kk-skill-attr">{ATTR_SHORT[s.attr]}</span></Tip>
                        <span className="kk-skill-die">{dieStr(s.die, s.modifier)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="kk-note">На чистой карточке — только базовые навыки. Факультетские докидываются в массив при выборе факультета; сверх — только ГМ.</p>
          </section>
        </>
      )}
    </div>
  );
}

function Portal({ onOpenCard }) {
  return (
    <div className="kk-portal">
      <div className="kk-campaign">
        <div className="kk-campaign-name">{CAMPAIGN.name}</div>
        <div className="kk-campaign-meta"><span>{CAMPAIGN.date}</span><span className="kk-sep">·</span><span>{CAMPAIGN.weather}</span></div>
      </div>
      <div className="kk-party-label">Отряд</div>
      <div className="kk-party">
        {PARTY.map((p) => (
          <button key={p.name} className={`kk-party-card ${p.self ? "self" : ""}`} style={{ ["--fac-color"]: p.facultyColor }}
            onClick={() => onOpenCard(p.self ? "main" : "rel")}>
            <span className="kk-party-av">{p.name.slice(0, 1)}</span>
            <span className="kk-party-name">{p.name}</span>
            {p.self && <span className="kk-party-you">это вы</span>}
          </button>
        ))}
      </div>
      <div className="kk-portal-nav">
        <button className="kk-big" onClick={() => onOpenCard("main")}>
          <span className="kk-big-t">Моя карточка</span><span className="kk-big-s">персонаж целиком</span></button>
        <button className="kk-big ghost" disabled><span className="kk-big-t">Лог сессий</span><span className="kk-big-s">скоро</span></button>
        <button className="kk-big ghost" disabled><span className="kk-big-t">Сцена</span><span className="kk-big-s">скоро</span></button>
      </div>
    </div>
  );
}

function Menu({ open, onClose, onNav, current }) {
  return (
    <>
      <div className={`kk-scrim ${open ? "show" : ""}`} onClick={onClose} aria-hidden />
      <aside className={`kk-drawer ${open ? "show" : ""}`} aria-hidden={!open}>
        <div className="kk-drawer-head"><span>Навигация</span><button className="kk-drawer-x" onClick={onClose} aria-label="Закрыть">✕</button></div>
        <nav className="kk-drawer-nav">
          {MENU.map((m) => (
            <button key={m.id} disabled={!m.on} className={`kk-drawer-item ${current === m.id ? "cur" : ""} ${m.on ? "" : "soon"}`}
              onClick={() => m.on && onNav(m.id)}>
              <span>{m.label}</span>{!m.on && <em>скоро</em>}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default function KK9App() {
  const [view, setView] = useState("portal");
  const [tab, setTab] = useState("main");
  const [ch, setCh] = useState(MOCK);
  const [menu, setMenu] = useState(false);
  const openCard = useCallback((t) => { setTab(t); setView("card"); }, []);
  const nav = useCallback((id) => {
    setMenu(false);
    if (id === "portal") setView("portal");
    else if (id === "card") { setTab("main"); setView("card"); }
    else if (id === "rel") { setTab("rel"); setView("card"); }
  }, []);
  const current = view === "portal" ? "portal" : (tab === "rel" ? "rel" : "card");

  return (
    <div className="kk-root">
      <style>{CSS}</style>
      <div className="kk-bg" aria-hidden />
      <div className="kk-shell">
        <div className="kk-topbar">
          <button className="kk-burger" onClick={() => setMenu(true)} aria-label="Меню">
            <span /><span /><span />
          </button>
          <button className="kk-logo" onClick={() => setView("portal")}>КК<span>9</span></button>
          {view === "card" && <button className="kk-back" onClick={() => setView("portal")}>← к порталу</button>}
        </div>
        {view === "portal" ? <Portal onOpenCard={openCard} /> : <Card ch={ch} setCh={setCh} tab={tab} setTab={setTab} />}
      </div>
      <Menu open={menu} onClose={() => setMenu(false)} onNav={nav} current={current} />
    </div>
  );
}

// ============================================================
// ВСЯ ПАЛИТРА — В ПЕРЕМЕННЫХ. Тёплый «старый камень» + золото.
// Смена темы и цвета факультетов правятся ТОЛЬКО здесь.
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Golos+Text:wght@400;500;600;700&display=swap');

.kk-root{
  /* — База: тёплый камень, без синевы — */
  --kk-bg:#181410; --kk-bg-2:#1d1813; --kk-stone:#241d15;
  --kk-surface:#2a2218; --kk-surface-2:#32281b;
  --kk-line:#48391f; --kk-line-soft:#382d1c;
  --kk-text:#ece2cf; --kk-text-dim:#a8967a; --kk-text-faint:#7a6a52;
  /* — Акцент: тёплое золото — */
  --kk-gold:#c8a14e; --kk-gold-bright:#e2c178; --kk-gold-dim:#8a6c33;
  /* — Опасность (нокаут/тяжёлый) — */
  --kk-danger:#bd5a3a; --kk-danger-dim:#6f3522;
  /* — Пипы — */
  --kk-cell-empty:#2c2317; --kk-cell-line:#4a3a23; --kk-cell-fill:var(--kk-gold);
  /* — Крючок под тему факультета (этап 2) — */
  --fac-color:var(--kk-gold);
  --kk-r:10px; --kk-r-sm:7px;
  --kk-font-d:'Playfair Display',Georgia,serif; --kk-font-b:'Golos Text',system-ui,sans-serif;

  position:relative; min-height:660px; color:var(--kk-text); font-family:var(--kk-font-b);
  background:var(--kk-bg); -webkit-font-smoothing:antialiased; line-height:1.45; overflow:hidden;
}
.kk-root *{box-sizing:border-box;}
.kk-root button{font-family:inherit; color:inherit; cursor:pointer; background:none; border:none;}

/* — Старый камень с трещинами: тёплый, тонкий — */
.kk-bg{position:absolute; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(120% 90% at 50% -10%, #271f15 0%, var(--kk-bg) 58%, #120f0b 100%),
    repeating-linear-gradient(118deg, transparent 0 40px, rgba(255,230,180,.014) 40px 41px),
    repeating-linear-gradient(32deg, transparent 0 52px, rgba(0,0,0,.20) 52px 53px);
}
.kk-bg::after{content:""; position:absolute; inset:0; opacity:.45; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><path d='M0 66 L78 82 L132 50 L220 78' stroke='black' stroke-width='.7' fill='none' opacity='.5'/><path d='M44 0 L60 88 L38 154 L66 220' stroke='black' stroke-width='.5' fill='none' opacity='.4'/><path d='M220 142 L143 132 L99 176 L0 165' stroke='%23ffe9c8' stroke-width='.4' fill='none' opacity='.2'/></svg>");
}

.kk-shell{position:relative; z-index:1; max-width:760px; margin:0 auto; padding:14px 14px 60px;}
.kk-topbar{display:flex; align-items:center; gap:12px; margin-bottom:18px;}
.kk-burger{width:34px; height:34px; flex:none; border:1px solid var(--kk-line); border-radius:8px;
  display:flex; flex-direction:column; justify-content:center; align-items:center; gap:4px;}
.kk-burger span{width:16px; height:2px; background:var(--kk-gold); border-radius:2px;}
.kk-burger:hover{border-color:var(--kk-gold);}
.kk-logo{font-family:var(--kk-font-d); font-weight:700; font-size:26px; letter-spacing:.02em; color:var(--kk-text);}
.kk-logo span{color:var(--kk-gold);}
.kk-back{margin-left:auto; font-size:13px; color:var(--kk-text-dim);}
.kk-back:hover{color:var(--kk-gold);}

/* — Глобальное меню «всё на свете» — */
.kk-scrim{position:absolute; inset:0; z-index:40; background:rgba(8,6,4,.6); opacity:0; pointer-events:none; transition:opacity .2s;}
.kk-scrim.show{opacity:1; pointer-events:auto;}
.kk-drawer{position:absolute; top:0; left:0; bottom:0; width:270px; max-width:82%; z-index:41;
  background:linear-gradient(180deg, var(--kk-surface) 0%, var(--kk-stone) 100%);
  border-right:1px solid var(--kk-line); transform:translateX(-102%); transition:transform .22s ease;
  display:flex; flex-direction:column; box-shadow:14px 0 40px rgba(0,0,0,.5);}
.kk-drawer.show{transform:translateX(0);}
.kk-drawer-head{display:flex; justify-content:space-between; align-items:center; padding:16px 16px 12px;
  font-family:var(--kk-font-d); font-size:18px; border-bottom:1px solid var(--kk-line-soft);}
.kk-drawer-x{font-size:15px; color:var(--kk-text-dim);}
.kk-drawer-x:hover{color:var(--kk-gold);}
.kk-drawer-nav{padding:8px; overflow-y:auto;}
.kk-drawer-item{display:flex; justify-content:space-between; align-items:center; width:100%; text-align:left;
  padding:11px 12px; border-radius:var(--kk-r-sm); font-size:14px; color:var(--kk-text); margin-bottom:2px;}
.kk-drawer-item:hover:not(:disabled){background:var(--kk-surface-2); color:var(--kk-gold-bright);}
.kk-drawer-item.cur{background:var(--kk-surface-2); color:var(--kk-gold); box-shadow:inset 2px 0 0 var(--kk-gold);}
.kk-drawer-item.soon{color:var(--kk-text-faint); cursor:default;}
.kk-drawer-item em{font-style:normal; font-size:9px; text-transform:uppercase; letter-spacing:.08em; color:var(--kk-text-faint);}

.kk-tip{position:relative; display:inline-flex; outline:none;}
.kk-dotted{border-bottom:1px dotted var(--kk-text-faint); cursor:help;}
.kk-tip-pop{position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
  width:max-content; max-width:240px; padding:9px 11px; z-index:30;
  background:var(--kk-surface-2); color:var(--kk-text); font-size:12px; line-height:1.4;
  border:1px solid var(--kk-line); border-radius:var(--kk-r-sm); box-shadow:0 8px 26px rgba(0,0,0,.55);
  font-weight:500; white-space:normal; text-align:left;}
.kk-tip-pop::after{content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
  border:6px solid transparent; border-top-color:var(--kk-line);}

.kk-portal{display:flex; flex-direction:column; gap:18px;}
.kk-campaign{padding:20px; border-radius:var(--kk-r); border:1px solid var(--kk-line-soft);
  background:linear-gradient(160deg, var(--kk-surface) 0%, var(--kk-stone) 100%); position:relative; overflow:hidden;}
.kk-campaign::before{content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--kk-gold);}
.kk-campaign-name{font-family:var(--kk-font-d); font-weight:700; font-size:25px; letter-spacing:.01em;}
.kk-campaign-meta{margin-top:4px; color:var(--kk-text-dim); font-size:13px; display:flex; gap:8px; align-items:center;}

.kk-party-label, .kk-skill-cat{font-family:var(--kk-font-b); text-transform:uppercase; letter-spacing:.16em; font-size:11px; color:var(--kk-text-faint); font-weight:600;}
.kk-party{display:grid; grid-template-columns:repeat(auto-fill,minmax(132px,1fr)); gap:10px;}
.kk-party-card{display:flex; flex-direction:column; align-items:center; gap:7px; padding:14px 10px;
  border:1px solid var(--kk-line-soft); border-radius:var(--kk-r); background:var(--kk-surface); transition:border-color .15s, transform .1s;}
.kk-party-card:hover{border-color:var(--fac-color); transform:translateY(-2px);}
.kk-party-card.self{border-color:var(--kk-gold-dim);}
.kk-party-av{width:50px; height:50px; border-radius:50%; display:grid; place-items:center;
  font-family:var(--kk-font-d); font-weight:600; font-size:22px; color:#1a140c;
  background:var(--fac-color); border:2px solid rgba(255,240,210,.14);}
.kk-party-name{font-size:13px; font-weight:600; text-align:center;}
.kk-party-you{font-size:10px; color:var(--kk-gold); letter-spacing:.08em; text-transform:uppercase;}

.kk-portal-nav{display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;}
.kk-big{display:flex; flex-direction:column; gap:3px; padding:16px; text-align:left;
  border:1px solid var(--kk-line-soft); border-radius:var(--kk-r); background:var(--kk-surface); transition:border-color .15s;}
.kk-big:not(:disabled):hover{border-color:var(--kk-gold);}
.kk-big-t{font-family:var(--kk-font-d); font-weight:600; font-size:16px;}
.kk-big-s{font-size:11px; color:var(--kk-text-faint);}
.kk-big.ghost{opacity:.5;} .kk-big:disabled{cursor:default;}

.kk-card{display:flex; flex-direction:column; gap:18px;}
.kk-head{display:flex; gap:16px; align-items:flex-start;}
.kk-portrait{width:88px; height:88px; flex:none; border-radius:var(--kk-r); overflow:hidden;
  background:var(--kk-stone); border:1px solid var(--kk-line);
  box-shadow:inset 0 0 0 2px var(--kk-bg), 0 0 0 1px var(--fac-color); display:grid; place-items:center;}
.kk-portrait img{width:100%; height:100%; object-fit:cover;}
.kk-portrait-ph{font-family:var(--kk-font-d); font-size:40px; color:var(--kk-text-faint);}
.kk-head-main{flex:1; min-width:0;}
.kk-name{font-family:var(--kk-font-d); font-weight:700; font-size:30px; letter-spacing:.01em; margin:0 0 3px;}
.kk-head-tags{display:flex; flex-wrap:wrap; align-items:center; gap:7px; font-size:13px; color:var(--kk-text-dim);}
.kk-fac{color:var(--fac-color); font-weight:600;}
.kk-sep{color:var(--kk-text-faint);}
.kk-head-econ{display:flex; gap:14px; margin-top:8px;}
.kk-econ{font-size:13px; color:var(--kk-gold-bright); font-weight:600;}

.kk-tabs{display:flex; gap:4px; border-bottom:1px solid var(--kk-line-soft); flex-wrap:wrap;}
.kk-tabs button{font-family:var(--kk-font-b); font-weight:600; letter-spacing:.02em; font-size:13px;
  padding:9px 13px; color:var(--kk-text-dim); border-bottom:2px solid transparent; margin-bottom:-1px;}
.kk-tabs button.on{color:var(--kk-text); border-bottom-color:var(--kk-gold);}
.kk-tabs button:not(:disabled):hover{color:var(--kk-text);}
.kk-tab-soon{opacity:.4; cursor:default !important;}
.kk-tab-soon em{font-style:normal; font-size:9px; color:var(--kk-text-faint); margin-left:4px;}

.kk-empty{padding:28px 18px; text-align:center; color:var(--kk-text-dim); font-size:14px;
  border:1px dashed var(--kk-line); border-radius:var(--kk-r); background:rgba(255,240,210,.01);}

.kk-strip{display:grid; grid-template-columns:repeat(auto-fit,minmax(122px,1fr)); gap:10px;}
.kk-stat{padding:11px 13px; border:1px solid var(--kk-line-soft); border-radius:var(--kk-r);
  background:var(--kk-surface); display:flex; flex-direction:column; gap:6px; --local-accent:var(--kk-text);}
.kk-stat-wide{grid-column:span 2;}
.kk-stat-label{font-family:var(--kk-font-b); font-weight:600; text-transform:uppercase; letter-spacing:.1em; font-size:11px; color:var(--kk-text-dim);}
.kk-stat-row{display:flex; align-items:center; gap:8px;}
.kk-stat-val{font-family:var(--kk-font-d); font-size:26px; font-weight:600; color:var(--local-accent); font-variant-numeric:tabular-nums;}
.kk-stat-max{font-size:15px; color:var(--kk-text-faint);}
.kk-init{font-family:var(--kk-font-b); font-weight:500; font-size:15px; color:var(--kk-text); padding-top:3px;}
.kk-step{width:27px; height:27px; flex:none; border-radius:6px; border:1px solid var(--kk-line);
  color:var(--kk-text-dim); font-size:17px; line-height:1; display:grid; place-items:center;}
.kk-step:hover{border-color:var(--kk-gold); color:var(--kk-gold);}

.kk-block{display:flex; flex-direction:column; gap:11px;}
.kk-h2{font-family:var(--kk-font-b); font-weight:600; text-transform:uppercase; letter-spacing:.1em; font-size:12px;
  color:var(--kk-text-dim); margin:0; padding-bottom:6px; border-bottom:1px solid var(--kk-line-soft);}

.kk-track{display:flex; flex-direction:column; gap:7px;}
.kk-track-head{display:flex; justify-content:space-between; align-items:baseline; gap:10px;}
.kk-track-name{font-weight:600; font-size:14px;}
.kk-track-meta{font-size:11px; color:var(--kk-text-faint);}
.kk-pips{display:flex; gap:11px; flex-wrap:wrap;}
.kk-pip{position:relative; display:flex; gap:4px; padding:6px; border-radius:9px;
  background:var(--kk-stone); border:1px solid var(--kk-line-soft);}
.kk-pip.started{border-color:var(--kk-gold-dim);}
.kk-pip.closed{border-color:var(--kk-gold);}
.kk-pip.ko{border-style:dashed;}
.kk-pip.ko.started{border-color:var(--kk-danger);}
.kk-cell{width:30px; height:36px; border-radius:6px; border:1px solid var(--kk-cell-line);
  background:var(--kk-cell-empty); box-shadow:inset 0 2px 5px rgba(0,0,0,.45); transition:background .12s, box-shadow .12s;}
.kk-cell.filled{background:var(--kk-cell-fill); border-color:var(--kk-gold-bright);
  box-shadow:inset 0 1px 2px rgba(255,235,190,.3), 0 0 8px rgba(200,161,78,.4);}
.kk-pip.ko .kk-cell.filled{background:var(--kk-danger); border-color:var(--kk-danger); box-shadow:0 0 9px rgba(189,90,58,.55);}
.kk-cell:hover{border-color:var(--kk-gold);}
.kk-pip-num{position:absolute; top:-8px; right:-5px; font-size:10px; color:var(--kk-text-faint);
  background:var(--kk-bg); padding:0 3px; border-radius:4px; font-family:var(--kk-font-d);}

.kk-attrs{display:grid; grid-template-columns:repeat(auto-fit,minmax(112px,1fr)); gap:9px;}
.kk-attr{display:flex; flex-direction:column; gap:3px; padding:11px 13px; border-radius:var(--kk-r);
  border:1px solid var(--kk-line-soft); background:var(--kk-surface); text-align:center;}
.kk-attr-name{font-size:12px; color:var(--kk-text-dim); font-weight:500;}
.kk-attr-die{font-family:var(--kk-font-d); font-size:23px; font-weight:600; color:var(--kk-gold-bright);}

.kk-skill-group{display:flex; flex-direction:column; gap:7px; margin-bottom:6px;}
.kk-skills{display:grid; grid-template-columns:repeat(auto-fill,minmax(192px,1fr)); gap:5px;}
.kk-skill{display:flex; align-items:center; gap:8px; padding:7px 11px; border-radius:var(--kk-r-sm);
  background:var(--kk-surface); border:1px solid var(--kk-line-soft);}
.kk-skill.untrained{opacity:.55;}
.kk-skill-name{flex:1; font-size:13px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.kk-skill-attr{font-size:10px; color:var(--kk-text-faint); text-transform:uppercase; letter-spacing:.06em; border-bottom:1px dotted var(--kk-text-faint);}
.kk-skill-die{font-family:var(--kk-font-d); font-size:16px; font-weight:600; color:var(--kk-gold-bright); min-width:44px; text-align:right;}
.kk-note{font-size:12px; color:var(--kk-text-faint); font-style:italic; margin:6px 0 0;}

@media (max-width:560px){
  .kk-portal-nav{grid-template-columns:1fr;}
  .kk-strip{grid-template-columns:1fr 1fr;}
  .kk-name{font-size:25px;}
  .kk-cell{width:26px; height:34px;}
}
`;
