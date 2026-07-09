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
// глобальный админ/мастер И не имеет membership-записи (т.е. не участник).
export function effectiveRole(globalRole, membership) {
  if (globalRole === "admin") return "admin";   // админ — всегда админ везде
  if (globalRole === "gm") {
    // Глобальный мастер — со-мастер всех кампаний (видит и ведёт любую).
    // Игроком он становится ТОЛЬКО там, где явно записан игроком; demo уважается.
    if (membership === "player") return "player";
    if (membership === "demo") return "demo";
    return "gm";
  }
  // Глобальный игрок: доступ только к кампаниям, где он участник.
  if (!membership) return null;
  if (membership === "demo") return "demo";
  return "player";
}

// Может ли пользователь управлять кампаниями (создавать/удалять) на экране выбора.
export function canManageCampaigns(globalRole) {
  return globalRole === "admin" || globalRole === "gm";
}
