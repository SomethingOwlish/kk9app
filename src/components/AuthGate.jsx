import { useEffect, useState, useCallback } from "react";
import { watchAuth, signInWithGoogle, signInAnon, signOut } from "../lib/auth";
import { clearActiveCampaign } from "../lib/config";

// ============================================================
// КК9 — ворота входа.
// Пока не вошёл — экран входа (Google + «зайти гостем»).
// Вошёл — рендерим children(user): дальше всё приложение.
// ============================================================
export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = ещё проверяем
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  // Выход сбрасывает выбор кампании этой сессии, чтобы после повторного входа
  // снова показывался экран выбора, а не «прилипшая» кампания (которую новый
  // пользователь может быть не вправе читать — иначе бесконечная загрузка).
  const doSignOut = useCallback(() => { clearActiveCampaign(); return signOut(); }, []);

  useEffect(() => watchAuth(setUser), []);

  const run = (fn) => async () => {
    setErr(""); setBusy(true);
    try { await fn(); }
    catch (e) { setErr(e?.message || "Не удалось войти"); }
    finally { setBusy(false); }
  };

  // Проверяем состояние входа
  if (user === undefined) {
    return <div className="kk-auth"><style>{AUTH_CSS}</style><div className="kk-auth-spin">…</div></div>;
  }

  // Не вошёл — экран входа
  if (!user) {
    return (
      <div className="kk-auth">
        <style>{AUTH_CSS}</style>
        <div className="kk-auth-card">
          <div className="kk-auth-logo">КК<span>9</span></div>
          <div className="kk-auth-sub">Корпус 9 · вход в кампанию</div>
          <button className="kk-auth-btn primary" disabled={busy} onClick={run(signInWithGoogle)}>
            Войти через Google
          </button>
          <button className="kk-auth-btn ghost" disabled={busy} onClick={run(signInAnon)}>
            Зайти гостем
          </button>
          {err && <div className="kk-auth-err">{err}</div>}
        </div>
      </div>
    );
  }

  // Вошёл — отдаём приложение. signOut прокидываем вниз на случай кнопки «выйти».
  return children({ user, signOut: doSignOut });
}

const AUTH_CSS = `
.kk-auth{min-height:100vh; display:grid; place-items:center; background:#181410;
  font-family:'Golos Text',system-ui,sans-serif; color:#ece2cf; padding:20px;}
.kk-auth-spin{color:#7a6a52; font-size:28px;}
.kk-auth-card{width:100%; max-width:320px; display:flex; flex-direction:column; gap:12px; align-items:center;
  padding:32px 26px; border:1px solid #48391f; border-radius:12px;
  background:linear-gradient(170deg,#2a2218,#241d15); box-shadow:0 18px 50px rgba(0,0,0,.5);}
.kk-auth-logo{font-family:'Playfair Display',serif; font-weight:700; font-size:46px; letter-spacing:.02em;}
.kk-auth-logo span{color:#c8a14e;}
.kk-auth-sub{font-size:12px; color:#a8967a; text-transform:uppercase; letter-spacing:.14em; margin-bottom:14px;}
.kk-auth-btn{width:100%; padding:12px; border-radius:9px; font-size:14px; font-weight:600;
  font-family:inherit; cursor:pointer; transition:opacity .15s, border-color .15s;}
.kk-auth-btn:disabled{opacity:.5; cursor:default;}
.kk-auth-btn.primary{background:#c8a14e; color:#1a140c; border:none;}
.kk-auth-btn.primary:hover:not(:disabled){background:#e2c178;}
.kk-auth-btn.ghost{background:none; color:#a8967a; border:1px solid #48391f;}
.kk-auth-btn.ghost:hover:not(:disabled){border-color:#c8a14e; color:#ece2cf;}
.kk-auth-err{font-size:12px; color:#bd5a3a; text-align:center; margin-top:4px;}
`;
