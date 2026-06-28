Button from @kk9/asgard. Use via `window.Asgard.Button` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ButtonProps {
  children: React.ReactNode;
  variant?: "danger" | "primary" | "ghost";
  size?: "sm";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}
```
