export default function Button({ children, variant = "primary", size, onClick, disabled, type = "button" }) {
  const cls = ["kk-btn", variant, size === "sm" ? "sm" : ""].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
