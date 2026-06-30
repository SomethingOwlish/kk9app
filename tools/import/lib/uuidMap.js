// UUID → Firestore ID map (FEAT-20, TASK-104).
// Every actor and embedded item gets a deterministic Firestore ID. Cross-refs are
// rewritten in a second pass; anything that cannot be resolved becomes null and is
// recorded as a warning (Q2 Option A — warn + continue).
import { deterministicId, tailId } from "./util.js";

export class UuidMap {
  constructor() {
    this.map = new Map();      // every known key (raw id + full uuid forms) → firestoreId
    this.warnings = [];        // { kind: "unresolved-ref", field, uuid, owner }
  }

  // Register a document under all the keys it may be referenced by.
  register(firestoreId, { id, uuid, actorId } = {}) {
    if (id) this.map.set(id, firestoreId);
    if (uuid) this.map.set(uuid, firestoreId);
    // Embedded item: also reachable as "Actor.<actorId>.Item.<id>".
    if (actorId && id) this.map.set(`Actor.${actorId}.Item.${id}`, firestoreId);
    return firestoreId;
  }

  // Assign (idempotently) a deterministic id for a key and register it.
  assign(key, extra = {}) {
    const fid = deterministicId(key);
    this.register(fid, { id: key, ...extra });
    return fid;
  }

  // Resolve a reference UUID to a Firestore id, or null (+ warning) when unknown.
  resolve(uuid, field = "?", owner = "?") {
    if (!uuid) return null;
    const direct = this.map.get(uuid);
    if (direct) return direct;
    const tail = tailId(uuid);
    if (tail && this.map.has(tail)) return this.map.get(tail);
    this.warnings.push({ kind: "unresolved-ref", field, uuid, owner });
    return null;
  }

  resolveArray(arr, field, owner) {
    return (arr || []).map((u) => this.resolve(u, field, owner)).filter(Boolean);
  }

  toJSON() {
    return Object.fromEntries(this.map);
  }
}
