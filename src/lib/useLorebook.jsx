// КК9 ↔ Лорбук — сеть и контекст. Правила наложения — в `lorebook.js`.
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "./firebase";
import { NO_LORE } from "./lorebook";

/** Мост Лорбука. Без адреса связь не читается, и КК9 работает как всегда. */
const BRIDGE = String(import.meta.env.VITE_LOREBOOK_BRIDGE || "").replace(/\/$/, "");

/** Как часто перечитывать проекцию: мост держит её минуту, чаще спрашивать незачем. */
const EVERY = 60_000;

/**
 * Проекция мира для кампании. Спрашивается, только если на кампании стоит
 * метка связи: без неё КК9 не ходит к мосту вовсе. Перечитывается раз в минуту
 * и при возвращении во вкладку — правка в Лорбуке доезжает сюда без перезагрузки.
 */
export function useLorebookProjection(campaignId, campaign) {
  const worldId = campaign?.lorebook?.worldId || "";
  const worldName = campaign?.lorebook?.worldName || "мир";
  const worldUrl = campaign?.lorebook?.url || "";
  const [lore, setLore] = useState(NO_LORE);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!worldId) return undefined;
    const bump = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    const timer = setInterval(bump, EVERY);
    document.addEventListener("visibilitychange", bump);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", bump); };
  }, [worldId]);

  useEffect(() => {
    if (!worldId) { setLore(NO_LORE); return undefined; }
    // Связь есть, ответа ещё нет: текст запирается сразу, а не через минуту.
    setLore((was) => (was.linked ? was : {
      ...NO_LORE, linked: true, ready: false,
      world: { id: worldId, name: worldName, url: worldUrl },
    }));
    if (!BRIDGE) {
      setLore((was) => ({ ...was, ready: true, failed: true, error: "Адрес моста Лорбука не задан (VITE_LOREBOOK_BRIDGE)" }));
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${BRIDGE}/kk9/lore?campaignId=${encodeURIComponent(campaignId)}${tick ? "&fresh=1" : ""}`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `Мост ответил ${res.status}`);
        if (!alive) return;
        setLore(body.linked
          ? { linked: true, ready: true, failed: false, entries: body.entries || {}, locked: body.locked || {}, world: body.world, master: !!body.master }
          : NO_LORE);
      } catch (e) {
        if (alive) setLore((was) => ({ ...was, ready: true, failed: true, error: e instanceof Error ? e.message : String(e) }));
      }
    })();
    return () => { alive = false; };
  }, [campaignId, worldId, worldName, worldUrl, tick]);

  return lore;
}

const LoreContext = createContext(NO_LORE);
export const LorebookProvider = LoreContext.Provider;
export const useLore = () => useContext(LoreContext);
