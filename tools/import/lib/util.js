// Shared helpers for the KK9 Foundry→Firestore converter (FEAT-20).
import { createHash } from "node:crypto";

// Strip Foundry HTML to plain text (biography fields are HTMLField).
export function stripHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const num = (v, dflt = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
};
export const str = (v, dflt = "") => (v == null ? dflt : String(v));
export const bool = (v) => v === true || v === "true";

// Deterministic Firestore-style ID from a stable Foundry key (UUID v5 over a
// fixed namespace → 20-char base36). Same input always yields the same id, so
// re-running the converter is idempotent and cross-refs stay stable.
const NAMESPACE = "kk9-foundry-import";
export function deterministicId(key) {
  const h = createHash("sha1").update(`${NAMESPACE}:${key}`).digest();
  let out = "";
  for (let i = 0; i < 14; i++) out += ALPHABET[h[i] % ALPHABET.length];
  return out;
}
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Normalise any Foundry UUID form to the trailing document id.
//   "Actor.abc"                 → "abc"
//   "Actor.abc.Item.def"        → "def"   (embedded item — last segment)
//   "Compendium.kk9.pack.ghi"   → "ghi"
//   "ghi"                       → "ghi"
export function tailId(uuid) {
  if (!uuid) return null;
  const parts = String(uuid).split(".");
  return parts[parts.length - 1] || null;
}
