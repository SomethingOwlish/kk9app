export default function Input({ value, onChange, placeholder, size, type = "text", ...rest }) {
  return (
    <input
      type={type}
      className={["kk-input", size === "sm" ? "sm" : ""].filter(Boolean).join(" ")}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      {...rest}
    />
  );
}
