// ============================================================
// КК9 — метка времени правки (`updatedAt`).
//
// Зачем: Masterboard читает и пишет персонажей, библиотеку, сцены и предметы
// через мост (lorebridge). Чтобы мост заметил, что запись поменяли в КК9 после
// того, как Masterboard её прочёл, у записи должно быть время правки. До этой
// правки `updatedAt` не было ни у одной из четырёх коллекций.
// Решение Р-В аудита М0: systemsetup/docs/tz/m0-kk9-masterboard-audit-2026-09-27.md.
//
// Как: db.js берёт функции записи отсюда, а не из firebase/firestore напрямую.
// Метка ставится ЗДЕСЬ, по пути документа, — а не в каждом из ~120 мест записи:
// новое место записи получит её само, забыть нельзя.
//
// Правила Firestore (`changedOnly`) перечисляют поля, которые игрок вправе
// менять у своего предмета, — `updatedAt` вписан туда же. Правила выкатываются
// РАНЬШЕ этого кода, иначе игрок не сможет надеть предмет.
// ============================================================
import {
  updateDoc as fsUpdateDoc, setDoc as fsSetDoc, addDoc as fsAddDoc,
  writeBatch as fsWriteBatch, runTransaction as fsRunTransaction, serverTimestamp,
} from "firebase/firestore";

/** Коллекции кампании, у документов которых ставится `updatedAt`. */
export const STAMPED = new Set(["characters", "library", "scenes", "items"]);

/** Ставится ли метка документу по этому пути: campaigns/{id}/{коллекция}/{doc}, без подколлекций. */
export function isStamped(path) {
  const parts = String(path || "").split("/");
  return parts.length === 4 && parts[0] === "campaigns" && STAMPED.has(parts[2]);
}

const stamp = (path, data) => (isStamped(path) && data && typeof data === "object" ? { ...data, updatedAt: serverTimestamp() } : data);

export function updateDoc(ref, data, ...rest) { return fsUpdateDoc(ref, stamp(ref.path, data), ...rest); }
export function setDoc(ref, data, options) { return options === undefined ? fsSetDoc(ref, stamp(ref.path, data)) : fsSetDoc(ref, stamp(ref.path, data), options); }
/** addDoc получает коллекцию: путь документа — её путь плюс будущий id. */
export function addDoc(ref, data) { return fsAddDoc(ref, stamp(`${ref.path}/_`, data)); }

export function writeBatch(db) {
  const batch = fsWriteBatch(db);
  const wrapped = {
    set: (ref, data, options) => { options === undefined ? batch.set(ref, stamp(ref.path, data)) : batch.set(ref, stamp(ref.path, data), options); return wrapped; },
    update: (ref, data, ...rest) => { batch.update(ref, stamp(ref.path, data), ...rest); return wrapped; },
    delete: (ref) => { batch.delete(ref); return wrapped; },
    commit: () => batch.commit(),
  };
  return wrapped;
}

export function runTransaction(db, fn, options) {
  return fsRunTransaction(db, (tx) => {
    const wrapped = {
      get: (ref) => tx.get(ref),
      set: (ref, data, opts) => { opts === undefined ? tx.set(ref, stamp(ref.path, data)) : tx.set(ref, stamp(ref.path, data), opts); return wrapped; },
      update: (ref, data, ...rest) => { tx.update(ref, stamp(ref.path, data), ...rest); return wrapped; },
      delete: (ref) => { tx.delete(ref); return wrapped; },
    };
    return fn(wrapped);
  }, options);
}
