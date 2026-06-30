// Grouping helpers for the shop lists (kept separate from the Group component so
// Fast Refresh stays happy — component files must export only components).

// Stable display order; unknown types fall to the end alphabetically.
export const TYPE_ORDER = ["weapon", "gear", "artifact", "spell", "device", "vehicle", "language", "feature"];

// Group an array by its `type` field, returned as [type, items[]] pairs in TYPE_ORDER.
export function groupByType(arr, typeOf = (x) => x.type) {
  const buckets = new Map();
  for (const x of arr) {
    const t = typeOf(x) || "other";
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(x);
  }
  return [...buckets.entries()].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a[0]); const ib = TYPE_ORDER.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a[0].localeCompare(b[0]);
  });
}
