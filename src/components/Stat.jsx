import Tip from "./Tip";

export default function Stat({ label, value, onChange, max, tip, accent }) {
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
