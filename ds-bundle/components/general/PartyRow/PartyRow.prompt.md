PartyRow from @kk9/asgard. Use via `window.Asgard.PartyRow` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface PartyRowProps {
  name: string;
  faction?: string;
  factionColor?: string;
  portraitUrl?: string;
  subtitle?: string;
  vitals?: Vital[];
  actions?: React.ReactNode;
}
```
