import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";

// Max 5 MB, images only.
export const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validatePortraitFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return "Только JPEG, PNG, WebP или GIF.";
  if (file.size > PORTRAIT_MAX_BYTES) return "Файл не должен превышать 5 МБ.";
  return null;
}

// Uploads a portrait file and returns a Promise<downloadURL>.
// onProgress(0–100) is optional.
export function uploadPortrait(file, campaignId, charId, onProgress) {
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `portraits/${campaignId}/${charId}.${ext}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      async () => {
        try { resolve(await getDownloadURL(task.snapshot.ref)); }
        catch (e) { reject(e); }
      },
    );
  });
}

// Deletes a portrait by its download URL (best-effort, ignores 404).
export async function deletePortraitByUrl(url) {
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (e) {
    if (e.code !== "storage/object-not-found") throw e;
  }
}
