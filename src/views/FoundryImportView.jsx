import { useState, useRef } from "react";
import { parseFoundryActor } from "../lib/foundryImport";
import { createCharacterFromImport } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

// FEAT-20 (in-app) — импорт карточки игрока из Foundry VTT.
// Только для ГМа. Вставьте JSON экспорта актёра (Export Data в Foundry) или
// загрузите .json файл → «Разобрать» → предпросмотр → «Создать карточку».
// Props: onOpenChar(id) — открыть созданную карточку; members — {uid: role}.
export default function FoundryImportView({ onOpenChar, members = {} }) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState(null);   // { ok, error?, doc, items, warnings, summary }
  const [ownerUid, setOwnerUid] = useState("");  // "" = без владельца (GM-only)
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  // Игроки кампании — кандидаты во владельцы карточки.
  const memberOptions = Object.entries(members).filter(([, role]) => role === "player" || role === "admin");

  function doParse(text) {
    setError("");
    setParsed(null);
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      setError("Не удалось прочитать JSON: " + (e?.message || e));
      return;
    }
    // Файл может содержать один актёр или массив — берём первого персонажа.
    const actor = Array.isArray(json)
      ? (json.find((a) => a && a.type === "character") || json[0])
      : json;
    const res = parseFoundryActor(actor);
    if (!res.ok) { setError(res.error); return; }
    setParsed(res);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setRaw(String(reader.result)); doParse(String(reader.result)); };
    reader.onerror = () => setError("Не удалось прочитать файл.");
    reader.readAsText(file);
  }

  async function onCreate() {
    if (!parsed?.ok) return;
    setCreating(true);
    setError("");
    try {
      const id = crypto.randomUUID();
      await createCharacterFromImport(CAMPAIGN_ID, id, parsed, { ownerUid: ownerUid || null });
      onOpenChar?.(id);
    } catch (e) {
      setError("Не удалось создать карточку: " + (e?.message || e));
      setCreating(false);
    }
  }

  const sum = parsed?.summary;

  return (
    <div className="kk-import">
      <div className="kk-board-topbar">
        <div className="kk-h2">Импорт из Foundry</div>
      </div>

      <p className="kk-import-hint">
        В Foundry откройте актёра-персонажа → <b>Export Data</b> → сохраните .json.
        Вставьте содержимое ниже или загрузите файл, затем «Разобрать».
        Внешние ссылки (отношения на других персонажей, организации, компаньоны,
        демоны) в одиночном импорте не подхватываются — они помечаются
        предупреждениями и восстанавливаются вручную.
      </p>

      <div className="kk-import-io">
        <textarea
          className="kk-import-ta"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='{ "name": "...", "type": "character", "system": { ... }, "items": [ ... ] }'
          spellCheck={false}
        />
        <div className="kk-import-actions">
          <button className="kk-btn" onClick={() => doParse(raw)} disabled={!raw.trim()}>Разобрать</button>
          <button className="kk-btn ghost" onClick={() => fileRef.current?.click()}>Загрузить .json</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} hidden />
          {(raw || parsed || error) && (
            <button className="kk-btn ghost" onClick={() => { setRaw(""); setParsed(null); setError(""); }}>Очистить</button>
          )}
        </div>
      </div>

      {error && <div className="kk-import-error">{error}</div>}

      {parsed?.ok && sum && (
        <div className="kk-import-preview">
          <div className="kk-import-name">
            {sum.name || "Без имени"}
            {sum.faculty && <span className="kk-fac-badge">{sum.faculty}</span>}
          </div>
          <div className="kk-import-meta">{sum.academyYear} курс · {sum.semester} сем. · {sum.age} лет</div>

          <div className="kk-import-stats">
            <Stat label="Навыки" n={sum.skills} />
            <Stat label="Языки" n={sum.languages} />
            <Stat label="Черты" n={sum.features} />
            <Stat label="Отношения" n={sum.relations} />
            <Stat label="Статусы" n={sum.activeStatuses} />
            <Stat label="Активные чары" n={sum.activeSpells} />
            <Stat label="Уровни магии" n={sum.magicLevels} />
            <Stat label="Предметы" n={sum.items} />
          </div>

          {Object.keys(sum.itemsByType).length > 0 && (
            <div className="kk-import-items">
              {Object.entries(sum.itemsByType).map(([t, n]) => (
                <span key={t} className="kk-import-chip">{ITEM_LABEL[t] || t}: {n}</span>
              ))}
            </div>
          )}

          <div className="kk-import-owner">
            <label>Владелец карточки:</label>
            <select value={ownerUid} onChange={(e) => setOwnerUid(e.target.value)}>
              <option value="">— без владельца (только ГМ) —</option>
              {memberOptions.map(([uid, role]) => (
                <option key={uid} value={uid}>{role} · {uid.slice(0, 10)}…</option>
              ))}
            </select>
          </div>

          {parsed.warnings.length > 0 && (
            <details className="kk-import-warns">
              <summary>Предупреждения ({parsed.warnings.length})</summary>
              <ul>
                {parsed.warnings.map((w, i) => (
                  <li key={i}><span className="kk-import-wkind">{WARN_LABEL[w.kind] || w.kind}</span> {w.detail}</li>
                ))}
              </ul>
            </details>
          )}

          <button className="kk-btn primary" onClick={onCreate} disabled={creating}>
            {creating ? "Создаём…" : "Создать карточку"}
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, n }) {
  return (
    <div className={`kk-import-stat${n ? "" : " zero"}`}>
      <span className="kk-import-stat-n">{n}</span>
      <span className="kk-import-stat-l">{label}</span>
    </div>
  );
}

const ITEM_LABEL = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакты",
  spell: "Заклинания", device: "Устройства", vehicle: "Транспорт",
};
const WARN_LABEL = {
  "unresolved-ref": "Ссылка не восстановлена:",
  "unmapped-skill": "Навык не распознан:",
  "unknown-item-type": "Неизвестный тип предмета:",
};
