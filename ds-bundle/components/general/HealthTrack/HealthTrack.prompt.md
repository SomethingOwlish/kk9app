HealthTrack from @kk9/asgard. Use via `window.Asgard.HealthTrack` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface HealthTrackProps {
  label: string;
  attrLabel: string;
  attrDie: 4 | 6 | 8 | 10 | 12 | 20;
  value: number;
  tipExtra?: string;
  onChange?: (v: number) => void;
}
```
