# KK9 Import / Export Tool (FEAT-20)

Developer-only Node.js converter that turns **Foundry VTT KK9 actor exports** into a
**KK9 Firestore seed**. It is fully standalone — no Vite/React, no SPA dependency.

## Install

```bash
cd tools/import
npm install        # pulls firebase-admin (only needed for upload.js)
```

## Convert

Drop one Foundry actor export per file into `input/` (each is the JSON produced by
Foundry's *Export Data* on an actor — `{ name, type, system, items[] }`). A single
file containing an array of actors also works.

```bash
npm run convert                 # input ./input → output ./output
node convert.js --help          # usage
node convert.js --input ./exports --output ./out
```

Generated artifacts (in `output/`):

| File | Contents |
|---|---|
| `firestore-seed.json` | `characters[]` + `items[]` ready for `upload.js` |
| `uuid-map.json` | Foundry UUID / `_id` → deterministic Firestore id |
| `warnings.json` | unmapped fields, unresolved refs, skipped actors |
| `validation-errors.json` | written only when validation fails (exit 1) |

Mapping notes:
- `tension.*` is written on the **main** character doc (D-18); `health.will` is
  **excluded** (D-03).
- Every cross-reference (`artifact_refs[]`, `relations[].uuid`, `skill_bonuses[].item_uuid`,
  `status_uuid`, `contact_refs[]`, …) is rewritten to a Firestore id; unresolved
  references become `null` and are logged (Q2 Option A — warn + continue).
- IDs are **deterministic** (UUID-v5-style hash over a fixed namespace), so re-running
  the converter is idempotent and refs stay stable.
- Daemons are skipped (gated on D-09); companions are skipped (embedded on their owner
  in the current app). Both are recorded in `warnings.json`.

## Upload

```bash
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node upload.js --campaign <campaignId> --dry-run     # preview paths
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
  node upload.js --campaign <campaignId>               # real upload (≤500/batch)
```

The service-account key is read from `GOOGLE_APPLICATION_CREDENTIALS` and is **never
committed** (see `.gitignore`). `--dry-run` works without the key or `firebase-admin`.
