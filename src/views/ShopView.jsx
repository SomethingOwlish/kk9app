import { useState, useMemo } from "react";
import StockList from "../components/shop/StockList";
import PurchaseDialog from "../components/shop/PurchaseDialog";
import Group from "../components/shop/Group";
import { groupByType } from "../components/shop/groupUtils";

// Player-facing shop (FEAT-17, TASK-087/088/089).
// Props:
//   shops[]        all campaign shops
//   char           the buyer character (money + id); null if the player has none
//   ownedItems[]   items owned by `char` (for sell mode)
//   allItems[]     full catalog (resolves unique-stock itemIds → names)
//   onBuyUnique(shopId, itemId)               → Promise<{name, price}>
//   onBuyStackable(shopId, stockIndex, qty)   → Promise<{name, price}>
//   onSell(shopId, item, price)               → Promise<{name, price}>
const TYPE_LABELS = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакт",
  spell: "Заклинание", device: "Устройство", vehicle: "Транспорт",
  language: "Язык", feature: "Особенность",
};

export default function ShopView({ shops = [], char, ownedItems = [], allItems = [], defaultItemPrice = 0, onBuyUnique, onBuyStackable, onSell }) {
  const [selectedId, setSelectedId] = useState(shops[0]?.id || null);
  const [dialog, setDialog] = useState(null); // { kind, ... }
  const [msg, setMsg] = useState(null);        // { kind: "ok"|"err", text }
  const [busy, setBusy] = useState(false);

  const itemsById = useMemo(() => Object.fromEntries(allItems.map((i) => [i.id, i])), [allItems]);
  // Falls back to the first shop when the selection is empty or points at a
  // shop that was just deleted live — no effect/setState needed.
  const shop = shops.find((s) => s.id === selectedId) || shops[0] || null;

  const money = char?.money ?? 0;

  if (!char) {
    return <div className="kk-empty">Сначала создайте персонажа, чтобы пользоваться магазином.</div>;
  }
  if (shops.length === 0) {
    return <div className="kk-empty">Магазинов пока нет.</div>;
  }

  const flash = (kind, text) => { setMsg({ kind, text }); setTimeout(() => setMsg(null), 4000); };

  const runBuyUnique = async (u) => {
    setBusy(true);
    try { const r = await onBuyUnique(shop.id, u.itemId); flash("ok", `Куплено: ${r?.name || u.item?.name || "товар"}`); }
    catch (e) { flash("err", e?.message || "Не удалось купить"); }
    finally { setBusy(false); setDialog(null); }
  };
  const runBuyStackable = async (stockIndex, qty) => {
    setBusy(true);
    try { const r = await onBuyStackable(shop.id, stockIndex, qty); flash("ok", `Куплено: ${r?.name || "товар"}`); }
    catch (e) { flash("err", e?.message || "Не удалось купить"); }
    finally { setBusy(false); setDialog(null); }
  };
  const runSell = async (item, price) => {
    setBusy(true);
    try { await onSell(shop.id, item, price); flash("ok", `Запрос на продажу отправлен ГМ: ${item.name} (◈ ${price}). ГМ подтвердит и зачислит деньги.`); }
    catch (e) { flash("err", e?.message || "Не удалось отправить запрос"); }
    finally { setBusy(false); }
  };

  // Missing isOpen is treated as open (shops default to open).
  const open = shop.isOpen !== false;
  const isBuy = shop.mode === "buy";
  const isSell = shop.mode === "sell";
  const showBuy = open && isBuy;
  const showSell = open && (isSell || (isBuy && shop.allowSellBack));

  return (
    <div className="kk-shop">
      <div className="kk-board-topbar">
        <div className="kk-h2">Магазин</div>
        <div className="kk-shop-money">◈ {money}</div>
      </div>

      {shops.length > 1 && (
        <div className="kk-shop-tabs">
          {shops.map((s) => (
            <button key={s.id} className={`kk-btn ghost sm ${s.id === shop.id ? "on" : ""}`} onClick={() => setSelectedId(s.id)}>
              {s.name}{s.mode === "sell" ? " · скупка" : ""}
            </button>
          ))}
        </div>
      )}

      {msg && <div className={`kk-shop-msg ${msg.kind === "ok" ? "ok" : "err"}`}>{msg.text}</div>}

      {!open && <div className="kk-empty">Магазин закрыт. Зайдите позже.</div>}

      {showBuy && (
        <StockList
          shop={shop} money={money} itemsById={itemsById} typeLabels={TYPE_LABELS}
          onBuyUnique={(u) => setDialog({ kind: "unique", u, name: u.item?.name || "товар", price: u.price ?? 0, max: 1 })}
          onBuyStackable={(s) => setDialog({ kind: "stackable", stockIndex: s.index, name: s.itemData?.name || "товар", price: s.price ?? 0, max: Math.min(s.quantity ?? 1, (s.price ?? 0) > 0 ? Math.floor(money / s.price) : (s.quantity ?? 1)) })}
        />
      )}

      {showSell && (
        <SellList shop={shop} ownedItems={ownedItems} busy={busy} onSell={runSell} typeLabels={TYPE_LABELS} defaultItemPrice={defaultItemPrice} />
      )}

      {dialog && (
        <PurchaseDialog
          target={dialog} money={money}
          onCancel={() => !busy && setDialog(null)}
          onConfirm={(qty) => dialog.kind === "unique" ? runBuyUnique(dialog.u) : runBuyStackable(dialog.stockIndex, qty)}
        />
      )}
    </div>
  );
}

// Sell section: lists the player's owned items grouped by type, each group
// independently collapsible. Suggested price = shop.defaultPrices[type] when the
// GM set one, otherwise the campaign default price from settings (never a bare 0).
// Price-0 items are still sellable. Grouped sale items are kept separate per type.
function SellList({ shop, ownedItems, busy, onSell, typeLabels, defaultItemPrice }) {
  const sellable = ownedItems.filter((i) => i.name !== "Кулаки"); // never sell the default fists
  const groups = useMemo(() => groupByType(sellable), [sellable]);
  if (sellable.length === 0) {
    return (
      <section className="kk-shop-sec">
        <div className="kk-shop-sec-title">Продать</div>
        <div className="kk-empty">Нет предметов на продажу.</div>
      </section>
    );
  }
  const priceFor = (type) => shop.defaultPrices?.[type] ?? defaultItemPrice ?? 0;
  return (
    <section className="kk-shop-sec">
      <div className="kk-shop-sec-title">Продать</div>
      <div className="kk-note">Продажа подтверждается ГМ — укажите желаемую цену, ГМ её утвердит или изменит.</div>
      {groups.map(([type, list]) => (
        <Group key={type} title={`${typeLabels[type] || type} (${list.length})`}>
          {list.map((item) => (
            <SellRow key={item.id} item={item} suggested={priceFor(type)} busy={busy} onSell={onSell} typeLabel={typeLabels[type] || type} />
          ))}
        </Group>
      ))}
    </section>
  );
}

function SellRow({ item, suggested, busy, onSell, typeLabel }) {
  const [price, setPrice] = useState(suggested);
  return (
    <div className="kk-shop-row">
      <div className="kk-shop-main">
        <span className="kk-shop-name">{item.name}</span>
        <span className="kk-shop-sub">{typeLabel}</span>
      </div>
      <input className="kk-input kk-shop-price-input" type="number" min={0} value={price}
        onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} />
      <button className="kk-btn sm" disabled={busy} onClick={() => onSell(item, price)}>Запросить продажу</button>
    </div>
  );
}
