// Buy-mode stock rows for ShopView (FEAT-17, TASK-087).
// Unique stock: name / type / price / Buy. Stackable: name / type / qty-remaining /
// unit-price / Buy. Buy is disabled when the player cannot afford the item.
const TYPE_LABELS = {
  weapon: "Оружие", gear: "Снаряжение", artifact: "Артефакт",
  spell: "Заклинание", device: "Устройство", vehicle: "Транспорт",
  language: "Язык", feature: "Особенность",
};
const typeLabel = (t) => TYPE_LABELS[t] || t || "";

export default function StockList({ shop, money, itemsById, onBuyUnique, onBuyStackable }) {
  const unique = (shop.uniqueStock || [])
    .map((u) => ({ ...u, item: itemsById[u.itemId] }))
    .filter((u) => u.item && u.item.ownerCharacterId == null);
  const stackable = (shop.stackableStock || [])
    .map((s, index) => ({ ...s, index }))
    .filter((s) => (s.quantity ?? 0) > 0);

  if (unique.length === 0 && stackable.length === 0) {
    return <div className="kk-empty">Пусто на прилавке.</div>;
  }

  return (
    <div className="kk-shop-stock">
      {unique.length > 0 && (
        <section className="kk-shop-sec">
          <div className="kk-shop-sec-title">Уникальные товары</div>
          {unique.map((u) => {
            const afford = money >= (u.price ?? 0);
            return (
              <div className="kk-shop-row" key={u.itemId}>
                {u.item.portrait && <img className="kk-shop-av" src={u.item.portrait} alt="" />}
                <div className="kk-shop-main">
                  <span className="kk-shop-name">{u.item.name}</span>
                  <span className="kk-shop-sub">{typeLabel(u.item.type)}</span>
                </div>
                <span className="kk-shop-price">◈ {u.price ?? 0}</span>
                <button className="kk-btn sm" disabled={!afford} onClick={() => onBuyUnique(u)}>
                  Купить
                </button>
              </div>
            );
          })}
        </section>
      )}

      {stackable.length > 0 && (
        <section className="kk-shop-sec">
          <div className="kk-shop-sec-title">Товары на складе</div>
          {stackable.map((s) => {
            const name = s.itemData?.name || "товар";
            const afford = money >= (s.price ?? 0);
            return (
              <div className="kk-shop-row" key={s.index}>
                <div className="kk-shop-main">
                  <span className="kk-shop-name">{name}</span>
                  <span className="kk-shop-sub">{typeLabel(s.itemData?.type)} · осталось {s.quantity}</span>
                </div>
                <span className="kk-shop-price">◈ {s.price ?? 0}</span>
                <button className="kk-btn sm" disabled={!afford} onClick={() => onBuyStackable(s)}>
                  Купить
                </button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
