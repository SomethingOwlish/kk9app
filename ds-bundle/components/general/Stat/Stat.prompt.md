Stat from @kk9/asgard. Use via `window.Asgard.Stat` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface StatProps {
  label: string;
  value: number;
  max?: number;
  tip?: React.ReactNode;
  accent?: string;
  onChange?: (v: number) => void;
}
```
