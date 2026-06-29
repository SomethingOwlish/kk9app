// FEAT-18 — active scene preview (title + background thumbnail) for landing.
export default function ScenePreviewPanel({ scene }) {
  if (!scene) {
    return (
      <div className="kk-landing-panel kk-scene-panel kk-scene-panel--empty">
        <span className="kk-empty-sm">Активная сцена не выбрана</span>
      </div>
    );
  }
  return (
    <div className="kk-landing-panel kk-scene-panel">
      {scene.background && (
        <div className="kk-scene-thumb">
          <img src={scene.background} alt=""/>
        </div>
      )}
      <div className="kk-scene-title">{scene.title || "Сцена"}</div>
    </div>
  );
}
