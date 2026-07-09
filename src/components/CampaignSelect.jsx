import { useEffect, useState, useCallback } from "react";
import {
  ensureUserDoc, watchUserDoc,
  watchCampaignsForUser, watchAllCampaigns,
  createCampaign, deleteCampaign, setCampaignArchived,
  watchAllUsers, setUserRole, deleteUser,
  assignUserToCampaign, removeUserFromCampaign,
  assignCharacterToUser, listCharacters,
} from "../lib/db";
import { loginToCampaign } from "../lib/config";
import { canManageCampaigns } from "../lib/roles";

// ============================================================
// КК9 — экран выбора кампании (между входом и игрой).
//   • Admin / GM: активные кампании + архив (заголовки) + создать/удалить.
//   • Player: только выбор (может состоять в нескольких кампаниях).
//   • Admin: вкладка «Пользователи» — роли, назначение кампаний и персонажей.
// Глобальная роль берётся из users/{uid}; членство в кампании — из members[].
// ============================================================
export default function CampaignSelect({ user, signOut }) {
  const [me, setMe] = useState(undefined);      // undefined = грузим users-док
  const [tab, setTab] = useState("campaigns");

  // Провизия своего users-дока при входе, затем живая подписка на роль.
  useEffect(() => { ensureUserDoc(user).catch(() => {}); }, [user]);
  useEffect(() => watchUserDoc(user.uid, setMe), [user.uid]);

  const globalRole = me?.role || (me === null ? "player" : null);
  const isAdmin = globalRole === "admin";
  const canManage = canManageCampaigns(globalRole);

  return (
    <div className="kk-select">
      <style>{CSS}</style>
      <div className="kk-select-shell">
        <header className="kk-select-head">
          <div className="kk-select-logo">КК<span>9</span></div>
          <div className="kk-select-meta">
            <div className="kk-select-user">{user.displayName || user.email || "Гость"}</div>
            <div className="kk-select-role">{roleLabel(globalRole)}</div>
          </div>
          <button className="kk-select-out" onClick={signOut}>Выйти</button>
        </header>

        {isAdmin && (
          <nav className="kk-select-tabs">
            <button className={tab === "campaigns" ? "on" : ""} onClick={() => setTab("campaigns")}>Кампании</button>
            <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>Пользователи</button>
          </nav>
        )}

        {me === undefined && <div className="kk-select-load">Загрузка профиля…</div>}
        {me !== undefined && tab === "campaigns" && (
          <CampaignPicker user={user} globalRole={globalRole} isAdmin={isAdmin} canManage={canManage} />
        )}
        {me !== undefined && tab === "users" && isAdmin && (
          <UserManager />
        )}
      </div>
    </div>
  );
}

function roleLabel(r) {
  return r === "admin" ? "Администратор" : r === "gm" ? "Мастер" : r === "player" ? "Игрок" : "—";
}

// ── Выбор / управление кампаниями ────────────────────────────
function CampaignPicker({ user, globalRole, isAdmin, canManage }) {
  const [campaigns, setCampaigns] = useState(null);

  // Админ видит все кампании; ГМ/игрок — только свои (memberUids).
  useEffect(() => {
    return isAdmin
      ? watchAllCampaigns(setCampaigns)
      : watchCampaignsForUser(user.uid, setCampaigns);
  }, [isAdmin, user.uid]);

  const onCreate = useCallback(async () => {
    const name = window.prompt("Название новой кампании:", "Новая кампания");
    if (!name) return;
    try {
      const role = globalRole === "admin" ? "admin" : "gm";
      const id = await createCampaign({ ownerUid: user.uid, name: name.trim(), role });
      loginToCampaign(id);       // сразу входим в созданную кампанию
    } catch (e) { alert("Не удалось создать: " + (e?.message || e)); }
  }, [globalRole, user.uid]);

  const onDelete = useCallback(async (c) => {
    if (!window.confirm(`Удалить кампанию «${c.name || c.id}» со всем содержимым? Это необратимо.`)) return;
    try { await deleteCampaign(c.id); }
    catch (e) { alert("Не удалось удалить: " + (e?.message || e)); }
  }, []);

  const onArchive = useCallback(async (c, archived) => {
    try { await setCampaignArchived(c.id, archived); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
  }, []);

  if (campaigns === null) return <div className="kk-select-load">Загрузка кампаний…</div>;

  const active = campaigns.filter((c) => !c.archived);
  const archived = campaigns.filter((c) => c.archived);

  return (
    <div className="kk-select-body">
      <div className="kk-select-section-head">
        <h2>Активные кампании</h2>
        {canManage && <button className="kk-select-create" onClick={onCreate}>+ Создать</button>}
      </div>

      {active.length === 0 && <div className="kk-select-empty">Нет доступных кампаний.</div>}
      <div className="kk-select-list">
        {active.map((c) => (
          <div key={c.id} className="kk-camp-card">
            <div className="kk-camp-info">
              <div className="kk-camp-name">{c.name || c.id}</div>
              <div className="kk-camp-sub">{c.memberUids?.length ?? 0} участн. · роль: {roleLabel(effectiveFor(globalRole, c.members?.[user.uid]))}</div>
            </div>
            <div className="kk-camp-actions">
              <button className="kk-camp-enter" onClick={() => loginToCampaign(c.id)}>Войти →</button>
              {canManage && <button className="kk-camp-arch" title="В архив" onClick={() => onArchive(c, true)}>⧉</button>}
              {canManage && <button className="kk-camp-del" title="Удалить" onClick={() => onDelete(c)}>🗑</button>}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="kk-select-archive">
          <div className="kk-select-section-head"><h2>Архив</h2></div>
          {archived.length === 0
            ? <div className="kk-select-empty">Архив пуст. (Раздел в разработке.)</div>
            : <div className="kk-select-list">
                {archived.map((c) => (
                  <div key={c.id} className="kk-camp-card muted">
                    <div className="kk-camp-info"><div className="kk-camp-name">{c.name || c.id}</div></div>
                    <div className="kk-camp-actions">
                      <button className="kk-camp-arch" title="Вернуть" onClick={() => onArchive(c, false)}>↩</button>
                      <button className="kk-camp-del" title="Удалить" onClick={() => onDelete(c)}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}
    </div>
  );
}

// Пересчёт эффективной роли для подписи карточки (без импорта, чтобы избежать null-строки).
function effectiveFor(globalRole, membership) {
  if (globalRole === "admin") return "admin";
  if (globalRole === "gm") return membership === "player" ? "player" : "gm";
  return "player";
}

// ── Управление пользователями (только админ) ─────────────────
function UserManager() {
  const [users, setUsers] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [openUid, setOpenUid] = useState(null);

  useEffect(() => watchAllUsers(setUsers), []);
  useEffect(() => watchAllCampaigns(setCampaigns), []);

  const onRole = useCallback(async (uid, role) => {
    try { await setUserRole(uid, role); } catch (e) { alert("Ошибка: " + (e?.message || e)); }
  }, []);
  const onDelete = useCallback(async (u) => {
    if (!window.confirm(`Удалить пользователя «${u.displayName || u.email || u.id}» из системы? (Аккаунт входа не удаляется.)`)) return;
    try { await deleteUser(u.id); } catch (e) { alert("Ошибка: " + (e?.message || e)); }
  }, []);

  if (users === null) return <div className="kk-select-load">Загрузка пользователей…</div>;

  return (
    <div className="kk-select-body">
      <div className="kk-select-section-head"><h2>Пользователи</h2></div>
      {users.length === 0 && <div className="kk-select-empty">Пока нет зарегистрированных пользователей.</div>}
      <div className="kk-select-list">
        {users.map((u) => (
          <div key={u.id} className="kk-user-card">
            <div className="kk-user-row">
              <div className="kk-user-info">
                <div className="kk-user-name">{u.displayName || "(без имени)"}</div>
                <div className="kk-user-email">{u.email || u.id}</div>
              </div>
              <select className="kk-user-role" value={u.role || "player"} onChange={(e) => onRole(u.id, e.target.value)}>
                <option value="player">Игрок</option>
                <option value="gm">Мастер</option>
                <option value="admin">Админ</option>
              </select>
              <button className="kk-user-expand" onClick={() => setOpenUid(openUid === u.id ? null : u.id)}>
                {openUid === u.id ? "▲ кампании" : "▼ кампании"}
              </button>
              <button className="kk-camp-del" title="Удалить" onClick={() => onDelete(u)}>🗑</button>
            </div>
            {openUid === u.id && <UserCampaigns uid={u.id} campaigns={campaigns} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Назначение кампаний и персонажей одному пользователю.
function UserCampaigns({ uid, campaigns }) {
  return (
    <div className="kk-user-camps">
      {campaigns.length === 0 && <div className="kk-select-empty">Нет кампаний.</div>}
      {campaigns.map((c) => (
        <UserCampaignRow key={c.id} uid={uid} campaign={c} />
      ))}
    </div>
  );
}

function UserCampaignRow({ uid, campaign }) {
  const membership = campaign.members?.[uid];         // undefined = не назначен
  const assigned = membership != null;
  const [chars, setChars] = useState(null);

  // Лениво грузим персонажей кампании, когда пользователь в ней состоит.
  // (Селект персонажа рендерится только при assigned, поэтому сбрасывать chars
  // при снятии членства не нужно — избегаем синхронного setState в эффекте.)
  useEffect(() => {
    if (!assigned) return;
    let live = true;
    listCharacters(campaign.id).then((rows) => { if (live) setChars(rows); }).catch(() => setChars([]));
    return () => { live = false; };
  }, [assigned, campaign.id]);

  const toggle = async () => {
    try {
      if (assigned) await removeUserFromCampaign(campaign.id, uid);
      else await assignUserToCampaign(campaign.id, uid, "player");
    } catch (e) { alert("Ошибка: " + (e?.message || e)); }
  };
  const changeRole = async (role) => {
    try { await assignUserToCampaign(campaign.id, uid, role); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
  };
  const ownedChar = chars?.find((ch) => ch.ownerUid === uid);
  const assignChar = async (charId) => {
    try {
      // Снимаем прежнего персонажа этого пользователя, затем назначаем нового.
      if (ownedChar && ownedChar.id !== charId) {
        await assignCharacterToUser(campaign.id, ownedChar.id, null);
      }
      if (charId) await assignCharacterToUser(campaign.id, charId, uid);
      const rows = await listCharacters(campaign.id);
      setChars(rows);
    } catch (e) { alert("Ошибка: " + (e?.message || e)); }
  };

  return (
    <div className={`kk-ucrow ${assigned ? "on" : ""}`}>
      <label className="kk-ucrow-main">
        <input type="checkbox" checked={assigned} onChange={toggle} />
        <span className="kk-ucrow-name">{campaign.name || campaign.id}</span>
      </label>
      {assigned && (
        <div className="kk-ucrow-controls">
          <select value={membership} onChange={(e) => changeRole(e.target.value)}>
            <option value="player">Игрок</option>
            <option value="gm">Мастер</option>
            <option value="demo">Демо</option>
          </select>
          <select
            value={ownedChar?.id || ""}
            onChange={(e) => assignChar(e.target.value)}
            disabled={chars === null}
            title="Назначить персонажа"
          >
            <option value="">{chars === null ? "…" : "— персонаж —"}</option>
            {(chars || []).map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name || ch.id}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

const CSS = `
.kk-select{min-height:100vh; background:#181410; color:#ece2cf;
  font-family:'Golos Text',system-ui,sans-serif; padding:24px 16px;}
.kk-select-shell{max-width:760px; margin:0 auto;}
.kk-select-head{display:flex; align-items:center; gap:14px; margin-bottom:18px;}
.kk-select-logo{font-family:'Playfair Display',serif; font-weight:700; font-size:32px;}
.kk-select-logo span{color:#c8a14e;}
.kk-select-meta{flex:1; line-height:1.25;}
.kk-select-user{font-size:15px; font-weight:600;}
.kk-select-role{font-size:11px; color:#a8967a; text-transform:uppercase; letter-spacing:.12em;}
.kk-select-out{background:none; border:1px solid #48391f; color:#a8967a; border-radius:8px;
  padding:8px 14px; font:inherit; font-size:13px; cursor:pointer;}
.kk-select-out:hover{border-color:#c8a14e; color:#ece2cf;}
.kk-select-tabs{display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid #33291a;}
.kk-select-tabs button{background:none; border:none; color:#a8967a; font:inherit; font-size:14px;
  padding:10px 14px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px;}
.kk-select-tabs button.on{color:#e2c178; border-bottom-color:#c8a14e;}
.kk-select-load,.kk-select-empty{color:#7a6a52; padding:16px 4px; font-size:14px;}
.kk-select-section-head{display:flex; align-items:center; justify-content:space-between; margin:20px 0 10px;}
.kk-select-section-head h2{font-family:'Playfair Display',serif; font-size:19px; font-weight:600; margin:0;}
.kk-select-create{background:#c8a14e; color:#1a140c; border:none; border-radius:8px;
  padding:8px 14px; font:inherit; font-size:13px; font-weight:600; cursor:pointer;}
.kk-select-create:hover{background:#e2c178;}
.kk-select-list{display:flex; flex-direction:column; gap:8px;}
.kk-camp-card{display:flex; align-items:center; gap:12px; padding:14px 16px;
  border:1px solid #48391f; border-radius:10px; background:linear-gradient(170deg,#2a2218,#241d15);}
.kk-camp-card.muted{opacity:.6;}
.kk-camp-info{flex:1; min-width:0;}
.kk-camp-name{font-size:15px; font-weight:600;}
.kk-camp-sub{font-size:12px; color:#a8967a; margin-top:2px;}
.kk-camp-actions{display:flex; align-items:center; gap:6px;}
.kk-camp-enter{background:#3a2f1c; color:#e2c178; border:1px solid #6a5326; border-radius:8px;
  padding:8px 14px; font:inherit; font-size:13px; font-weight:600; cursor:pointer;}
.kk-camp-enter:hover{background:#4a3c24;}
.kk-camp-arch,.kk-camp-del{background:none; border:1px solid #48391f; border-radius:8px;
  width:34px; height:34px; color:#a8967a; cursor:pointer; font-size:14px;}
.kk-camp-del:hover{border-color:#bd5a3a; color:#e08a6a;}
.kk-camp-arch:hover{border-color:#c8a14e; color:#ece2cf;}
.kk-select-archive{margin-top:8px;}
.kk-user-card{border:1px solid #48391f; border-radius:10px; background:#241d15; overflow:hidden;}
.kk-user-row{display:flex; align-items:center; gap:10px; padding:12px 14px;}
.kk-user-info{flex:1; min-width:0;}
.kk-user-name{font-size:14px; font-weight:600;}
.kk-user-email{font-size:12px; color:#a8967a;}
.kk-user-role,.kk-ucrow-controls select{background:#1d1710; color:#ece2cf; border:1px solid #48391f;
  border-radius:7px; padding:7px 8px; font:inherit; font-size:13px; cursor:pointer;}
.kk-user-expand{background:none; border:1px solid #48391f; color:#a8967a; border-radius:7px;
  padding:7px 10px; font:inherit; font-size:12px; cursor:pointer; white-space:nowrap;}
.kk-user-expand:hover{border-color:#c8a14e; color:#ece2cf;}
.kk-user-camps{border-top:1px solid #33291a; padding:8px 14px 12px; display:flex; flex-direction:column; gap:6px;}
.kk-ucrow{display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  padding:7px 8px; border-radius:8px;}
.kk-ucrow.on{background:#20190f;}
.kk-ucrow-main{display:flex; align-items:center; gap:9px; cursor:pointer; font-size:13px;}
.kk-ucrow-controls{display:flex; gap:6px;}
@media (max-width:560px){
  .kk-camp-card{flex-wrap:wrap;}
  .kk-camp-actions{width:100%; justify-content:flex-end;}
}
`;
