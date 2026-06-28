export default function PartyRow({ name, faction, factionColor, portraitUrl, subtitle, vitals, actions }) {
  const initial = name?.[0] ?? "?";
  return (
    <div
      className="kk-party-row"
      style={{ "--fac-color": factionColor || "var(--kk-gold)" }}
    >
      <div className="kk-party-row-av">
        {portraitUrl
          ? <img src={portraitUrl} alt={name} />
          : initial}
      </div>
      <div className="kk-party-row-info">
        <span className="kk-party-row-name">{name}</span>
        {subtitle && <span className="kk-party-row-sub">{subtitle}</span>}
        {vitals && (
          <div className="kk-party-row-vitals">
            {vitals.map((v, i) => (
              <span key={i} className={v.tension ? "kk-vital-tension" : ""}>{v.label}: {v.value}</span>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="kk-party-row-acts">{actions}</div>}
    </div>
  );
}
