# Asgard Design System — Conventions

## Visual Language
Dark fantasy TTRPG campaign tracker. Parchment-on-ember palette, serif headings, tactile pip-based health tracks.

## Tokens (CSS custom properties on `.kk-root` / `:root`)
| Token | Value | Use |
|---|---|---|
| `--kk-bg` | `#181410` | Page background |
| `--kk-stone` | `#241d15` | Elevated surface, drawer |
| `--kk-surface` | `#2a2218` | Card backgrounds |
| `--kk-surface-2` | `#32281b` | Nested surface, active states |
| `--kk-line` | `#48391f` | Borders |
| `--kk-text` | `#ece2cf` | Primary text |
| `--kk-text-dim` | `#a8967a` | Secondary text |
| `--kk-text-faint` | `#7a6a52` | Placeholder, meta |
| `--kk-gold` | `#c8a14e` | Primary accent, CTA |
| `--kk-gold-bright` | `#e2c178` | Hover accent |
| `--kk-gold-dim` | `#8a6c33` | Inactive accent, borders |
| `--kk-danger` | `#bd5a3a` | Errors, destructive |
| `--kk-tension` | `#9b59b6` | Tension/stress stat |
| `--kk-r` | `10px` | Standard border-radius |
| `--kk-r-sm` | `7px` | Small border-radius |
| `--kk-font-d` | Playfair Display | Display / heading font |
| `--kk-font-b` | Golos Text | Body font |
| `--fac-color` | (per character) | Faculty/faction accent color |

## Typography
- **Headings** (`.kk-name`, `.kk-campaign-name`, modal titles): `font-family: var(--kk-font-d)` (Playfair Display), weight 700
- **Labels** (`.kk-stat-label`, `.kk-h2`): Golos Text, uppercase, `letter-spacing: .1em`, `font-size: 11-12px`
- **Body**: Golos Text 400/500, `font-size: 13-15px`, `line-height: 1.45`

## Component Patterns
- **Cards** (`kk-party-card`, `kk-campaign`, `kk-stat`): `background: var(--kk-surface)`, `border: 1px solid var(--kk-line-soft)`, `border-radius: var(--kk-r)`
- **CTAs**: `background: var(--kk-gold)`, `color: #1a140c` (dark on gold)
- **Ghost buttons**: `border: 1px solid var(--kk-line)`, hover → gold border
- **Danger**: `border: 1px solid var(--kk-danger-dim)`, `color: var(--kk-danger)`
- **Section headers** (`.kk-h2`): uppercase, `letter-spacing: .1em`, gold separator line on bottom

## Layout
- Max content width: `760px`, centered
- Grid gaps: `10px` (cards), `18px` (sections)
- Party card grid: `repeat(auto-fill, minmax(132px, 1fr))`
- Attribute grid: `repeat(auto-fit, minmax(112px, 1fr))`
- Stat strip: `repeat(auto-fit, minmax(122px, 1fr))`

## The `Root` Component
Wrap all previews with `<Root>` — it applies `.kk-root` which sets the background, fonts, and all token variables.

## Faction Colors (`--fac-color`)
Each character has a faculty color that flows through `--fac-color`. Default is `--kk-gold`. Used for avatar backgrounds, card accent borders, and left-border strips on party rows.
