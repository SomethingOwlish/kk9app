// Portrait handling — client-side resize + base64 stored in Firestore.
// No Firebase Storage, no CORS config required.

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB input limit (will be shrunk)
const OUTPUT_MAX_PX   = 256;              // longest edge after resize
const OUTPUT_QUALITY  = 0.8;             // JPEG quality

export function validatePortraitFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) return "Только JPEG, PNG, WebP или GIF.";
  if (file.size > MAX_INPUT_BYTES) return "Файл не должен превышать 10 МБ.";
  return null;
}

// Resizes file to at most 256×256 and returns a base64 JPEG data-URL.
export function resizePortrait(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(OUTPUT_MAX_PX / img.width, OUTPUT_MAX_PX / img.height, 1);
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", OUTPUT_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Не удалось прочитать изображение.")); };
    img.src = objectUrl;
  });
}
