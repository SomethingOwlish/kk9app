#!/usr/bin/env node
// KK9 Foundry → Firestore converter (FEAT-20, TASK-101..107).
// Standalone Node.js — NO Vite/React. Reads individual Foundry actor JSON exports
// from an input directory and emits a Firestore seed plus diagnostic sidecars.
//
//   npm run convert            # input ./input → output ./output
//   node convert.js --help
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapCharacter } from "./lib/mapCharacter.js";
import { mapItem, COLLECTION_ITEM_TYPES, KNOWN_ITEM_TYPES } from "./lib/mapItem.js";
import { mapActorNonCharacter } from "./lib/mapNpc.js";
import { UuidMap } from "./lib/uuidMap.js";
import { validateSeed } from "./lib/validate.js";
import { str } from "./lib/util.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { input: path.join(HERE, "input"), output: path.join(HERE, "output"), help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--input") args.input = argv[++i];
    else if (a === "--output") args.output = argv[++i];
  }
  return args;
}

const USAGE = `
KK9 Foundry → Firestore converter (FEAT-20)

Usage:
  node convert.js [--input <dir>] [--output <dir>]

Options:
  --input  <dir>   Directory of Foundry actor JSON exports (default: ./input)
                   Each file is one actor export ({name,type,system,items[]}),
                   or a single file containing an array of such actors.
  --output <dir>   Directory for generated artifacts (default: ./output)
  -h, --help       Show this help.

Outputs (in --output):
  firestore-seed.json     characters[] + items[] ready for upload.js
  uuid-map.json           Foundry UUID/_id → Firestore id map
  warnings.json           unmapped fields, unresolved refs, skipped actors
  validation-errors.json  written only when validation fails (exit code 1)

Exit codes: 0 = clean, 1 = validation errors (or no input found).
`;

// Accept either an array of actors or a single actor object per file.
function actorsFromFile(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object" && (json.system || json.type)) return [json];
  return [];
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { process.stdout.write(USAGE); return 0; }

  let files;
  try {
    files = (await readdir(args.input)).filter((f) => f.toLowerCase().endsWith(".json"));
  } catch {
    console.error(`Input directory not found: ${args.input}`);
    return 1;
  }
  if (files.length === 0) { console.error(`No .json actor exports in ${args.input}`); return 1; }

  const actors = [];
  for (const f of files) {
    try {
      const json = JSON.parse(await readFile(path.join(args.input, f), "utf8"));
      for (const a of actorsFromFile(json)) actors.push({ a, file: f });
    } catch (e) { console.error(`Skipping ${f}: ${e.message}`); }
  }

  const map = new UuidMap();
  const warnings = [];
  const abilityIndex = new Map(); // ability id → {name, attr, categ}

  // ── Pass 1 — assign ids to every actor + embedded item; index abilities ──
  for (const { a } of actors) {
    const actorKey = a._id ? `Actor.${a._id}` : `Actor.${str(a.name)}`;
    map.assign(a._id || actorKey, { uuid: actorKey });
    for (const it of a.items || []) {
      const fid = map.assign(it._id, { actorId: a._id, uuid: it._id });
      if (it.type === "ability") {
        const s = it.system || {};
        const meta = { name: str(it.name), attr: str(s.linkedAttribute, "smarts"), categ: str(s.category, "learned") };
        abilityIndex.set(it._id, meta);
        abilityIndex.set(fid, meta);
      }
    }
  }

  // ── Pass 2 — map docs; cross-refs resolve against the now-complete map ──
  const characters = [];
  const items = [];
  let skipped = 0;

  for (const { a } of actors) {
    const actorId = map.resolve(a._id, "actor", a.name);
    if (a.type === "character") {
      const { doc, gmNotes } = mapCharacter(a, map, abilityIndex, warnings);
      characters.push({ _id: actorId, ...doc, ...(gmNotes ? { _private: { gmNotes } } : {}) });
    } else {
      const res = mapActorNonCharacter(a, map, warnings);
      if (res.doc) characters.push({ _id: actorId, ...res.doc });
      else skipped++;
    }
    // Embedded items → collection docs (only collection-bearing types).
    for (const it of a.items || []) {
      if (!KNOWN_ITEM_TYPES.has(it.type)) { warnings.push({ kind: "unknown-item-type", owner: a.name, type: it.type }); continue; }
      if (!COLLECTION_ITEM_TYPES.has(it.type)) continue; // ability/faculty/status/contact/language handled elsewhere
      const itemId = map.resolve(it._id, "item", it.name);
      items.push({ _id: itemId, ...mapItem(it, actorId, map) });
    }
  }

  const seed = { characters, items };
  map.warnings.forEach((w) => warnings.push(w));

  // ── Validation (TASK-105) ──
  const errors = validateSeed(seed);

  await mkdir(args.output, { recursive: true });
  await writeFile(path.join(args.output, "firestore-seed.json"), JSON.stringify(seed, null, 2));
  await writeFile(path.join(args.output, "uuid-map.json"), JSON.stringify(map.toJSON(), null, 2));
  await writeFile(path.join(args.output, "warnings.json"), JSON.stringify(warnings, null, 2));

  console.log(`Actors: ${actors.length}  Characters/NPCs: ${characters.length}  Items: ${items.length}  Skipped: ${skipped}`);
  console.log(`Warnings: ${warnings.length}  (see output/warnings.json)`);

  if (errors.length) {
    await writeFile(path.join(args.output, "validation-errors.json"), JSON.stringify(errors, null, 2));
    console.error(`Validation FAILED: ${errors.length} error(s) → output/validation-errors.json`);
    return 1;
  }
  console.log("Validation OK → output/firestore-seed.json");
  return 0;
}

main().then((code) => process.exit(code)).catch((e) => { console.error(e); process.exit(1); });
