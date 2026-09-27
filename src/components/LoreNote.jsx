import { useLore } from "../lib/useLorebook";

// Пометка у записи, текст которой живёт в Лорбуке. Мастеру — ссылка туда, где
// его правят; игроку — что текст скрыт миром. Пока мост не ответил — что текст
// может быть старым и правка его закрыта.
export default function LoreNote({ doc, compact = false }) {
  const lore = useLore();
  const info = doc?._lore;
  if (!info) return null;
  const world = lore.world?.name ? `«${lore.world.name}»` : "";
  if (info.waiting) {
    return (
      <div className="kk-lore-note kk-lore-note--wait" title={lore.error || ""}>
        Лорбук не ответил: текст может быть старым, правится он в мире {world}
      </div>
    );
  }
  if (info.hidden) return <div className="kk-lore-note">Текст скрыт в Лорбуке</div>;
  if (compact && !info.url) return null;
  return (
    <div className="kk-lore-note">
      {info.url
        ? <a href={info.url} target="_blank" rel="noreferrer">Текст правится в Лорбуке {world} ↗</a>
        : <>Текст из Лорбука {world}</>}
    </div>
  );
}
