// ============================================================
// КК9 — единая конфигурация. Меняется ТОЛЬКО здесь.
// ============================================================

// Дефолтная (тестовая) кампания — используется, пока пользователь
// не выбрал другую через «вход в кампанию».
const DEFAULT_CAMPAIGN_ID = "testOne";

// Ключ, где хранится id активной кампании.
const ACTIVE_CAMPAIGN_KEY = "kk9_active_campaign";

// ВАЖНО: выбор кампании — session-scoped (sessionStorage), а НЕ localStorage.
// Экран выбора обязателен между входом и игрой: каждый новый вход (новая вкладка/
// сессия) снова показывает выбор. Выбор переживает reload той же вкладки
// (loginToCampaign перезагружает, чтобы CAMPAIGN_ID пересчитался), но не
// «прилипает» между сессиями — иначе пользователь сразу попадал бы в кампанию,
// минуя экран выбора. Стей-ключи из старого localStorage при этом игнорируются.
function _store() {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; }
  catch { return null; }
}

// Прочитать id активной кампании (или дефолт, если не выбрана / нет доступа к storage).
export function getActiveCampaignId() {
  const s = _store();
  try { return (s && s.getItem(ACTIVE_CAMPAIGN_KEY)) || DEFAULT_CAMPAIGN_ID; }
  catch { return DEFAULT_CAMPAIGN_ID; }
}

// Запомнить активную кампанию на текущую сессию (без перезагрузки — только запись).
export function setActiveCampaignId(id) {
  const s = _store(); if (!s) return;
  try { s.setItem(ACTIVE_CAMPAIGN_KEY, id); } catch { /* storage недоступен */ }
}

// Выбрана ли кампания в этой сессии (экран выбора — обязательный шаг между входом и игрой).
export function hasChosenCampaign() {
  const s = _store(); if (!s) return false;
  try { return !!s.getItem(ACTIVE_CAMPAIGN_KEY); } catch { return false; }
}

// Сбросить выбор (кнопка «сменить кампанию» → снова экран выбора).
export function clearActiveCampaign() {
  const s = _store(); if (!s) return;
  try { s.removeItem(ACTIVE_CAMPAIGN_KEY); } catch { /* storage недоступен */ }
}

// «Войти» в кампанию: запомнить выбор и перезагрузить приложение, чтобы все
// подписки (watchCampaign/watchCharacterList/…) переинициализировались на новый id.
// CAMPAIGN_ID вычисляется на импорте модуля, поэтому смена требует reload.
export function loginToCampaign(id) {
  if (!id) return;
  setActiveCampaignId(id);
  if (typeof window !== "undefined") {
    window.location.hash = "#/";     // приземляемся в приложение, а не обратно на выбор
    window.location.reload();
  }
}

// ID активной кампании (документ campaigns/{CAMPAIGN_ID} в Firestore).
// Вычисляется один раз на импорт; для смены см. loginToCampaign().
export const CAMPAIGN_ID = getActiveCampaignId();
