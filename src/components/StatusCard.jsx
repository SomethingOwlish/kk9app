import { useState } from "react";
import { updateStatus, deleteStatus } from "../lib/db";

const DURATION_MODE_LABEL = { time: "Время (вручную)", charges: "Заряды", counter: "Счётчик (раунды)" };
const EFFECT_TYPE_LABEL   = { roll_modifier: "Модификатор бросков", health: "Здоровье", energy: "Энергия", tension: "Напряжение" };

function RmSummary({ rm }) {
  const targets = [];
  if (rm.target_all)        targets.push("все броски");
  if (rm.target_agility)    targets.push("Ловкость");
  if (rm.target_smarts)     targets.push("Смекалка");
  if (rm.target_spirit)     targets.push("Дух");
  if (rm.target_endurance)  targets.push("Выносливость");
  if (rm.target_magic)      targets.push("Магия");
  if (rm.target_initiative) targets.push("Инициатива");
  const parts = [];
  if (rm.modifier)         parts.push(`${rm.modifier >= 0 ? "+" : ""}${rm.modifier} к броску`);
  if (rm.die_change)       parts.push(`${rm.die_change >= 0 ? "+" : ""}${rm.die_change} грань куба`);
  if (rm.success_modifier) parts.push(`${rm.success_modifier >= 0 ? "+" : ""}${rm.success_modifier} к успехам`);
  return <span>{targets.join(", ") || "цели не заданы"}{parts.length ? " · " + parts.join(", ") : ""}</span>;
}

function HealthSummary({ h }) {
  return <span>{h.mode === "heal" ? "Лечение" : "Урон"} {h.amount ?? 0} пипов ({h.track === "mental" ? "ментальное" : "физическое"}){h.overflow ? " + переполнение" : ""}</span>;
}

function EffectRow({ eff }) {
  return (
    <div className={`kk-sc-effect kk-sc-effect--${eff.type} ${eff.enabled ? "" : "kk-sc-effect--off"}`}>
      <span className="kk-sc-eff-type">{EFFECT_TYPE_LABEL[eff.type] || eff.type}</span>
      {!eff.enabled && <span className="kk-sc-eff-off"> (отключён)</span>}
      <span className="kk-sc-eff-body">
        {eff.type === "roll_modifier" && <RmSummary rm={eff.roll_modifier || {}}/>}
        {eff.type === "health"        && <HealthSummary h={eff.health || {}}/>}
        {eff.type === "energy"        && <span>Режим: {eff.energy?.mode}, {eff.energy?.amount >= 0 ? "+" : ""}{eff.energy?.amount}</span>}
        {eff.type === "tension"       && <span>Напряжение: {eff.tension?.mode}, {eff.tension?.amount >= 0 ? "+" : ""}{eff.tension?.amount}</span>}
      </span>
    </div>
  );
}

function ReadView({ status, isGM, onEdit }) {
  const dur = status.duration || {};
  return (
    <div className="kk-sc-body">
      <div className="kk-sc-duration">
        <span className="kk-sc-label">Длительность:</span>
        {DURATION_MODE_LABEL[dur.mode] || dur.mode || "—"}
        {dur.value != null && ` · ${dur.value}`}
        {dur.auto_reduce && " · авто"}
      </div>

      {status.status_types?.length > 0 && (
        <div className="kk-sc-types">
          {status.status_types.map(t => <span key={t} className="kk-sc-type-tag">{t}</span>)}
        </div>
      )}

      {status.effects?.length > 0 && (
        <div className="kk-sc-effects">
          <div className="kk-sc-label">Эффекты:</div>
          {status.effects.map((eff, i) => <EffectRow key={eff.id || i} eff={eff}/>)}
        </div>
      )}

      {status.progresses && (
        <div className="kk-sc-progress">
          <span className="kk-sc-label">Прогрессия:</span>
          {" "}каждые {status.progress_every} срабатываний
          {status.progress_into_names?.length > 0 && ` → ${status.progress_into_names.join(", ")}`}
        </div>
      )}

      {status.description && (
        <div className="kk-sc-desc">
          <div className="kk-sc-label">Описание:</div>
          <p>{status.description}</p>
        </div>
      )}

      {isGM && status.removal_instruction && (
        <div className="kk-sc-removal">
          <div className="kk-sc-label">Снятие <span className="kk-gm-badge">ГМ</span>:</div>
          <p>{status.removal_instruction}</p>
        </div>
      )}

      {isGM && onEdit && (
        <button className="kk-btn primary" style={{ marginTop: 12 }} onClick={onEdit}>Редактировать</button>
      )}
    </div>
  );
}

function EditView({ status, campaignId, onSaved, onDelete }) {
  const [name, setName]         = useState(status.name || "");
  const [description, setDesc]  = useState(status.description || "");
  const [removal, setRemoval]   = useState(status.removal_instruction || "");
  const [durMode, setDurMode]   = useState(status.duration?.mode || "time");
  const [durVal, setDurVal]     = useState(status.duration?.value ?? 1);
  const [autoReduce, setAuto]   = useState(status.duration?.auto_reduce ?? false);
  const [saving, setSaving]     = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateStatus(campaignId, status.id, {
        name,
        description,
        removal_instruction: removal,
        duration: { mode: durMode, value: Number(durVal), auto_reduce: autoReduce },
      });
      onSaved?.();
    } catch (e) { alert("Ошибка: " + e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Удалить статус «${status.name}»?`)) return;
    try {
      await deleteStatus(campaignId, status.id);
      onDelete?.();
    } catch (e) { alert("Ошибка: " + e.message); }
  }

  return (
    <div className="kk-sc-body kk-sc-edit">
      <label className="kk-sc-field">
        <span>Название</span>
        <input className="kk-input" value={name} onChange={e => setName(e.target.value)}/>
      </label>

      <div className="kk-sc-dur-row">
        <label className="kk-sc-field">
          <span>Режим</span>
          <select className="kk-input sm" value={durMode} onChange={e => setDurMode(e.target.value)}>
            <option value="time">Время</option>
            <option value="charges">Заряды</option>
            <option value="counter">Счётчик</option>
          </select>
        </label>
        <label className="kk-sc-field">
          <span>Значение</span>
          <input className="kk-input sm" type="number" min={0} value={durVal} onChange={e => setDurVal(e.target.value)}/>
        </label>
        {durMode !== "time" && (
          <label className="kk-sc-field kk-sc-field--cb">
            <input type="checkbox" checked={autoReduce} onChange={e => setAuto(e.target.checked)}/>
            <span>Авто</span>
          </label>
        )}
      </div>

      <label className="kk-sc-field">
        <span>Описание</span>
        <textarea className="kk-input kk-textarea" rows={3} value={description} onChange={e => setDesc(e.target.value)}/>
      </label>

      <label className="kk-sc-field">
        <span>Инструкция снятия <span className="kk-gm-badge">ГМ</span></span>
        <textarea className="kk-input kk-textarea" rows={2} value={removal} onChange={e => setRemoval(e.target.value)}/>
      </label>

      <p className="kk-sc-edit-note">Эффекты редактируются через базовый редактор.</p>

      <div className="kk-sc-edit-actions">
        <button className="kk-btn danger" onClick={handleDelete}>Удалить</button>
        <button className="kk-btn primary" onClick={save} disabled={saving}>{saving ? "…" : "Сохранить"}</button>
      </div>
    </div>
  );
}

// Modal for viewing (all roles) and editing (GM) a status definition or applied instance.
export default function StatusCard({ status, campaignId, isGM, onClose }) {
  const [editing, setEditing] = useState(false);
  if (!status) return null;
  return (
    <div className="kk-modal-backdrop" onClick={onClose}>
      <div className="kk-sc-modal" onClick={e => e.stopPropagation()}>
        <div className="kk-sc-head">
          <span className="kk-sc-name">{status.name}</span>
          <button className="kk-sc-close" onClick={onClose}>✕</button>
        </div>
        {editing
          ? <EditView status={status} campaignId={campaignId} onSaved={() => setEditing(false)} onDelete={onClose}/>
          : <ReadView status={status} isGM={isGM} onEdit={status.id ? () => setEditing(true) : null}/>
        }
      </div>
    </div>
  );
}
