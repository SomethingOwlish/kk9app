// ============================================================
// КК9 ↔ Лорбук — чистая часть: наложение текста мира и замки.
//
// Кампания КК9 может быть связана с миром Лорбука (метка `campaign.lorebook`,
// её ставит мост). С этой минуты ТЕКСТ лорных записей — имя, описание,
// заметки, лор-поля — живёт в Лорбуке, а МЕХАНИКА (кубы, статблок, эффекты,
// состав организаций) — здесь. КК9 спрашивает у моста проекцию
// (`GET /kk9/lore`): по пути документа — «заплатку» текстовых ключей. Заплатка
// накладывается поверх документа при показе, а эти ключи в формах запираются.
//
// Какие ключи держит Лорбук, решает мост (`lorebridge/src/kk9lore.ts`,
// `SHAPES`) и присылает их в ответе (`locked`). Копия здесь (`FALLBACK_LOCKED`)
// нужна только на минуту, пока мост не ответил или молчит: связь есть, а
// проекции нет — править текст в КК9 всё равно нельзя, иначе правка ляжет под
// проекцию и пропадёт. Разошлась копия с мостом — сверять там.
// ============================================================

const PERSON = ["name", "description", "notes", "role", "race", "gender", "age"];

export const FALLBACK_LOCKED = {
  "npc-light": PERSON, "npc-hard": PERSON, "npc-boss": PERSON, curator: PERSON,
  companion: ["name", "description", "species", "age"],
  daemon: ["name", "description", "true_name", "appearance", "dream", "fear", "desire"],
  faculty: ["name", "description", "dormitory", "traits_fit", "traits_unfit", "special_rules", "date_founded", "date_reformed"],
  organization: ["name", "description", "goals", "events", "notes", "leader", "representative"],
  scene: ["title", "text"],
  item: ["name", "description"],
  status: ["description", "removal_instruction"],
  journal: ["title", "body"],
  guide: ["guideMarkdown"],
};

/** Вид документа по коллекции — как у моста (`kindOf`). */
export function kindOf(collection, doc) {
  if (collection === "library") return doc?.kind || null;
  if (collection === "organizations") return "organization";
  if (collection === "scenes") return "scene";
  if (collection === "items") return doc?.ownerCharacterId ? null : "item";
  if (collection === "statuses") return "status";
  if (collection === "journal") return "journal";
  if (collection === "guide") return "guide";
  return null;
}

/** Пустое состояние: связи нет, ничего не накладывается и не запирается. */
export const NO_LORE = { linked: false, ready: true, failed: false, entries: {}, locked: {}, world: null, master: false };

/**
 * Что знать о документе: его запись в мире (если есть) и запертые ключи.
 * Связи нет — null. Связь есть, а проекции нет (мост молчит) — запирается весь
 * текст лорных записей: правка сейчас легла бы под проекцию.
 */
export function loreOf(lore, path, kind) {
  if (!lore?.linked || !kind) return null;
  const entry = lore.entries?.[path];
  if (entry) {
    const locked = lore.locked?.[entry.kind || kind] || FALLBACK_LOCKED[entry.kind || kind] || [];
    return { url: entry.url || "", hidden: !!entry.hidden, locked, patch: entry.patch || {} };
  }
  if (!lore.ready || lore.failed) return { url: "", hidden: false, locked: FALLBACK_LOCKED[kind] || [], patch: {}, waiting: true };
  return null;
}

/**
 * Документ с текстом мира поверх. Метка `_lore` вешается НЕперечисляемой: формы
 * КК9 сохраняют документ целиком (`{...doc}`), и метка в базу не уедет.
 * Скрытое миром от игрока приходит пустым: показывать свою старую копию текста,
 * которую мир как раз и прятал, нельзя.
 */
export function overlay(doc, lore, path, kind) {
  if (!doc) return doc;
  const info = loreOf(lore, path, kind);
  if (!info) return doc;
  let out = { ...doc };
  if (info.hidden) {
    for (const key of info.locked) {
      if (key !== "name" && key !== "title") out[key] = Array.isArray(doc[key]) ? [] : "";
    }
  } else if (!info.waiting) {
    out = { ...out, ...info.patch };
  }
  Object.defineProperty(out, "_lore", { value: info, enumerable: false });
  return out;
}

/** Список документов коллекции с наложенным текстом. */
export function overlayList(docs, lore, collection, prefix = collection) {
  if (!lore?.linked) return docs;
  return docs.map((d) => overlay(d, lore, `${prefix}/${d.id}`, kindOf(collection, d)));
}

/** Заперт ли ключ документа: правится он в Лорбуке. */
export const isLocked = (doc, key) => !!doc?._lore?.locked?.includes(key);
