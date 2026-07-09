// ============================================================
// КК9 — единая конфигурация. Меняется ТОЛЬКО здесь.
// ============================================================

// Дефолтная (тестовая) кампания — используется, пока пользователь
// не выбрал другую через «вход в кампанию».
const DEFAULT_CAMPAIGN_ID = "testOne";

// Ключ localStorage, где хранится id активной кампании (общий на устройство).
const ACTIVE_CAMPAIGN_KEY = "kk9_active_campaign";

// Прочитать id активной кампании (или дефолт, если не выбрана / нет доступа к storage).
export function getActiveCampaignId() {
  try { return localStorage.getItem(ACTIVE_CAMPAIGN_KEY) || DEFAULT_CAMPAIGN_ID; }
  catch { return DEFAULT_CAMPAIGN_ID; }
}

// Запомнить активную кампанию (без перезагрузки — только запись).
export function setActiveCampaignId(id) {
  try { localStorage.setItem(ACTIVE_CAMPAIGN_KEY, id); } catch { /* storage недоступен */ }
}

// Выбрана ли кампания явно (экран выбора — обязательный шаг между входом и игрой).
export function hasChosenCampaign() {
  try { return !!localStorage.getItem(ACTIVE_CAMPAIGN_KEY); } catch { return false; }
}

// Сбросить выбор (кнопка «сменить кампанию» → снова экран выбора).
export function clearActiveCampaign() {
  try { localStorage.removeItem(ACTIVE_CAMPAIGN_KEY); } catch { /* storage недоступен */ }
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
