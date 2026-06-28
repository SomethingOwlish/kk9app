Modal from @kk9/asgard. Use via `window.Asgard.Modal` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface ModalProps {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}
```
