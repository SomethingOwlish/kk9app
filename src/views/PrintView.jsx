import { useParams } from "react-router-dom";

export default function PrintView() {
  const { charId } = useParams();
  return (
    <div style={{
      minHeight: "100vh",
      background: "#fff",
      color: "#1a1a1a",
      fontFamily: "serif",
      padding: "40px",
    }}>
      <h1>Карточка персонажа</h1>
      <p>ID персонажа: <code>{charId}</code></p>
      <p>Страница печати будет реализована в B-23.</p>
    </div>
  );
}
