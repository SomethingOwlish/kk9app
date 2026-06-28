SectionHeader from @kk9/asgard. Use via `window.Asgard.SectionHeader` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
}
```
