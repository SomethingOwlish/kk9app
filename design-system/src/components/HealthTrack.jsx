import Tip from "./Tip";

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
  const sizes = attrPipSizes(attrDie).map((s, i) => i === 4 ? 1 : s);
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
      started: filled > 0,
      closed: filled >= size,
      knockout: i === 4,
    };
  });
}

export default function HealthTrack({ label, attrLabel, attrDie, value, onChange, tipExtra }) {
  const { sizes, thresholds, maxValue } = computeHealthPips(attrDie);
  const states = buildPipStates(value, sizes, thresholds);
  const setVal = (v) => onChange && onChange(Math.max(0, Math.min(maxValue, v)));
  return (
    <div className="kk-track">
      <div className="kk-track-head">
        <Tip text={`${label}: ${value}/${maxValue}. ${tipExtra || ""}`}>
          <span className="kk-track-name kk-dotted">{label}</span>
        </Tip>
        <span className="kk-track-meta">{value}/{maxValue} · {attrLabel} d{attrDie}</span>
      </div>
      <div className="kk-pips">{states.map(p => {
        let ci = p.lo;
        return (
          <div key={p.pip} className={`kk-pip ${p.knockout ? "ko" : ""} ${p.started ? "started" : ""} ${p.closed ? "closed" : ""}`}>
            {p.cells.map((c, k) => {
              const abs = ++ci;
              return (
                <button key={k} className={`kk-cell ${c.filled ? "filled" : ""}`}
                  onClick={() => setVal(value === abs ? abs - 1 : abs)}
                  aria-label={`${label} ${abs}`}/>
              );
            })}
            <span className="kk-pip-num">{p.pip}</span>
          </div>
        );
      })}</div>
    </div>
  );
}
