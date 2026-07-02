import { useState } from "react";
import {
  buildTimeRewindProposals,
  applyTimeRewind,
  addJournalPage,
  fetchDeviceRestorations,
  rewindDaysBetween,
} from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

function fmt(n) {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${n}`;
}

function addDays(dateStr, days) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Numeric input that keeps the field editable while typing.
function NumField({ label, value, onChange, min }) {
  return (
    <label className="kk-rw-f">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </label>
  );
}

// One editable review card for a character proposal.
function ReviewCard({ p, onPatch }) {
  const set = (patch) => onPatch(p.charId, patch);
  return (
    <div className="kk-rw-edit-block">
      <div className="kk-rw-edit-name">
        {p.name}
        {p.isExtra && <span className="kk-rw-edit-tag">доп. актёр</span>}
      </div>
      <div className="kk-rw-fields">
        <NumField label="Опыт (Δ)" value={p.xpDelta} onChange={(v) => set({ xpDelta: v })} />
        <NumField label="Деньги (Δ)" value={p.moneyDelta} onChange={(v) => set({ moneyDelta: v })} />
        <NumField label="HP физ." value={p.healthPhysTo} min={0} onChange={(v) => set({ healthPhysTo: v })} />
        <NumField label="HP мент." value={p.healthMentTo} min={0} onChange={(v) => set({ healthMentTo: v })} />
        <NumField label="Энергия" value={p.energyTo} min={0} onChange={(v) => set({ energyTo: v })} />
        <NumField label="Напряжение" value={p.tensionTo} min={0} onChange={(v) => set({ tensionTo: v })} />
        <NumField label="Семестр" value={p.semesterTo} min={1} onChange={(v) => set({ semesterTo: v })} />
        <label className="kk-rw-f">
          <span>Курс</span>
          <input value={p.academyYearTo ?? ""} onChange={(e) => set({ academyYearTo: e.target.value })} />
        </label>
      </div>

      {p.semesterChanged && (
        <div className="kk-rw-sub">Автопереход семестра/курса — можно скорректировать вручную.</div>
      )}

      {(p.deviceRestorations || []).length > 0 && (
        <label className="kk-rw-cb">
          <input
            type="checkbox"
            checked={!!p.restoreDevices}
            onChange={(e) => set({ restoreDevices: e.target.checked })}
          />
          Восстановить заряды устройств ({p.deviceRestorations.length}):{" "}
          {p.deviceRestorations.map((d) => d.name).join(", ")}
        </label>
      )}

      {(p.companionLevels || []).length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="kk-rw-sub">Компаньоны — уровни связи:</div>
          {p.companionLevels.map((c, i) => (
            <div key={c.id || i} className="kk-rw-list-row">
              <span>{c.name}</span>
              <input
                type="number"
                min={-100}
                max={100}
                value={c.to}
                onChange={(e) => {
                  const to = e.target.value === "" ? 0 : Number(e.target.value);
                  const next = p.companionLevels.map((x, j) => (j === i ? { ...x, to } : x));
                  set({ companionLevels: next });
                }}
              />
            </div>
          ))}
        </div>
      )}

      {(p.contactLevels || []).length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div className="kk-rw-sub">Контакты — уровни отношений:</div>
          {p.contactLevels.map((c, i) => (
            <div key={c.orgId || i} className="kk-rw-list-row">
              <span>{c.orgId}</span>
              <input
                type="number"
                min={-100}
                max={100}
                value={c.to}
                onChange={(e) => {
                  const to = e.target.value === "" ? 0 : Number(e.target.value);
                  const next = p.contactLevels.map((x, j) => (j === i ? { ...x, to } : x));
                  set({ contactLevels: next });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TimeRewindDialog({ campaign, partyMembers = [], extraActors = [], onClose }) {
  const currentDate = campaign?.gameDate ?? "";
  const [step, setStep] = useState(1);
  const [targetDate, setTargetDate] = useState(() => addDays(currentDate, 1));
  const [weather, setWeather] = useState(campaign?.weather ?? "");
  const [worldNewsTitle, setWorldNewsTitle] = useState("");
  const [worldNewsText, setWorldNewsText] = useState("");
  const [pickedExtras, setPickedExtras] = useState(() => new Set());
  const [proposals, setProposals] = useState([]);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);

  const days = rewindDaysBetween(currentDate, targetDate);

  // Load device restorations for a set of characters, then build proposals.
  async function buildFor(chars) {
    const base = buildTimeRewindProposals(chars, days, campaign, currentDate, targetDate);
    const withDevices = await Promise.all(
      base.map(async (p) => {
        try {
          const dr = await fetchDeviceRestorations(CAMPAIGN_ID, p.charId);
          return { ...p, deviceRestorations: dr };
        } catch {
          return { ...p, deviceRestorations: [] };
        }
      }),
    );
    return withDevices;
  }

  // Step 1 → extras picker (2) if any extras exist, else straight to review (3).
  async function goFromStep1() {
    if (extraActors.length > 0) {
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      setProposals(await buildFor(partyMembers));
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  // Step 2 → build proposals for party + picked extras, go to review.
  async function goFromStep2() {
    setBusy(true);
    try {
      const extras = extraActors
        .filter((c) => pickedExtras.has(c.id))
        .map((c) => ({ ...c }));
      const chars = [...partyMembers, ...extras];
      const built = await buildFor(chars);
      // Tag extras so the review UI can badge them.
      const extraIds = new Set(extras.map((c) => c.id));
      setProposals(built.map((p) => ({ ...p, isExtra: extraIds.has(p.charId) })));
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  const patchProposal = (charId, patch) =>
    setProposals((ps) => ps.map((p) => (p.charId === charId ? { ...p, ...patch } : p)));

  function summaryLine(r) {
    const a = r.applied;
    if (!a) return `${r.name}: не применено`;
    const parts = [];
    if (a.xpDelta) parts.push(`опыт ${fmt(a.xpDelta)}`);
    if (a.moneyDelta) parts.push(`деньги ${fmt(a.moneyDelta)}`);
    parts.push(`HP ф${a.healthPhysTo}/м${a.healthMentTo}`);
    parts.push(`энерг ${a.energyTo}`);
    parts.push(`напр ${a.tensionTo}`);
    if (a.semesterChanged) parts.push(`семестр ${a.semesterTo}, курс ${a.academyYearTo}`);
    if (a.devices?.length) parts.push(`устройства: ${a.devices.join(", ")}`);
    if (a.companions?.length) {
      parts.push("компаньоны: " + a.companions.map((c) => `${c.name} ${c.from}→${c.to}`).join(", "));
    }
    if (a.contacts?.length) {
      parts.push("контакты: " + a.contacts.map((c) => `${c.orgId} ${c.from}→${c.to}`).join(", "));
    }
    return `${r.name}: ${parts.join(", ")}`;
  }

  const apply = async () => {
    setBusy(true);
    try {
      const res = await applyTimeRewind(CAMPAIGN_ID, proposals, days, currentDate, targetDate, weather);
      setResults(res);
      // Rewind summary → gmPrivate stream.
      addJournalPage(CAMPAIGN_ID, "gmPrivate", {
        title: `Тайм-ревинд: ${currentDate} → ${targetDate} (${days} дн.)`,
        body: res.filter((r) => r.ok).map(summaryLine).join("\n"),
      }).catch(() => {});
      // World news → worldNews stream.
      if (worldNewsText.trim()) {
        addJournalPage(CAMPAIGN_ID, "worldNews", {
          title: worldNewsTitle.trim() || `Новости (${targetDate})`,
          body: worldNewsText.trim(),
        }).catch(() => {});
      }
      setStep(4);
    } catch (e) {
      alert("Ошибка тайм-ревинда: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const toggleExtra = (id) =>
    setPickedExtras((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="kk-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="kk-modal">
        <div className="kk-modal-head">
          <span className="kk-modal-title">Тайм-ревинд</span>
          <button className="kk-modal-x" onClick={onClose}>✕</button>
        </div>

        {step === 1 && (
          <div className="kk-modal-body">
            <div className="kk-form-grid">
              <div className="kk-field">
                <label>Текущая дата</label>
                <input className="kk-input" type="date" value={currentDate} readOnly />
              </div>
              <div className="kk-field">
                <label>Новая дата</label>
                <input
                  className="kk-input"
                  type="date"
                  value={targetDate}
                  min={currentDate || undefined}
                  onChange={(e) => setTargetDate(e.target.value)}
                />
              </div>
            </div>
            {days > 0 && (
              <p className="kk-modal-hint" style={{ marginTop: 8 }}>
                Пройдёт дней: <b>{days}</b> · снов: <b>{Math.floor(days * 0.8)}</b>
              </p>
            )}
            {days === 0 && targetDate && (
              <p className="kk-modal-hint kk-warn" style={{ marginTop: 8 }}>
                Новая дата должна быть позже текущей.
              </p>
            )}

            <div className="kk-field" style={{ marginTop: 12 }}>
              <label>Погода</label>
              <input
                className="kk-input"
                placeholder="описание погоды"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
              />
            </div>

            <div className="kk-field" style={{ marginTop: 12 }}>
              <label>Мировые новости — заголовок (необязательно)</label>
              <input
                className="kk-input"
                placeholder={`Новости (${targetDate || "дата"})`}
                value={worldNewsTitle}
                onChange={(e) => setWorldNewsTitle(e.target.value)}
              />
            </div>
            <div className="kk-field" style={{ marginTop: 8 }}>
              <label>Мировые новости — текст (необязательно)</label>
              <textarea
                className="kk-input kk-textarea"
                rows={4}
                placeholder="Что произошло в мире за это время…"
                value={worldNewsText}
                onChange={(e) => setWorldNewsText(e.target.value)}
              />
            </div>

            {partyMembers.length === 0 && <div className="kk-modal-warn">В отряде нет персонажей.</div>}
            <div className="kk-modal-foot">
              <button className="kk-btn ghost sm" onClick={onClose}>Отмена</button>
              <button
                className="kk-btn primary sm"
                disabled={partyMembers.length === 0 || days === 0 || busy}
                onClick={goFromStep1}
              >
                {busy ? "…" : "Далее →"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="kk-modal-body">
            <p className="kk-modal-hint">
              Добавить в перемотку персонажей вне отряда (необязательно):
            </p>
            <div className="kk-rw-extra-pick">
              {extraActors.map((c) => (
                <label key={c.id} className="kk-rw-extra-row">
                  <input
                    type="checkbox"
                    checked={pickedExtras.has(c.id)}
                    onChange={() => toggleExtra(c.id)}
                  />
                  <span>{c.name || "без имени"}</span>
                  {c.type === "npc-light" && <span className="kk-rw-edit-tag">npc-light</span>}
                </label>
              ))}
            </div>
            <div className="kk-modal-foot">
              <button className="kk-btn ghost sm" onClick={() => setStep(1)}>← Назад</button>
              <button className="kk-btn primary sm" disabled={busy} onClick={goFromStep2}>
                {busy ? "…" : "Далее →"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="kk-modal-body">
            <p className="kk-modal-hint">
              Изменения за <b>{days}</b> дн. ({currentDate} → {targetDate}). Значения можно править:
            </p>
            <div className="kk-rw-edit">
              {proposals.map((p) => (
                <ReviewCard key={p.charId} p={p} onPatch={patchProposal} />
              ))}
            </div>
            <div className="kk-modal-foot">
              <button
                className="kk-btn ghost sm"
                onClick={() => setStep(extraActors.length > 0 ? 2 : 1)}
              >
                ← Назад
              </button>
              <button className="kk-btn primary sm" disabled={busy} onClick={apply}>
                {busy ? "Применяем…" : "Применить"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="kk-modal-body">
            <p className="kk-modal-hint">Тайм-ревинд завершён. Новая дата: <b>{targetDate}</b></p>
            <div className="kk-rw-results">
              {results.map((r) => (
                <div key={r.charId} className={`kk-rw-result ${r.ok ? "ok" : "fail"}`}>
                  <span>{r.ok ? "✓" : "✗"}</span>
                  <span>{r.name}</span>
                  {!r.ok && <span className="kk-rw-err">{r.error}</span>}
                </div>
              ))}
            </div>
            <div className="kk-modal-foot">
              <button className="kk-btn primary sm" onClick={onClose}>Закрыть</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
