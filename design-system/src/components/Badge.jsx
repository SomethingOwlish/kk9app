export default function Badge({ children, variant = "gold" }) {
  const colors = {
    gold: { background: "var(--kk-gold)", color: "#1a140c" },
    dim: { background: "var(--kk-surface-2)", color: "var(--kk-text-dim)", border: "1px solid var(--kk-line-soft)" },
    danger: { background: "var(--kk-danger-dim)", color: "var(--kk-danger)" },
  };
  return (
    <span style={{
      display: "inline-block",
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: ".1em",
      padding: "2px 7px",
      borderRadius: "5px",
      ...colors[variant],
    }}>
      {children}
    </span>
  );
}
