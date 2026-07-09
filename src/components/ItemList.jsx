import DiceIcon from "./DiceIcon";
import { ACTIVATABLE_TYPES, EQUIPPABLE_TYPES } from "../lib/items";
import WeaponItem from "./items/WeaponItem";
import GearItem from "./items/GearItem";
import ArtifactItem from "./items/ArtifactItem";
import SpellItem from "./items/SpellItem";
import DeviceItem from "./items/DeviceItem";
import VehicleItem from "./items/VehicleItem";

const SECTION_LABELS = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакты",
  spell: "Заклинания", device: "Устройства", vehicle: "Транспорт",
};

// Language and feature are embedded in the character doc, not in the items collection.
const ITEM_TYPES = Object.keys(SECTION_LABELS);

// Which item types expose a "roll" button (use the linked skill).
const ROLLABLE_TYPES = new Set(["weapon", "spell", "gear", "artifact"]);
function isRollable(item) {
  if (!ROLLABLE_TYPES.has(item.type)) return false;
  if (item.type === "weapon") return true;
  if (item.type === "gear") return item.gearType === "attack" || !!item.skillName;
  if (item.type === "artifact") return item.artifactType === "attack" && !!item.skillName;
  return !!item.skillName; // spell
}

// Read-only per-character item display. All creating/editing lives in ItemsView
// (the GM catalog). This component renders cards + keeps GM delete, activation,
// equip and roll controls.
export default function ItemList({ items = [], isGM, onDelete, onUpdateItem, character, canActivate = false, showRoll = false, onRollItem, onToggleFlag }) {
  const byType = {};
  for (const t of ITEM_TYPES) byType[t] = items.filter(i => i.type === t);

  const activeSpellsMap = {};
  if (character?.activeSpells) {
    for (const as of character.activeSpells) activeSpellsMap[as.itemId] = as;
  }

  return (
    <section className="kk-block">
      <h2 className="kk-h2">Предметы</h2>

      {items.length === 0 && (
        <div className="kk-empty-sm">Нет предметов</div>
      )}

      {ITEM_TYPES.map(t => {
        const group = byType[t];
        if (group.length === 0) return null;

        const renderControls = (item) => {
          const canRollIt = showRoll && isRollable(item) && onRollItem;
          const canAct = canActivate && ACTIVATABLE_TYPES.has(item.type) && onToggleFlag;
          const canEquip = canActivate && EQUIPPABLE_TYPES.has(item.type) && onToggleFlag;
          if (!canRollIt && !canAct && !canEquip) return null;
          return (
            <div className="kk-item-controls">
              {canRollIt && (
                <button className="kk-item-roll-btn" onClick={() => onRollItem(item)} title="Бросок предмета">
                  <DiceIcon size={14}/> Бросок
                </button>
              )}
              {canAct && (
                <button className={`kk-item-toggle${item.active ? " on" : ""}`} onClick={() => onToggleFlag(item, "active")}>
                  {item.active ? "Активен" : "Активировать"}
                </button>
              )}
              {canEquip && (
                <button className={`kk-item-toggle${item.equipped ? " on" : ""}`} onClick={() => onToggleFlag(item, "equipped")}>
                  {item.equipped ? "Снаряжён" : "Снарядить"}
                </button>
              )}
            </div>
          );
        };

        const renderOne = (item) => {
          const del = isGM ? () => onDelete(item.id) : undefined;
          let el = null;
          if (t === "weapon") el = <WeaponItem item={item} isGM={isGM} onDelete={del} />;
          else if (t === "gear") el = <GearItem item={item} isGM={isGM} onDelete={del} />;
          else if (t === "artifact") el = <ArtifactItem item={item} isGM={isGM} onDelete={del} />;
          else if (t === "spell") el = <SpellItem item={item} activeSpell={activeSpellsMap[item.id]} isGM={isGM} onDelete={del} />;
          else if (t === "device") el = <DeviceItem item={item} isGM={isGM} onDelete={del}
            onUpdateCharges={onUpdateItem ? (charges) => onUpdateItem(item.id, { charges }) : undefined} />;
          else if (t === "vehicle") el = <VehicleItem item={item} isGM={isGM} onDelete={del} />;
          if (!el) return null;
          const controls = renderControls(item);
          return (
            <div key={item.id} className="kk-item-wrap">
              {el}
              {controls}
            </div>
          );
        };

        if (t === "spell") {
          const folders = {};
          const folderOrder = [];
          for (const item of group) {
            const key = item.folder || item.skillName || "Без навыка";
            if (!folders[key]) { folders[key] = []; folderOrder.push(key); }
            folders[key].push(item);
          }
          return (
            <div key={t} className="kk-items-group">
              <div className="kk-items-group-label">{SECTION_LABELS[t]}</div>
              {folderOrder.map(folder => (
                <div key={folder} className="kk-spell-folder">
                  <div className="kk-spell-folder-label">{folder}</div>
                  {folders[folder].map(item => renderOne(item))}
                </div>
              ))}
            </div>
          );
        }

        return (
          <div key={t} className="kk-items-group">
            <div className="kk-items-group-label">{SECTION_LABELS[t]}</div>
            {group.map(item => renderOne(item))}
          </div>
        );
      })}
    </section>
  );
}
