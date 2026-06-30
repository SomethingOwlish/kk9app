import { useState, useMemo } from "react";
import SearchableSelect from "../components/SearchableSelect";
import Group from "../components/shop/Group";

// GM shop management (FEAT-17, TASK-086).
// Create N shops, toggle open/closed + buy/sell mode, curate unique + stackable
// stock (each section is its own collapsible group), set the per-type sell-back
// prices, and read each shop's sell journal.
// Props:
//   shops[], allItems[], onCreate(), onUpdate(shopId, patch), onDelete(shopId)
const TYPE_LABELS = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакт",
  spell: "Заклинание", device: "Устройство", vehicle: "Транспорт",
  language: "Язык", feature: "Особенность",
};
// Languages are NOT physical stock — excluded from shop trade entirely.
const STACKABLE_TYPES = ["weapon", "gear", "spell", "device", "vehicle"];
const SELL_PRICE_TYPES = ["weapon", "gear", "artifact", "spell", "device", "vehicle"];

function cleanSnapshot(item) {
  // eslint-disable-next-line no-unused-vars
  const { id, createdAt, ownerCharacterId, ...rest } = item;
  return rest;
}

export default function ShopManager({ shops = [], allItems = [], onCreate, onUpdate, onDelete }) {
  return (
    <div className="kk-shop-mgr">
      <div className="kk-board-topbar">
        <div className="kk-h2">Магазины <span className="kk-count">{shops.length}</span></div>
        <button className="kk-btn sm" onClick={onCreate}>+ Магазин</button>
      </div>

      {shops.length === 0 && <div className="kk-empty">Нет магазинов. Создайте первый.</div>}

      <div className="kk-shop-mgr-grid">
        {shops.map((shop) => (
          <ShopCard key={shop.id} shop={shop} allItems={allItems} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function ShopCard({ shop, allItems, onUpdate, onDelete }) {
  const save = (patch) => onUpdate(shop.id, patch);
  const isOpen = shop.isOpen !== false; // missing → open by default

  const itemsById = useMemo(() => Object.fromEntries(allItems.map((i) => [i.id, i])), [allItems]);
  // Unique stock = unowned artifacts (single-owner items). Exclude ones already listed.
  const listedIds = new Set((shop.uniqueStock || []).map((u) => u.itemId));
  const uniqueOptions = allItems
    .filter((i) => i.type === "artifact" && i.ownerCharacterId == null && !listedIds.has(i.id))
    .map((i) => ({ value: i.id, label: i.name || "Артефакт", hint: TYPE_LABELS[i.type] }));
  // Stackable templates = unowned catalog items of tradeable types (no languages).
  const stackableOptions = allItems
    .filter((i) => i.ownerCharacterId == null && STACKABLE_TYPES.includes(i.type))
    .map((i) => ({ value: i.id, label: i.name || "Предмет", hint: TYPE_LABELS[i.type] }));

  const [uniquePrice, setUniquePrice] = useState(0);
  const [uniquePick, setUniquePick] = useState("");
  const [stackPick, setStackPick] = useState("");
  const [stackQty, setStackQty] = useState(1);
  const [stackPrice, setStackPrice] = useState(0);

  const addUnique = () => {
    if (!uniquePick) return;
    save({ uniqueStock: [...(shop.uniqueStock || []), { itemId: uniquePick, price: Number(uniquePrice) || 0 }] });
    setUniquePick(""); setUniquePrice(0);
  };
  const removeUnique = (itemId) => save({ uniqueStock: (shop.uniqueStock || []).filter((u) => u.itemId !== itemId) });

  const addStackable = () => {
    const tmpl = itemsById[stackPick];
    if (!tmpl) return;
    save({ stackableStock: [...(shop.stackableStock || []), { itemData: cleanSnapshot(tmpl), quantity: Math.max(1, Number(stackQty) || 1), price: Number(stackPrice) || 0 }] });
    setStackPick(""); setStackQty(1); setStackPrice(0);
  };
  const removeStackable = (index) => save({ stackableStock: (shop.stackableStock || []).filter((_, i) => i !== index) });

  return (
    <div className="kk-shop-card">
      <div className="kk-org-head">
        <input className="kk-input kk-org-name-input" defaultValue={shop.name}
          onBlur={(e) => e.target.value !== shop.name && save({ name: e.target.value })} />
        <button className="kk-icon-btn kk-icon-del" title="Удалить магазин"
          onClick={() => window.confirm(`Удалить «${shop.name}»?`) && onDelete(shop.id)}>✕</button>
      </div>

      <div className="kk-shop-mode">
        <button className={`kk-btn ghost sm ${isOpen ? "on" : ""}`} onClick={() => save({ isOpen: !isOpen })}>
          {isOpen ? "🟢 Открыт" : "🔴 Закрыт"}
        </button>
        <div className="kk-shop-mode-toggle">
          {[["buy", "Продажа игрокам"], ["sell", "Скупка у игроков"]].map(([m, lbl]) => (
            <button key={m} className={`kk-btn ghost sm ${shop.mode === m ? "on" : ""}`} onClick={() => save({ mode: m })}>{lbl}</button>
          ))}
        </div>
        {shop.mode === "buy" && (
          <label className="kk-shop-check">
            <input type="checkbox" checked={!!shop.allowSellBack} onChange={(e) => save({ allowSellBack: e.target.checked })} />
            <span>Принимать скупку</span>
          </label>
        )}
      </div>

      <div className="kk-shop-mgr-body">
        <Group title="Уникальные товары (артефакты)" count={(shop.uniqueStock || []).length} defaultOpen={false}>
          {(shop.uniqueStock || []).map((u) => (
            <div className="kk-shop-row" key={u.itemId}>
              <div className="kk-shop-main"><span className="kk-shop-name">{itemsById[u.itemId]?.name || "(удалён)"}</span></div>
              <span className="kk-shop-price">◈ {u.price ?? 0}</span>
              <button className="kk-icon-btn kk-icon-del" title="Убрать" onClick={() => removeUnique(u.itemId)}>✕</button>
            </div>
          ))}
          <div className="kk-shop-add">
            <SearchableSelect value={uniquePick} onChange={setUniquePick} options={uniqueOptions} placeholder="— артефакт —" />
            <input className="kk-input kk-shop-price-input" type="number" min={0} value={uniquePrice} placeholder="цена"
              onChange={(e) => setUniquePrice(e.target.value)} />
            <button className="kk-btn sm" disabled={!uniquePick} onClick={addUnique}>Добавить</button>
          </div>
        </Group>

        <Group title="Товары на складе" count={(shop.stackableStock || []).length} defaultOpen={false}>
          {(shop.stackableStock || []).map((s, i) => (
            <div className="kk-shop-row" key={i}>
              <div className="kk-shop-main">
                <span className="kk-shop-name">{s.itemData?.name || "товар"}</span>
                <span className="kk-shop-sub">{TYPE_LABELS[s.itemData?.type] || s.itemData?.type} · {s.quantity} шт</span>
              </div>
              <span className="kk-shop-price">◈ {s.price ?? 0}</span>
              <button className="kk-icon-btn kk-icon-del" title="Убрать" onClick={() => removeStackable(i)}>✕</button>
            </div>
          ))}
          <div className="kk-shop-add">
            <SearchableSelect value={stackPick} onChange={setStackPick} options={stackableOptions} placeholder="— предмет —" />
            <input className="kk-input kk-shop-qty-input" type="number" min={1} value={stackQty} placeholder="кол-во"
              onChange={(e) => setStackQty(e.target.value)} />
            <input className="kk-input kk-shop-price-input" type="number" min={0} value={stackPrice} placeholder="цена"
              onChange={(e) => setStackPrice(e.target.value)} />
            <button className="kk-btn sm" disabled={!stackPick} onClick={addStackable}>Добавить</button>
          </div>
        </Group>

        {(shop.mode === "sell" || shop.allowSellBack) && (
          <Group title="Цены скупки по типу" defaultOpen={false}>
            <div className="kk-shop-prices">
              {SELL_PRICE_TYPES.map((t) => (
                <label className="kk-sc-field kk-shop-price-field" key={t}>
                  <span>{TYPE_LABELS[t]}</span>
                  <input className="kk-input" type="number" min={0} defaultValue={shop.defaultPrices?.[t] ?? 0}
                    onBlur={(e) => save({ defaultPrices: { ...(shop.defaultPrices || {}), [t]: Number(e.target.value) || 0 } })} />
                </label>
              ))}
            </div>
          </Group>
        )}

        {(shop.journals || []).length > 0 && (
          <Group title="Журнал скупки" count={(shop.journals || []).length} defaultOpen={false}>
            <div className="kk-shop-journal">
              {(shop.journals || []).slice().reverse().map((j, i) => (
                <div className="kk-shop-journal-row" key={i}>
                  <span>{j.itemName}</span>
                  <span className="kk-shop-price">◈ {j.soldPrice ?? 0}</span>
                  <span className="kk-shop-journal-at">{(j.at || "").slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </Group>
        )}
      </div>
    </div>
  );
}
