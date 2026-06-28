StatusBar from @kk9/asgard. Use via `window.Asgard.StatusBar` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface StatusBarProps {
  statuses?: StatusEntry[];
  isGM?: boolean;
  onRemove?: (s: StatusEntry) => void;
  onAdd?: () => void;
  onView?: (s: StatusEntry) => void;
}
```
