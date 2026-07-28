import Group from "./Group";
import { groupShopSections } from "./groupUtils";

// Buy-mode stock for ShopView (FEAT-17, TASK-087).
// Unique + stackable offers are merged into one list, grouped by item type — with
// spells further split into magic schools — each rendered as its own collapsible
// group. Buy is disabled when the player cannot afford the item.
const TYPE_LABELS = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакт",
  spell: "Заклинание", device: "Устройство", vehicle: "Транспорт",
  language: "Язык", feature: "Особенность",
};

export default function StockList({ shop, money, itemsById, typeLabels = TYPE_LABELS, onBuyUnique, onBuyStackable }) {
  // Spell sections are titled by school; other types keep their type label.
  const titleOf = (sec) =>
    sec.type === "spell"
      ? `Заклинания · ${sec.school} (${sec.items.length})`
      : `${typeLabels[sec.type] || sec.type || ""} (${sec.items.length})`;

  const offers = [];
  for (const u of shop.uniqueStock || []) {
    const item = itemsById[u.itemId];
    if (!item || item.ownerCharacterId != null) continue; // sold / claimed live
    offers.push({ kind: "unique", type: item.type, record: item, item, name: item.name, desc: item.description, price: u.price ?? 0, payload: { ...u, item } });
  }
  (shop.stackableStock || []).forEach((s, index) => {
    if ((s.quantity ?? 0) <= 0) return;
    offers.push({ kind: "stackable", type: s.itemData?.type, record: s.itemData, name: s.itemData?.name || "товар", desc: s.itemData?.description, price: s.price ?? 0, quantity: s.quantity, payload: { ...s, index } });
  });

  if (offers.length === 0) return <div className="kk-empty">Пусто на прилавке.</div>;

  const sections = groupShopSections(offers, { itemOf: (o) => o.record });

  return (
    <div className="kk-shop-stock">
      {sections.map((sec) => (
        <Group key={sec.key} title={titleOf(sec)}>
          {sec.items.map((o, i) => {
            const afford = money >= o.price;
            return (
              <div className="kk-shop-row" key={`${o.kind}-${i}`}>
                {o.item?.portrait && <img className="kk-shop-av" src={o.item.portrait} alt="" />}
                <div className="kk-shop-main">
                  <span className="kk-shop-name">{o.name}</span>
                  <span className="kk-shop-sub">
                    {o.kind === "stackable" ? `осталось ${o.quantity}` : "уникальный"}
                  </span>
                  {o.desc && <span className="kk-shop-desc">{o.desc}</span>}
                </div>
                <span className="kk-shop-price">◈ {o.price}</span>
                <button
                  className="kk-btn sm" disabled={!afford}
                  onClick={() => o.kind === "unique" ? onBuyUnique(o.payload) : onBuyStackable(o.payload)}
                >
                  Купить
                </button>
              </div>
            );
          })}
        </Group>
      ))}
    </div>
  );
}
