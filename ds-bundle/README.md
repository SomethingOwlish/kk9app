# Asgard (@kk9/asgard@1.0.0)

This design system is the published @kk9/asgard React library, bundled as a single
browser global. All 14 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.Asgard`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.Asgard.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Badge } = window.Asgard;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Badge />);
```

Wrap the tree in the provider — most components read theme/i18n from context:

```jsx
<Root>{children}</Root>
```

## Tokens

25 CSS custom properties from @kk9/asgard. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (7): `--kk-bg-2`, `--kk-surface`, `--kk-surface-2`, …
- **typography** (2): `--kk-font-d`, `--kk-font-b`
- **other** (16): `--kk-bg`, `--kk-stone`, `--kk-line`, …

## Components

### general
- `Badge`
- `Button`
- `CampaignCard`
- `EmptyState`
- `HealthTrack`
- `Input`
- `Modal`
- `PartyCard`
- `PartyRow`
- `Root`
- `SectionHeader`
- `Stat`
- `StatusBar`
- `Tip`
