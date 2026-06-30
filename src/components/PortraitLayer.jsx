import { useMemo } from "react";
import {
  ZONES, heightToScale, portraitImgFilter, emotionMotionClasses,
  activeEmotion, resolveImage, resolveHeight, isOvercap, statusBadges,
} from "../lib/portrait";

// FEAT-19 — full-viewport portrait layer rendered over the live board / landing.
// position:fixed, pointer-events:none — purely decorative, never blocks the UI.
// Each character whose portraitConfig.zone is one of the four zones is rendered
// in that zone; no zone → not rendered. Height→scale, emotion filter, and the
// reactive (health/tension/overcap/status) filter are all pure CSS.
//
// Props:
//   characters[] — character docs (party); only those with a zone are shown
//   intensity    — global reactive intensity ("off"|"subtle"|"normal"|"brutal")
export default function PortraitLayer({ characters = [], intensity = "normal" }) {
  const byZone = useMemo(() => {
    const map = { crowd: [], left: [], right: [], front: [] };
    for (const ch of characters) {
      const zone = ch?.portraitConfig?.zone;
      if (ZONES.includes(zone)) map[zone].push(ch);
    }
    return map;
  }, [characters]);

  const any = ZONES.some((z) => byZone[z].length > 0);
  if (!any) return null;

  return (
    <div className="kk9-portrait-layer" aria-hidden>
      {ZONES.map((zone) => (
        <div key={zone} className={`kk9-zone kk9-zone--${zone}`} data-zone={zone}>
          {byZone[zone].map((ch) => (
            <Portrait key={ch.id} ch={ch} intensity={intensity} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Portrait({ ch, intensity }) {
  const emo = activeEmotion(ch);
  const img = resolveImage(ch);
  const scale = heightToScale(resolveHeight(ch));
  const motion = emotionMotionClasses(emo?.effects ?? []);
  const filter = portraitImgFilter(ch, emo, intensity);
  const badges = statusBadges(ch);
  const overcap = isOvercap(ch, intensity);

  return (
    <div className={`kk9-portrait ${overcap ? "kk9-overcap" : ""}`} data-id={ch.id} style={{ "--kk9-scale": scale }}>
      {img
        ? <img className={`kk9-portrait__img ${motion}`} src={img} alt="" style={{ filter }} />
        : <div className="kk9-portrait__img kk9-portrait__silhouette" style={{ filter }} />}
      {badges.length > 0 && (
        <div className="kk9-portrait__status">
          {badges.map((b, i) => (
            b.img
              ? <img key={i} className={`kk9-status-badge kk9-status--${b.cat}`} src={b.img} title={b.name} alt="" />
              : <span key={i} className={`kk9-status-badge kk9-status--${b.cat}`} title={b.name} />
          ))}
        </div>
      )}
      <span className="kk9-portrait__name">{ch.name}</span>
    </div>
  );
}
