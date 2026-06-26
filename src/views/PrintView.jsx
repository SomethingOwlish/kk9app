import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { watchAuth } from "../lib/auth";
import { CAMPAIGN_ID } from "../lib/config";
import { ATTR_ORDER, ATTR_LABEL, ATTR_SHORT, CAT_ORDER, CAT_LABEL, dieStr } from "../lib/constants";
import { derivePhysicalToughness, deriveEnergyMax } from "../lib/derive";
import "../styles/print.css";

function attrPipSizes(die) {
  switch (die) {
    case 20: return [2, 2, 2, 2, 1];
    case 12: return [1, 2, 2, 2, 1];
    case 10: return [1, 1, 2, 2, 1];
    case 8:  return [1, 1, 1, 2, 1];
    default: return [1, 1, 1, 1, 1];
  }
}

function StaticPipTrack({ label, attrLabel, attrDie, value }) {
  const rawSizes = attrPipSizes(attrDie);
  const sizes = rawSizes.map((s, i) => (i === 4 ? 1 : s));
  const thresholds = [0];
  for (let i = 0; i < 4; i++) thresholds.push(thresholds[i] + sizes[i]);
  const maxValue = sizes.reduce((a, b) => a + b, 0);
  const states = sizes.map((size, i) => {
    const lo = thresholds[i];
    const filled = Math.max(0, Math.min(size, value - lo));
    return {
      pip: i + 1,
      cells: Array.from({ length: size }, (_, c) => ({ filled: c < filled })),
      knockout: i === 4,
    };
  });
  return (
    <div className="pr-track">
      <div className="pr-track-head">
        <span className="pr-track-name">{label}</span>
        <span className="pr-track-meta">{value}/{maxValue} · от {attrLabel} d{attrDie}</span>
      </div>
      <div className="pr-pips">
        {states.map(p => (
          <div key={p.pip} className={`pr-pip${p.knockout ? " ko" : ""}`}>
            <div className="pr-pip-cells">
              {p.cells.map((c, k) => (
                <span key={k} className={`pr-cell${c.filled ? " filled" : ""}`}/>
              ))}
            </div>
            <span className="pr-pip-num">{p.pip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DEMO_FIELDS = [
  ["gender", "Пол"],
  ["birthplace", "Место рождения"],
  ["dormitory", "Общежитие"],
  ["height", "Рост"],
  ["build", "Телосложение"],
  ["allergies", "Аллергии"],
  ["weaknesses", "Слабости"],
];

export default function PrintView() {
  const { charId } = useParams();
  const [authUser, setAuthUser] = useState(undefined);
  const [ch, setCh] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => watchAuth(setAuthUser), []);

  useEffect(() => {
    if (authUser === undefined) return;

    let cancelled = false;
    async function load() {
      if (!authUser) { if (!cancelled) setStatus("unauthenticated"); return; }
      try {
        const [campSnap, charSnap] = await Promise.all([
          getDoc(doc(db, "campaigns", CAMPAIGN_ID)),
          getDoc(doc(db, "campaigns", CAMPAIGN_ID, "characters", charId)),
        ]);
        if (cancelled) return;
        if (!campSnap.exists() || !charSnap.exists()) { setStatus("notfound"); return; }

        const campRole = campSnap.data().members?.[authUser.uid];
        if (!campRole) { setStatus("denied"); return; }

        const charData = { id: charSnap.id, ...charSnap.data() };
        const isGM = campRole === "gm" || campRole === "admin";
        if (!isGM && charData.ownerUid !== authUser.uid) { setStatus("denied"); return; }

        setCh(charData);
        setStatus("ok");
      } catch (e) {
        if (!cancelled) { console.error(e); setStatus("notfound"); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [authUser, charId]);

  if (status === "loading")        return <div className="pr-msg">Загрузка…</div>;
  if (status === "unauthenticated") return <div className="pr-msg">Войдите в систему для просмотра карточки персонажа.</div>;
  if (status === "denied")          return <div className="pr-msg">Нет доступа к этой карточке персонажа.</div>;
  if (status === "notfound")        return <div className="pr-msg">Персонаж не найден.</div>;

  const fac = ch.faculty || {};
  const toughness = ch.health?.physical?.toughness ?? derivePhysicalToughness(ch);
  const energyMaxRaw = ch.energy?.max ?? deriveEnergyMax(ch);
  const tension = ch.tension || { current: 0, overcap: 0, energyPenalty: 0, max: 0 };
  const energyMax = Math.max(0, energyMaxRaw - (tension.energyPenalty ?? 0));
  const overflow = ch.overflow_damage ?? 0;
  const grouped = CAT_ORDER
    .map(cat => ({ cat, items: (ch.skills || []).filter(s => s.categ === cat) }))
    .filter(g => g.items.length);
  const demoFields = DEMO_FIELDS.filter(([k]) => ch[k]);
  // Handle notes as either pre-B24 string or B24+ array
  const notesArr = Array.isArray(ch.notes) ? ch.notes : [];
  const notesStr = typeof ch.notes === "string" ? ch.notes : "";
  const hasNotes = notesArr.length > 0 || notesStr.length > 0;

  return (
    <div className="pr-sheet" style={{ "--fac-color": fac.color || "#c8a14e" }}>
      <div className="pr-actions">
        <button className="pr-print-btn" onClick={() => window.print()}>Распечатать</button>
      </div>

      <header className="pr-head">
        {ch.portrait && <img className="pr-portrait" src={ch.portrait} alt={ch.name}/>}
        <div className="pr-head-main">
          <h1 className="pr-name">{ch.name}</h1>
          <div className="pr-tags">
            {fac.name && <span className="pr-fac-badge">{fac.name}</span>}
            <span>{ch.academyYear} курс · {ch.semester} сем. · {ch.age} лет</span>
          </div>
          <div className="pr-econ">
            <span>◈ {ch.money} монет</span>
            <span>✦ {ch.experience} опыта</span>
            <span>Жетоны: {ch.bennies}</span>
          </div>
        </div>
        <div className="pr-logo">КК<span>9</span></div>
      </header>

      <div className="pr-resources">
        <div className="pr-res-item">
          <span className="pr-res-label">Стойкость</span>
          <span className="pr-res-val">{toughness}</span>
        </div>
        <div className="pr-res-item">
          <span className="pr-res-label">Энергия</span>
          <span className="pr-res-val">{ch.energy?.value ?? 0} / {energyMax}</span>
        </div>
        <div className="pr-res-item">
          <span className="pr-res-label">Напряжение</span>
          <span className="pr-res-val">{tension.current} / {tension.max}</span>
        </div>
        {overflow > 0 && (
          <div className="pr-res-item">
            <span className="pr-res-label">Переполнение</span>
            <span className="pr-res-val pr-res-danger">{overflow}</span>
          </div>
        )}
        {tension.overcap > 0 && (
          <div className="pr-res-item">
            <span className="pr-res-label">Перегруз напр.</span>
            <span className="pr-res-val pr-res-danger">{tension.overcap}</span>
          </div>
        )}
      </div>

      <section className="pr-section">
        <h2 className="pr-h2">Здоровье</h2>
        <StaticPipTrack
          label="Физическое"
          attrLabel="Выносливость"
          attrDie={ch.attributes.endurance.die}
          value={ch.health.physical.value}
        />
        <StaticPipTrack
          label="Ментальное"
          attrLabel="Дух"
          attrDie={ch.attributes.spirit.die}
          value={ch.health.mental.value}
        />
      </section>

      <section className="pr-section">
        <h2 className="pr-h2">Атрибуты</h2>
        <div className="pr-attrs">
          {ATTR_ORDER.map(k => {
            const a = ch.attributes[k];
            return (
              <div className="pr-attr" key={k}>
                <span className="pr-attr-name">{ATTR_LABEL[k]}</span>
                <span className="pr-attr-die">{dieStr(a.die, a.modifier)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pr-section">
        <h2 className="pr-h2">Навыки</h2>
        {grouped.map(g => (
          <div className="pr-skill-group" key={g.cat}>
            <div className="pr-skill-cat">{CAT_LABEL[g.cat]}</div>
            <div className="pr-skills">
              {g.items.map(s => {
                const unt = s.die === 4 && s.modifier <= -2;
                return (
                  <div className={`pr-skill${unt ? " pr-unt" : ""}`} key={s.name}>
                    <span className="pr-skill-name">{s.name}</span>
                    <span className="pr-skill-attr">{ATTR_SHORT[s.attr]}</span>
                    <span className="pr-skill-die">{dieStr(s.die, s.modifier)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {(demoFields.length > 0 || ch.biography) && (
        <section className="pr-section">
          <h2 className="pr-h2">Анкета</h2>
          {demoFields.length > 0 && (
            <div className="pr-demo-grid">
              {demoFields.map(([k, label]) => (
                <div className="pr-demo-field" key={k}>
                  <span className="pr-demo-label">{label}</span>
                  <span className="pr-demo-val">{ch[k]}</span>
                </div>
              ))}
            </div>
          )}
          {ch.biography && <p className="pr-bio">{ch.biography}</p>}
        </section>
      )}

      {hasNotes && (
        <section className="pr-section">
          <h2 className="pr-h2">Заметки</h2>
          {notesStr && <p className="pr-bio">{notesStr}</p>}
          {notesArr.length > 0 && (
            <ul className="pr-notes-list">
              {notesArr.map((n, i) => (
                <li key={i} className="pr-note-item">
                  {n.at && (
                    <span className="pr-note-date">
                      {new Date(n.at).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
