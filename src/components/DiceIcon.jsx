// Inline SVG d20-style die icon — replaces the 🎲 emoji on roll buttons.
export default function DiceIcon({ size = 16, className }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5 21 7.25v9.5L12 21.5 3 16.75v-9.5z" />
      <path d="M12 2.5 12 9 21 7.25M12 9 3 7.25M12 9v12.5M12 9l5 2.5 4-4.25M12 9l-5 2.5-4-4.25M7 11.5 12 21.5 17 11.5M7 11.5 3 16.75M17 11.5 21 16.75" />
    </svg>
  );
}
