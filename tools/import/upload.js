#!/usr/bin/env node
// Upload a generated seed to Firestore via the Admin SDK (FEAT-20, TASK-106).
// Batched at ≤500 writes/batch; --dry-run prints the target paths without writing.
// The service-account key path comes from GOOGLE_APPLICATION_CREDENTIALS (env var)
// — NEVER commit the key.
//
//   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
//     node upload.js --campaign <campaignId> [--seed ./output/firestore-seed.json] [--dry-run]
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_BATCH = 500;

function parseArgs(argv) {
  const args = { seed: path.join(HERE, "output", "firestore-seed.json"), campaign: "", dryRun: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--seed") args.seed = argv[++i];
    else if (a === "--campaign") args.campaign = argv[++i];
  }
  return args;
}

const USAGE = `
KK9 seed uploader (FEAT-20)

Usage:
  GOOGLE_APPLICATION_CREDENTIALS=<key.json> \\
    node upload.js --campaign <campaignId> [--seed <file>] [--dry-run]

Options:
  --campaign <id>  Target campaign document id (required).
  --seed <file>    Seed JSON (default: ./output/firestore-seed.json).
  --dry-run        Print every target path; write nothing.
  -h, --help       Show this help.

Credentials: set GOOGLE_APPLICATION_CREDENTIALS to a service-account key path.
`;

// Build the flat list of { path, data } writes from the seed.
function buildWrites(seed, campaignId) {
  const writes = [];
  const root = `campaigns/${campaignId}`;
  for (const ch of seed.characters || []) {
    const { _id, _private, ...data } = ch;
    writes.push({ path: `${root}/characters/${_id}`, data });
    if (_private) writes.push({ path: `${root}/characters/${_id}/private/gm`, data: _private });
  }
  for (const it of seed.items || []) {
    const { _id, ...data } = it;
    writes.push({ path: `${root}/items/${_id}`, data });
  }
  for (const lib of seed.library || []) {
    const { _id, ...data } = lib;
    writes.push({ path: `${root}/library/${_id}`, data });
  }
  return writes;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { process.stdout.write(USAGE); return 0; }
  if (!args.campaign) { console.error("--campaign <campaignId> is required"); return 1; }

  const seed = JSON.parse(await readFile(args.seed, "utf8"));
  const writes = buildWrites(seed, args.campaign);
  console.log(`${writes.length} document write(s) → campaign "${args.campaign}"`);

  if (args.dryRun) {
    for (const w of writes) console.log(`  [dry-run] ${w.path}`);
    console.log("Dry run complete — nothing written.");
    return 0;
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("GOOGLE_APPLICATION_CREDENTIALS is not set — refusing to upload.");
    return 1;
  }

  // Lazy-import so --help / --dry-run work without firebase-admin installed.
  const { initializeApp, applicationDefault } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  let ok = 0, failed = 0;
  for (let i = 0; i < writes.length; i += MAX_BATCH) {
    const slice = writes.slice(i, i + MAX_BATCH);
    const batch = db.batch();
    for (const w of slice) batch.set(db.doc(w.path), w.data, { merge: true });
    try {
      await batch.commit();
      ok += slice.length;
      console.log(`Batch ${i / MAX_BATCH + 1}: committed ${slice.length} (total ${ok}/${writes.length})`);
    } catch (e) {
      failed += slice.length;
      console.error(`Batch ${i / MAX_BATCH + 1} FAILED: ${e.message} — continuing`);
    }
  }
  console.log(`Done. Committed ${ok}, failed ${failed}.`);
  return failed ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((e) => { console.error(e); process.exit(1); });
