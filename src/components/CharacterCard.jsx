import Tip from "./Tip";
import Stat from "./Stat";
import HealthTrack from "./HealthTrack";
import { derivePhysicalToughness, deriveEnergyMax } from "../lib/derive";
import { ATTR_ORDER, ATTR_LABEL, ATTR_SHORT, CAT_ORDER, CAT_LABEL, dieStr } from "../lib/constants";

export default function CharacterCard({ ch, save, isGM, canAdv, onEdit, onAdvance, onLog }) {
  const toughness = derivePhysicalToughness(ch);
  const energyMax = deriveEnergyMax(ch);
  const im = ch.attributes.agility.modifier + ch.attributes.smarts.modifier;
  const initStr = `d${ch.attributes.agility.die} · d${ch.attributes.smarts.die} · d6 → 2 лучших${im ? (im > 0 ? ` +${im}` : ` ${im}`) : ""}`;
  const grouped = CAT_ORDER.map(cat => ({ cat, items: (ch.skills || []).filter(s => s.categ === cat) })).filter(g => g.items.length);
  const fac = ch.faculty || {};

  return (
    <div className="kk-card">
      <header className="kk-head">
        <div className="kk-portrait" style={{ ["--fac-color"]: fac.color || "#c8a14e" }}>
          {ch.portrait ? <img src={ch.portrait} alt=""/> : <span className="kk-portrait-ph">{(ch.name || "?").slice(0, 1)}</span>}
        </div>
        <div className="kk-head-main">
          <h1 className="kk-name">{ch.name}</h1>
          <div className="kk-head-tags">
            {fac.name && <><span className="kk-fac" style={{ ["--fac-color"]: fac.color || "#c8a14e" }}>{fac.name}</span><span className="kk-sep">·</span></>}
            <span>{ch.academyYear} курс, {ch.semester} семестр</span><span className="kk-sep">·</span><span>{ch.age} лет</span>
          </div>
          <div className="kk-head-econ">
            <span className="kk-econ">◈ {ch.money}</span>
            <span className="kk-econ">✦ {ch.experience} опыта</span>
          </div>
        </div>
        <div className="kk-head-actions">
          {!isGM && canAdv && <button className="kk-adv-btn" onClick={onAdvance}>Прокачка</button>}
          {isGM && <button className="kk-edit-btn" onClick={onEdit}>Редактировать вручную</button>}
          {isGM && <button className="kk-edit-btn" onClick={onLog}>Логи</button>}
        </div>
      </header>

      <section className="kk-strip">
        <Stat label="Стойкость" value={toughness} tip="2 + ⌊Дух/2⌋. Считается автоматически." accent="var(--kk-gold)"/>
        <div className="kk-stat kk-stat-wide">
          <Tip text="Пул инициативы: Ловкость + Смекалка + Wild Die d6, 2 лучших. Бросок — вне карточки.">
            <span className="kk-stat-label kk-dotted">Инициатива</span>
          </Tip>
          <span className="kk-init">{initStr}</span>
        </div>
        <Stat label="Энергия" value={ch.energy.value} max={energyMax}
          onChange={(v) => save({ "energy.value": Math.max(0, Math.min(energyMax, v)) })}
          tip="Максимум = возраст + грань Духа." accent="var(--kk-gold)"/>
        <Stat label="Жетоны судьбы" value={ch.bennies} max={9}
          onChange={isGM ? (v) => save({ bennies: Math.max(0, Math.min(9, v)) }) : undefined}
          tip={isGM ? "Старт 3, максимум 9. Выдаёт/снимает ГМ." : "Старт 3, максимум 9. Меняет только ГМ."}
          accent="var(--kk-gold)"/>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Здоровье</h2>
        <HealthTrack label="Физическое" attrLabel="Выносливости" attrDie={ch.attributes.endurance.die}
          value={ch.health.physical.value} onChange={(v) => save({ "health.physical.value": v })}
          tipExtra="Растёт от Выносливости."/>
        <HealthTrack label="Ментальное" attrLabel="Духа" attrDie={ch.attributes.spirit.die}
          value={ch.health.mental.value} onChange={(v) => save({ "health.mental.value": v })}
          tipExtra="Растёт от Духа."/>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Атрибуты</h2>
        <div className="kk-attrs">{ATTR_ORDER.map(k => {
          const a = ch.attributes[k];
          return (
            <div className="kk-attr" key={k}>
              <span className="kk-attr-name">{ATTR_LABEL[k]}</span>
              <span className="kk-attr-die">{dieStr(a.die, a.modifier)}</span>
            </div>
          );
        })}</div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Навыки</h2>
        {grouped.map(g => (
          <div className="kk-skill-group" key={g.cat}>
            <div className="kk-skill-cat">{CAT_LABEL[g.cat]}</div>
            <div className="kk-skills">{g.items.map(s => {
              const unt = s.die === 4 && s.modifier <= -2;
              return (
                <div className={`kk-skill ${unt ? "untrained" : ""}`} key={s.name}>
                  <span className="kk-skill-name">{s.name}</span>
                  <Tip text={`Связан с: ${ATTR_LABEL[s.attr]}. Бросок — вне карточки. Не выше атрибута.`}>
                    <span className="kk-skill-attr">{ATTR_SHORT[s.attr]}</span>
                  </Tip>
                  <span className="kk-skill-die">{dieStr(s.die, s.modifier)}</span>
                </div>
              );
            })}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
