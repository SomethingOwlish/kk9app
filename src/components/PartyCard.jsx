import { deriveEnergyMax, deriveStatusMaxMods } from "../lib/derive";

// FEAT-18 — condensed, read-only party member card for the landing page.
// Health pip max mirrors HealthTrack's attr-die scaling. Tension is NOT shown
// here (GM-only mechanic, see IMP-01), and energy max is the raw maximum.
function healthMax(die) {
  switch (die) {
    case 20: return 9;
    case 12: return 8;
    case 10: return 7;
    case 8:  return 6;
    default: return 5;
  }
}

export default function PartyCard({ ch, onOpen }) {
  const fac = ch.faculty || {};
  const color = fac.color || "#c8a14e";
  // Raw max + status energy.mode=max mods; tension penalty stays hidden here (IMP-01).
  const energyMax = Math.max(0, (ch.energy?.max ?? deriveEnergyMax(ch)) + deriveStatusMaxMods(ch).energyMaxMod);
  const energyVal = ch.energy?.value ?? 0;
  const energyPct = energyMax > 0 ? Math.max(0, Math.min(100, (energyVal / energyMax) * 100)) : 0;
  const physMax = healthMax(ch.attributes?.endurance?.die ?? 4);
  const physVal = ch.health?.physical?.value ?? 0;
  const mentMax = healthMax(ch.attributes?.spirit?.die ?? 4);
  const mentVal = ch.health?.mental?.value ?? 0;
  const clickable = typeof onOpen === "function";

  return (
    <div
      className={`kk-pcard${clickable ? " kk-pcard--clickable" : ""}`}
      style={{ "--fac-color": color }}
      onClick={clickable ? onOpen : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
    >
      <div className="kk-party-card-portrait">
        {ch.portrait
          ? <img src={ch.portrait} alt=""/>
          : <span className="kk-party-card-ph">{(ch.name || "?").slice(0, 1)}</span>}
      </div>
      <div className="kk-party-card-body">
        <div className="kk-party-card-name">{ch.name}</div>
        {fac.name && <div className="kk-party-card-fac">{fac.name}</div>}
        <div className="kk-party-card-stats">
          <div className="kk-party-stat">
            <span className="kk-party-stat-label">❤ Физ.</span>
            <span className="kk-party-stat-val">{physVal} / {physMax}</span>
          </div>
          <div className="kk-party-stat">
            <span className="kk-party-stat-label">✦ Мент.</span>
            <span className="kk-party-stat-val">{mentVal} / {mentMax}</span>
          </div>
        </div>
        <div className="kk-party-energy">
          <div className="kk-party-energy-head">
            <span>Энергия</span><span>{energyVal} / {energyMax}</span>
          </div>
          <div className="kk-party-energy-bar"><span style={{ width: `${energyPct}%` }}/></div>
        </div>
      </div>
    </div>
  );
}
