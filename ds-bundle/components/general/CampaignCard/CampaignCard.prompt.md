CampaignCard from @kk9/asgard. Use via `window.Asgard.CampaignCard` (bundle loaded from the root `_ds_bundle.js`). Wrap the tree in `<Root>` (full provider chain in README.md — components read theme/i18n from that context).

## Props

```ts
interface CampaignCardProps {
  name: string;
  system?: string;
  playerCount?: number;
  isGM?: boolean;
  status?: string;
  onClick?: () => void;
}
```
