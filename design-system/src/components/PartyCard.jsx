export default function PartyCard({ name, faction, factionColor, portraitUrl, subtitle, isSelf, onClick, disabled }) {
  const initial = name?.[0] ?? "?";
  return (
    <button
      className={["kk-party-card", isSelf ? "self" : ""].filter(Boolean).join(" ")}
      style={{ "--fac-color": factionColor || "var(--kk-gold)" }}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="kk-party-av">
        {portraitUrl
          ? <img src={portraitUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          : initial}
      </div>
      <span className="kk-party-name">{name}</span>
      {isSelf && <span className="kk-party-you">You</span>}
      {subtitle && <span className="kk-party-sub">{subtitle}</span>}
    </button>
  );
}
