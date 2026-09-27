// node --test src/lib/stamp.test.mjs
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isStamped } from "./stamp.js";

test("метка ставится персонажам, библиотеке, сценам и предметам кампании", () => {
  for (const c of ["characters", "library", "scenes", "items"]) assert.ok(isStamped(`campaigns/c1/${c}/d1`), c);
});
test("подколлекции, кампания, пользователи и прочее — без метки", () => {
  for (const p of ["campaigns/c1", "campaigns/c1/characters/pc1/private/gm", "campaigns/c1/characters/pc1/log/l1",
    "campaigns/c1/organizations/o1", "campaigns/c1/journal/j1", "users/u1", ""]) assert.ok(!isStamped(p), p);
});
