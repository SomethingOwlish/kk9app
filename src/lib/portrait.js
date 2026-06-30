// ============================================================
// КК9 — Портреты (FEAT-19). Логика слоя, портирована из Foundry
// модуля kk9-portraits (docs/OldCode/kk9-portraits/scripts).
//   • эмоции: motion-эффекты (CSS-классы) + filter-эффекты (CSS filter);
//   • масштаб от роста (бакеты по 5 см, только вниз);
//   • реактивный слой A: урон/напряжение/оверкап → общий filter картинки,
//     бейджи статусов Cat-1.
// Веб-версия: «присутствие» (зона) хранится в character.portraitConfig.zone
// в Firestore — это заменяет сокет Foundry, синхронизация идёт через
// watchCharacterList.
// ============================================================

export const SILHOUETTE = "icons/svg/mystery-man.svg"; // путь-заглушка; в вебе обычно пусто
export const DEFAULT_HEIGHT = 177;
export const FX_PREFIX = "kk9-fx--";

// z-порядок снизу вверх: толпа сзади → бока → перёд сверху.
export const ZONES = ["crowd", "left", "right", "front"];
export const ZONE_LABELS = { front: "Перёд", left: "Лево", right: "Право", crowd: "Толпа" };

// Библиотека эффектов эмоций (effects.mjs). motion — анимация; filter — CSS-фильтр.
export const EFFECTS = [
  { id: "shake", label: "тряска",  kind: "motion" },
  { id: "bob",   label: "качание", kind: "motion" },
  { id: "pulse", label: "пульс",   kind: "motion" },
  { id: "sway",  label: "наклон",  kind: "motion" },
  { id: "anger", label: "гнев",    kind: "filter", filter: "saturate(1.6) hue-rotate(-18deg) brightness(1.05)" },
  { id: "sad",   label: "грусть",  kind: "filter", filter: "saturate(.45) brightness(.9)" },
  { id: "joy",   label: "радость", kind: "filter", filter: "saturate(1.3) brightness(1.14) sepia(.12)" },
  { id: "fear",  label: "страх",   kind: "filter", filter: "saturate(.6) brightness(.78) contrast(1.12)" },
  { id: "sick",  label: "дурнота", kind: "filter", filter: "saturate(1.25) hue-rotate(65deg) brightness(.95)" },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Собрать строку фильтра из выбранных filter-эффектов эмоции.
export function emotionFilter(effectIds = []) {
  return EFFECTS.filter((e) => e.kind === "filter" && effectIds.includes(e.id))
    .map((e) => e.filter)
    .join(" ");
}

// Motion-классы эмоции (для className на <img>).
export function emotionMotionClasses(effectIds = []) {
  return EFFECTS.filter((e) => e.kind === "motion" && effectIds.includes(e.id))
    .map((e) => FX_PREFIX + e.id)
    .join(" ");
}

// --- Масштаб от роста: бакеты по 5 см, только вниз (entry.mjs heightToScale) ---
const HEIGHT = { REF_BUCKET: 190, STEP: 5, FACTOR: 0.022, MIN: 0.7, MAX: 1.0 };
export function heightToScale(raw) {
  let cm = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(cm) || cm <= 0) cm = DEFAULT_HEIGHT;
  const bucket = Math.floor(cm / HEIGHT.STEP) * HEIGHT.STEP;
  const steps = (HEIGHT.REF_BUCKET - bucket) / HEIGHT.STEP;
  return clamp(1 - steps * HEIGHT.FACTOR, HEIGHT.MIN, HEIGHT.MAX);
}

// Множитель интенсивности реактива. Персональный override портрета (число
// строкой "0"/"0.5"/"1.6") поверх общего; пусто = норма (1).
const INTENSITY_MULT = { off: 0, subtle: 0.55, normal: 1, brutal: 1.5 };
export function intensityMult(ch, globalIntensity = "normal") {
  const ov = ch?.portraitConfig?.intensityOverride;
  if (ov !== "" && ov != null) {
    const n = Number(ov);
    if (Number.isFinite(n)) return n;
  }
  return INTENSITY_MULT[globalIntensity] ?? 1;
}

// Реактивные доли из данных персонажа (веб-схема character doc).
function reactiveValues(ch) {
  const tough = ch?.health?.physical?.toughness;
  const pval = ch?.health?.physical?.value;
  let phys = 0;
  if (Number.isFinite(tough) && tough > 0 && Number.isFinite(pval)) {
    // 4 пипа по toughness каждый = условный максимум.
    phys = clamp(pval / (tough * 4), 0, 1);
  }
  const tcur = ch?.tension?.current, tmax = ch?.tension?.max;
  let tension = 0;
  if (Number.isFinite(tcur) && Number.isFinite(tmax) && tmax > 0) tension = clamp(tcur / tmax, 0, 1);
  const overcap = Number(ch?.tension?.overcap ?? 0) > 0;
  const fac = ch?.faculty?.color || "#888888";
  return { phys, tension, overcap, fac };
}

// Реактивная часть общего CSS-фильтра картинки (layer-a.mjs reactiveFilter).
export function reactiveFilter(ch, globalIntensity = "normal") {
  const mult = intensityMult(ch, globalIntensity);
  if (mult <= 0 || !ch) return "";
  const r = reactiveValues(ch);
  const phys = Math.min(r.phys * mult, 1);
  const tension = Math.min(r.tension * mult, 1);
  const f = [];
  if (phys > 0.01) f.push(`saturate(${(1 - phys * 0.7).toFixed(3)})`, `brightness(${(1 - phys * 0.18).toFixed(3)})`);
  if (tension > 0.01) f.push(`drop-shadow(0 0 ${(tension * 22).toFixed(1)}px ${r.fac})`);
  if (r.overcap) f.push("drop-shadow(0 0 14px rgba(210,20,20,0.9))");
  return f.join(" ");
}

export function isOvercap(ch, globalIntensity = "normal") {
  return intensityMult(ch, globalIntensity) > 0 && Number(ch?.tension?.overcap ?? 0) > 0;
}

const BASE_SHADOW = "drop-shadow(0 0.4vh 0.8vh rgba(0,0,0,0.55))";

// Полный inline-filter картинки портрета = базовая тень + эмоция + реактив.
export function portraitImgFilter(ch, emotion, globalIntensity = "normal") {
  return [BASE_SHADOW, emotionFilter(emotion?.effects ?? []), reactiveFilter(ch, globalIntensity)]
    .filter(Boolean)
    .join(" ");
}

// Активная эмоция персонажа из portraitConfig.
export function activeEmotion(ch) {
  const cfg = ch?.portraitConfig;
  if (!cfg?.activeEmotion) return null;
  return (cfg.emotions || []).find((e) => e.id === cfg.activeEmotion) || null;
}

// Картинка для показа: картинка активной эмоции → базовая картинка → портрет карточки.
export function resolveImage(ch) {
  const cfg = ch?.portraitConfig || {};
  return activeEmotion(ch)?.image || cfg.portraitImage || ch?.portrait || "";
}

// Рост для масштаба: portraitConfig.portraitHeight → character.height → дефолт.
export function resolveHeight(ch) {
  const h = ch?.portraitConfig?.portraitHeight;
  if (Number.isFinite(h) && h > 0) return h;
  const parsed = parseFloat(String(ch?.height ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HEIGHT;
}

// Бейджи статусов Cat-1 для портрета (по activeStatuses персонажа).
export const CAT1 = { bleed: "bleed", burn: "burn", acid: "acid", electric: "electric", cold: "cold", poison: "poison", shock_mental: "mental" };
export function statusBadges(ch) {
  const out = [];
  for (const s of ch?.activeStatuses ?? []) {
    const tags = s.status_types || s.statusTypes || [];
    const cat = tags.find((t) => t in CAT1);
    if (cat) out.push({ cat: CAT1[cat], name: s.name, img: s.img });
  }
  return out;
}
