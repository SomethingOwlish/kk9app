import { useState, useEffect } from "react";
import { watchActiveScene } from "../lib/db";
import { CAMPAIGN_ID } from "../lib/config";

export default function ScenePlayerView() {
  const [scene, setScene] = useState(undefined); // undefined = still loading

  useEffect(() => watchActiveScene(CAMPAIGN_ID, setScene), []);

  if (scene === undefined) {
    return <div className="kk-scene-player"><div className="kk-scene-ph">Загрузка…</div></div>;
  }

  if (!scene) {
    return (
      <div className="kk-scene-player">
        <div className="kk-scene-ph">
          <div className="kk-scene-ph-title">Нет активной сцены</div>
          <div className="kk-scene-ph-sub">Ожидайте — ГМ скоро выберет сцену</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="kk-scene-player has-bg"
      style={scene.background ? { backgroundImage: `url(${scene.background})` } : {}}
    >
      <div className="kk-scene-overlay">
        <h1 className="kk-scene-heading">{scene.title}</h1>
        {scene.text && <p className="kk-scene-body">{scene.text}</p>}
      </div>
    </div>
  );
}
