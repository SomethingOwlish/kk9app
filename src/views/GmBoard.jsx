import { useState, useEffect, useRef } from "react";
import {
  watchParty, addToParty, watchGmMode, setGmMode,
  updateCampaignDebounced,
} from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";
import PartyRow from "../components/PartyRow";

export default function GmBoard({ campaign, characters, userUid, onOpen }) {
  const [party, setParty] = useState([]);
  const [gmMode, setGmModeState] = useState(null); // null | { active, uid }
  const [busy, setBusy] = useState(false);

  // Local state for world-state fields (controlled inputs with debounced save).
  const [gameDate, setGameDate]   = useState(campaign?.gameDate  ?? "");
  const [weather, setWeather]     = useState(campaign?.weather   ?? "");
  const [worldNote, setWorldNote] = useState(campaign?.worldNote ?? "");

  // Sync once when campaign prop first arrives from Firestore.
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || !campaign) return;
    setGameDate(campaign.gameDate  ?? "");
    setWeather(campaign.weather    ?? "");
    setWorldNote(campaign.worldNote ?? "");
    initRef.current = true;
  }, [campaign]);

  useEffect(() => watchParty(CAMPAIGN_ID, setParty), []);
  useEffect(() => watchGmMode(CAMPAIGN_ID, setGmModeState), []);

  const partyIds = new Set(party.map((c) => c.id));
  const nonParty = characters.filter((c) => !partyIds.has(c.id) && !c.isNpc);

  const isGmModeOn = gmMode?.active === true;

  async function toggleGmMode() {
    setBusy(true);
    try { await setGmMode(CAMPAIGN_ID, userUid, !isGmModeOn); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
    finally { setBusy(false); }
  }

  async function doAddToParty(charId) {
    try { await addToParty(CAMPAIGN_ID, charId); }
    catch (e) { alert("Ошибка: " + (e?.message || e)); }
  }

  function handleDateChange(v)    { setGameDate(v);   updateCampaignDebounced(CAMPAIGN_ID, { gameDate: v }); }
  function handleWeatherChange(v) { setWeather(v);    updateCampaignDebounced(CAMPAIGN_ID, { weather: v }); }
  function handleNoteChange(v)    { setWorldNote(v);  updateCampaignDebounced(CAMPAIGN_ID, { worldNote: v }); }

  return (
    <div className="kk-board">
      {/* GM Mode toggle */}
      <div className="kk-board-section">
        <div className="kk-h2">Режим ГМ</div>
        <div className="kk-gmmode-row">
          <div className="kk-gmmode-status">
            {isGmModeOn
              ? <span className="kk-gmmode-on">● Активен — интерфейс игроков заблокирован</span>
              : <span className="kk-gmmode-off">○ Выключен</span>
            }
          </div>
          <button
            className={`kk-btn sm ${isGmModeOn ? "danger" : "primary"}`}
            disabled={busy}
            onClick={toggleGmMode}
          >
            {isGmModeOn ? "Выключить" : "Включить"}
          </button>
        </div>
      </div>

      {/* World State */}
      <div className="kk-board-section">
        <div className="kk-h2">Состояние мира</div>
        <div className="kk-board-world">
          <div className="kk-field">
            <label>Дата (игровая)</label>
            <input
              className="kk-input"
              value={gameDate}
              onChange={(e) => handleDateChange(e.target.value)}
              placeholder="например: 15 октября, 1 год"
            />
          </div>
          <div className="kk-field">
            <label>Погода</label>
            <input
              className="kk-input"
              value={weather}
              onChange={(e) => handleWeatherChange(e.target.value)}
              placeholder="например: пасмурно, +7°C"
            />
          </div>
          <div className="kk-field kk-field-wide">
            <label>Новость / заметка мира</label>
            <textarea
              className="kk-input kk-textarea"
              rows={3}
              value={worldNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Краткая заметка, видная всем игрокам…"
            />
          </div>
        </div>
      </div>

      {/* Party */}
      <div className="kk-board-section">
        <div className="kk-h2">
          Партия
          <span className="kk-count">{party.length}</span>
        </div>
        {party.length === 0 && (
          <div className="kk-empty">Партия пуста. Добавьте персонажей ниже.</div>
        )}
        <div className="kk-party-rows">
          {party.map((ch) => (
            <PartyRow key={ch.id} ch={ch} onOpen={onOpen} />
          ))}
        </div>
      </div>

      {/* Non-party characters (add to party) */}
      {nonParty.length > 0 && (
        <div className="kk-board-section">
          <div className="kk-h2">Добавить в партию</div>
          <div className="kk-add-party-list">
            {nonParty.map((ch) => {
              const col = ch.faculty?.color || "#c8a14e";
              return (
                <div key={ch.id} className="kk-add-party-row" style={{ "--fac-color": col }}>
                  <span className="kk-party-av xs">{(ch.name || "?").slice(0, 1)}</span>
                  <span className="kk-add-party-name">{ch.name || "(без имени)"}</span>
                  <span className="kk-add-party-sub">{ch.faculty?.name || "—"}</span>
                  <button
                    className="kk-btn sm primary"
                    onClick={() => doAddToParty(ch.id)}
                  >
                    + Партия
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
