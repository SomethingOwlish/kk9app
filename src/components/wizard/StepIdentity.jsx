import { useRef, useState } from "react";
import { uploadPortrait, validatePortraitFile } from "../../lib/storage";

const GENDER_OPTIONS = [
  { value: "m",  label: "М" },
  { value: "f",  label: "Ж" },
  { value: "nb", label: "Нонбинари" },
];

// Props: data, onChange, campaignId, charId
export default function StepIdentity({ data, onChange, campaignId, charId }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validatePortraitFile(file);
    if (err) { setUploadError(err); return; }
    setUploadError("");
    setUploading(true);
    setProgress(0);
    try {
      const url = await uploadPortrait(file, campaignId, charId, setProgress);
      onChange({ portrait: url });
    } catch (e) {
      setUploadError("Ошибка загрузки: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="kk-block">
      <h2 className="kk-h2">Личность</h2>
      <div className="kk-wiz-field">
        <label className="kk-wiz-label">Имя *</label>
        <input
          className="kk-input"
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Имя персонажа"
        />
      </div>

      <div className="kk-wiz-field">
        <label className="kk-wiz-label">Портрет</label>
        <div className="kk-portrait-upload">
          {data.portrait && (
            <img
              className="kk-portrait-preview"
              src={data.portrait}
              alt="портрет"
              onError={e => { e.target.style.display = "none"; }}
            />
          )}
          <div className="kk-portrait-controls">
            <button
              type="button"
              className="kk-btn"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? `Загрузка… ${progress}%` : "Загрузить файл"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
          {uploadError && <p className="kk-error">{uploadError}</p>}
        </div>
        <label className="kk-wiz-label" style={{ marginTop: 6 }}>или URL портрета</label>
        <input
          className="kk-input"
          value={data.portrait}
          onChange={e => onChange({ portrait: e.target.value })}
          placeholder="https://…"
          disabled={uploading}
        />
      </div>

      <div className="kk-wiz-row">
        <div className="kk-wiz-field">
          <label className="kk-wiz-label">Возраст</label>
          <input
            className="kk-input"
            type="number"
            value={data.age}
            onChange={e => onChange({ age: Number(e.target.value) || 15 })}
            min={14} max={30}
          />
        </div>
        <div className="kk-wiz-field">
          <label className="kk-wiz-label">Пол</label>
          <div className="kk-wiz-gender-group">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`kk-wiz-gender-btn${data.gender === opt.value ? " selected" : ""}`}
                onClick={() => onChange({ gender: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="kk-wiz-field">
        <label className="kk-wiz-label">Место рождения</label>
        <input
          className="kk-input"
          value={data.birthplace}
          onChange={e => onChange({ birthplace: e.target.value })}
          placeholder="—"
        />
      </div>
      <div className="kk-wiz-field">
        <label className="kk-wiz-label">Рост</label>
        <input
          className="kk-input"
          value={data.height}
          onChange={e => onChange({ height: e.target.value })}
          placeholder="—"
        />
      </div>
      <p className="kk-note" style={{ marginTop: 4 }}>
        Данные биографии можно изменить позже в карточке персонажа.
      </p>
    </div>
  );
}
