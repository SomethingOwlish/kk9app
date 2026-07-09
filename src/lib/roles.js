// ============================================================
// КК9 — разрешение ролей.
// Две оси:
//   globalRole  — глобальная роль из users/{uid}: "admin" | "gm" | "player".
//                 Источник правды для экрана выбора и управления пользователями.
//   membership  — роль в КОНКРЕТНОЙ кампании из campaign.members[uid]:
//                 "gm" | "player" | "demo" (или undefined = не участник).
//
// Правила (решено с владельцем):
//   • Admin  — всегда admin, в любой кампании (даже без membership-записи).
//   • Player — всегда player.
//   • GM     — по умолчанию gm; но если в выбранной кампании он записан игроком
//              (membership === "player"), он играет там как игрок.
//   • demo   — членство demo остаётся demo (публичный предпросмотр сцены),
//              кроме глобального админа, который всегда admin.
// ============================================================

// Эффективная роль внутри кампании. Возвращает null, если пользователь не
// глобальный админ И не имеет membership-записи (т.е. не участник кампании).
export function effectiveRole(globalRole, membership) {
  if (globalRole === "admin") return "admin";
  if (!membership) return null;                 // не участник этой кампании
  if (membership === "demo") return "demo";
  if (globalRole === "gm") return membership === "player" ? "player" : "gm";
  return "player";                              // глобальный игрок — всегда игрок
}

// Может ли пользователь управлять кампаниями (создавать/удалять) на экране выбора.
export function canManageCampaigns(globalRole) {
  return globalRole === "admin" || globalRole === "gm";
}
