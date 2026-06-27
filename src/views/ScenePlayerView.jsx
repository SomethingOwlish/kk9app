import { useState, useEffect, useCallback } from "react";
import { watchActiveScene } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";
import SceneManager from "../components/SceneManager";

export default function ScenePlayerView({ isGM = false, onBack }) {
  const [scene, setScene] = useState(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => watchActiveScene(CAMPAIGN_ID, setScene), []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const bgStyle = scene?.background ? { backgroundImage: `url(${scene.background})` } : {};

  return (
    <div className="kk-scene-fullpage" style={bgStyle}>
      {scene === undefined && (
        <div className="kk-scene-ph">Загрузка…</div>
      )}

      {scene === null && (
        <div className="kk-scene-ph">
          <div className="kk-scene-ph-title">Нет активной сцены</div>
          <div className="kk-scene-ph-sub">Ожидайте — ГМ скоро выберет сцену</div>
        </div>
      )}

      {scene && (
        <div className="kk-scene-overlay">
          <h1 className="kk-scene-heading">{scene.title}</h1>
          {scene.text && <p className="kk-scene-body">{scene.text}</p>}
        </div>
      )}

      <button
        className="kk-scene-fs-btn"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Выйти из полноэкранного режима" : "Полный экран"}
        title={isFullscreen ? "Выйти из полноэкранного режима" : "Полный экран"}
      >
        {isFullscreen ? "✕⛶" : "⛶"}
      </button>

      {isGM && (
        <>
          <button
            className="kk-scene-gm-burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Меню ГМа"
          >
            <span/><span/><span/>
          </button>

          {drawerOpen && (
            <div className="kk-scene-gm-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
              <div className="kk-scene-gm-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="kk-scene-gm-drawer-head">
                  <span>Управление сценой</span>
                  <button className="kk-scene-gm-drawer-close" onClick={() => setDrawerOpen(false)}>✕</button>
                </div>
                <div className="kk-scene-gm-drawer-body">
                  <SceneManager/>
                </div>
                <div className="kk-scene-gm-drawer-foot">
                  <button className="kk-btn ghost" onClick={() => { setDrawerOpen(false); onBack?.(); }}>
                    ← к порталу
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
