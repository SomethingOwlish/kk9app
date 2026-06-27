import { useState } from "react";
import { addToParty, removeFromParty, saveCampaignDebounced, setGmModeActive, clearGmMode } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";
import PartyRow from "../components/PartyRow";
import TimeRewindDialog from "../components/TimeRewindDialog";

export default function GmBoard({ campaign, characters, partyMembers, gmModeData, userUid, onOpenChar }) {
  const gameDate  = campaign?.gameDate  ?? "";
  const [weather,   setWeather]   = useState(() => campaign?.weather   ?? "");
  const [worldNote, setWorldNote] = useState(() => campaign?.worldNote ?? "");
  const [showRewind, setShowRewind] = useState(false);

  // Time rewind campaign settings (local state mirrors Firestore, saved debounced)
  const [idleExpPerDay,        setIdleExpPerDay]        = useState(() => campaign?.idleExpPerDay        ?? 5);
  const [graduateDailyExpense, setGraduateDailyExpense] = useState(() => campaign?.graduateDailyExpense ?? 0);
  const [salaryByGrade,        setSalaryByGrade]        = useState(() => campaign?.salaryByGrade        ?? {});
  const [rewindSettingsOpen,   setRewindSettingsOpen]   = useState(false);

  const isGmMode = !!gmModeData?.active;
  const nonParty = characters.filter(c => !partyMembers.some(p => p.id === c.id) && !c.isNpc);

  const save = (patch) => saveCampaignDebounced(CAMPAIGN_ID, patch);

  const saveIdleExp = (val) => {
    const n = Math.max(0, parseFloat(val) || 0);
    setIdleExpPerDay(n);
    save({ idleExpPerDay: n });
  };

  const saveGraduateExpense = (val) => {
    const n = Math.max(0, parseFloat(val) || 0);
    setGraduateDailyExpense(n);
    save({ graduateDailyExpense: n });
  };

  const saveSalary = (grade, val) => {
    const n = Math.max(0, parseInt(val) || 0);
    const updated = { ...salaryByGrade, [grade]: n };
    setSalaryByGrade(updated);
    save({ salaryByGrade: updated });
  };

  return (
    <>
    <div className="kk-board">

      <div className={`kk-board-gmmode ${isGmMode ? "on" : ""}`}>
        <div className="kk-board-gmmode-info">
          <span className="kk-board-gmmode-dot"/>
          <span>{isGmMode ? "Режим ГМ активен — UI игроков заблокирован" : "Режим ГМ отключён"}</span>
        </div>
        <button
          className={`kk-btn sm ${isGmMode ? "danger" : "ghost"}`}
          onClick={() => isGmMode ? clearGmMode(CAMPAIGN_ID) : setGmModeActive(CAMPAIGN_ID, userUid)}
        >
          {isGmMode ? "Отключить" : "Включить"}
        </button>
      </div>

      <div className="kk-board-section">
        <div className="kk-h2">Состояние кампании</div>
        <div className="kk-form-grid" style={{ marginTop: 10 }}>
          <div className="kk-field">
            <label>Дата</label>
            {gameDate
              ? <input className="kk-input" type="date" value={gameDate} readOnly title="Дата меняется только через тайм-ревинд"/>
              : <input className="kk-input" type="date" defaultValue="" onChange={e => save({ gameDate: e.target.value })}/>
            }
          </div>
          <div className="kk-field">
            <label>Погода</label>
            <input
              className="kk-input"
              value={weather}
              onChange={e => { setWeather(e.target.value); save({ weather: e.target.value }); }}
              placeholder="описание погоды"
            />
          </div>
          <div className="kk-field kk-field-wide">
            <label>Объявление для игроков</label>
            <textarea
              className="kk-input kk-textarea"
              value={worldNote}
              onChange={e => { setWorldNote(e.target.value); save({ worldNote: e.target.value }); }}
              rows={2}
              placeholder="свободный текст, виден всем"
            />
          </div>
        </div>
      </div>

      <div className="kk-board-section">
        <div className="kk-board-section-head">
          <div className="kk-h2">Настройки тайм-ревинда</div>
          <button className="kk-btn ghost sm" onClick={() => setRewindSettingsOpen(o => !o)}>
            {rewindSettingsOpen ? "Скрыть" : "Показать"}
          </button>
        </div>
        {rewindSettingsOpen && (
          <div className="kk-form-grid" style={{ marginTop: 10 }}>
            <div className="kk-field">
              <label>Опыт в день (простой)</label>
              <input
                className="kk-input"
                type="number"
                min={0}
                step={0.5}
                value={idleExpPerDay}
                onChange={e => saveIdleExp(e.target.value)}
              />
            </div>
            <div className="kk-field">
              <label>Расходы выпускника/день (₴)</label>
              <input
                className="kk-input"
                type="number"
                min={0}
                value={graduateDailyExpense}
                onChange={e => saveGraduateExpense(e.target.value)}
              />
            </div>
            {[1, 2, 3, 4].map(grade => (
              <div className="kk-field" key={grade}>
                <label>Стипендия {grade} курс (₴/день)</label>
                <input
                  className="kk-input"
                  type="number"
                  min={0}
                  value={salaryByGrade[grade] ?? 0}
                  onChange={e => saveSalary(String(grade), e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="kk-board-section">
        <div className="kk-board-section-head">
          <div className="kk-h2">Отряд <span className="kk-count">{partyMembers.length}</span></div>
          <button
            className="kk-btn sm"
            onClick={() => setRewindOpen(true)}
            disabled={partyMembers.length === 0 || !campaign?.gameDate}
            title="Тайм-ревинд"
          >
            ⏪ Тайм-ревинд
          </button>
        </div>
        {partyMembers.length === 0
          ? <div className="kk-empty">Никого в отряде. Добавьте персонажей ниже.</div>
          : <div className="kk-party-rows">
              {partyMembers.map(ch => (
                <PartyRow
                  key={ch.id}
                  ch={ch}
                  campaignId={CAMPAIGN_ID}
                  onOpen={() => onOpenChar(ch.id)}
                  onRemove={() => removeFromParty(CAMPAIGN_ID, ch.id).catch(console.error)}
                />
              ))}
            </div>
        }
      </div>

      {nonParty.length > 0 && (
        <div className="kk-board-section">
          <div className="kk-h2">Добавить в отряд</div>
          <div className="kk-board-addlist">
            {nonParty.map(ch => (
              <button
                key={ch.id}
                className="kk-board-add-btn"
                style={{ "--fac-color": ch.faculty?.color || "var(--kk-gold)" }}
                onClick={() => addToParty(CAMPAIGN_ID, ch.id).catch(console.error)}
              >
                <span className="kk-board-add-av">{(ch.name || "?")[0]}</span>
                <span className="kk-board-add-name">{ch.name || "без имени"}</span>
                <span className="kk-board-add-sub">{ch.faculty?.name || "без факультета"}</span>
                <span className="kk-board-add-plus">+</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>

    {rewindOpen && (
      <TimeRewindDialog
        campaign={{ ...campaign, idleExpPerDay, graduateDailyExpense, salaryByGrade }}
        partyMembers={partyMembers}
        onClose={() => setRewindOpen(false)}
      />
    )}
    </>
  );
}
