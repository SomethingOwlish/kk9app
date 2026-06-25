export default function LandingPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#181410",
      color: "#ece2cf",
      fontFamily: "'Golos Text', system-ui, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "12px",
      padding: "40px",
    }}>
      <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#c8a14e", margin: 0 }}>
        КК<span style={{ color: "#e2c178" }}>9</span> — Лендинг
      </h1>
      <p style={{ color: "#a8967a", margin: 0 }}>Страница живого сеанса. Будет реализована в B-20.</p>
    </div>
  );
}
