Tip from @kk9/asgard. Use via `window.Asgard.Tip` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface TipProps {
  text?: React.ReactNode;
  label?: string;
  children: React.ReactNode;
}
```
