// node --test src/lib/lorebook.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_LORE, isLocked, overlay, overlayList } from "./lorebook.js";

const lore = {
  ...NO_LORE, linked: true, ready: true,
  entries: {
    "library/n1": { entityId: "e1", url: "https://lb/w/w1/e/e1", kind: "npc-light", patch: { name: "Старый страж", description: "<p>Спит.</p>" } },
    "library/n2": { entityId: "e2", url: "", kind: "npc-boss", patch: {}, hidden: true },
  },
  locked: { "npc-light": ["name", "description", "notes"], "npc-boss": ["name", "description", "notes"] },
};

test("текст мира ложится поверх, механика остаётся своей", () => {
  const out = overlay({ id: "n1", kind: "npc-light", name: "Страж", description: "<p>Стоит.</p>", toughness: 5 }, lore, "library/n1", "npc-light");
  assert.equal(out.name, "Старый страж");
  assert.equal(out.description, "<p>Спит.</p>");
  assert.equal(out.toughness, 5);
  assert.ok(isLocked(out, "name"));
  assert.ok(!isLocked(out, "toughness"));
});

test("метка не уезжает в базу: формы сохраняют документ целиком", () => {
  const out = overlay({ id: "n1", kind: "npc-light", name: "Страж" }, lore, "library/n1", "npc-light");
  assert.ok(out._lore);
  assert.ok(!("_lore" in { ...out }));
  assert.ok(!Object.keys(out).includes("_lore"));
});

test("скрытое миром приходит пустым, а не старой копией", () => {
  const out = overlay({ id: "n2", kind: "npc-boss", name: "Тень", description: "<p>Тайна.</p>", notes: "секрет" }, lore, "library/n2", "npc-boss");
  assert.equal(out.description, "");
  assert.equal(out.notes, "");
  assert.equal(out._lore.hidden, true);
});

test("не забранное в мир — своё и не заперто; связи нет — ничего не трогается", () => {
  const [own] = overlayList([{ id: "n9", kind: "npc-light", name: "Новый" }], lore, "library");
  assert.equal(own._lore, undefined);
  const plain = { id: "n1", name: "Страж" };
  assert.equal(overlay(plain, NO_LORE, "library/n1", "npc-light"), plain);
});

test("мост молчит — текст заперт, но не подменён", () => {
  const out = overlay({ id: "s1", title: "Порт", text: "Рыба" }, { ...lore, entries: {}, failed: true }, "scenes/s1", "scene");
  assert.equal(out.text, "Рыба");
  assert.ok(isLocked(out, "text"));
  assert.equal(out._lore.waiting, true);
});

test("выданный предмет не связан никогда", () => {
  const [item] = overlayList([{ id: "i2", name: "Меч", ownerCharacterId: "c1" }], { ...lore, failed: true }, "items");
  assert.equal(item._lore, undefined);
});
