import { useState, useEffect, useRef } from "react";
import { FACULTIES } from "../lib/seed-faculties";
import { SKILLS_DATA } from "../lib/seed-skills";
import { DICE, ATTR_ORDER, ATTR_LABEL, ATTR_SHORT, CAT_LABEL, SKILL_BY_NAME } from "../lib/constants";
import { getGmNotes, saveGmNotes } from "../lib/db";
import { resizePortrait, validatePortraitFile } from "../lib/storage";

function mergeFacultySkills(skills, fac) {
  const have = new Set(skills.map(s => s.name));
  const add = (fac.abilities || []).filter(n => !have.has(n)).map(n => {
    const r = SKILL_BY_NAME[n];
    return { name: n, attr: r?.attr || "smarts", categ: r?.categ || "learned", die: 4, modifier: -2 };
  });
  return [...skills, ...add];
}

export default function EditCard({ ch, campaignId, onSave, onCancel }) {
  const [d, setD] = useState(() => structuredClone(ch));
  const [gmNotes, setGmNotes] = useState("");
  const [gmNotesLoading, setGmNotesLoading] = useState(true);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    getGmNotes(campaignId, ch.id).then(text => {
      setGmNotes(text);
      setGmNotesLoading(false);
    }).catch(() => setGmNotesLoading(false));
  }, [campaignId, ch.id]);

  async function handlePortraitFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validatePortraitFile(file);
    if (err) { setUploadError(err); return; }
    setUploadError("");
    setUploading(true);
    try {
      const dataUrl = await resizePortrait(file);
      setD(p => ({ ...p, portrait: dataUrl }));
    } catch (e) {
      setUploadError("Ошибка: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  const set = (patch) => setD(p => ({ ...p, ...patch }));
  const setAttr = (k, f, v) => setD(p => ({ ...p, attributes: { ...p.attributes, [k]: { ...p.attributes[k], [f]: v } } }));
  const setSkill = (i, f, v) => setD(p => { const sk = [...p.skills]; sk[i] = { ...sk[i], [f]: v }; return { ...p, skills: sk }; });
  const removeSkill = (i) => setD(p => ({ ...p, skills: p.skills.filter((_, j) => j !== i) }));
  const addSkill = (name) => {
    if (!name) return;
    const r = SKILL_BY_NAME[name];
    setD(p => ({ ...p, skills: [...p.skills, { name, attr: r?.attr || "smarts", categ: r?.categ || "learned", die: 4, modifier: -2 }] }));
  };
  const pickFaculty = (f) => setD(p => ({ ...p, faculty: { name: f.name, key: f.key, color: f.color }, skills: mergeFacultySkills(p.skills, f) }));

  const [cName, setCName] = useState("");
  const [cAttr, setCAttr] = useState("smarts");
  const [cCat, setCCat] = useState("learned");
  const addCustom = () => {
    const n = cName.trim();
    if (!n) return;
    if (d.skills.some(s => s.name === n)) { alert("Навык с таким именем уже есть"); return; }
    setD(p => ({ ...p, skills: [...p.skills, { name: n, attr: cAttr, categ: cCat, die: 4, modifier: -2, custom: true }] }));
    setCName("");
  };

  const present = new Set(d.skills.map(s => s.name));
  const addable = SKILLS_DATA.map(s => s.name).filter(n => !present.has(n));

  function commit() {
    saveGmNotes(campaignId, ch.id, gmNotes).catch(e => console.error("gmNotes save", e));
    onSave({
      name: d.name,
      portrait: d.portrait || "",
      age: Number(d.age) || 0,
      academyYear: String(d.academyYear),
      semester: Number(d.semester) || 1,
      gender: d.gender || "",
      birthplace: d.birthplace || "",
      dormitory: d.dormitory || "",
      height: d.height || "",
      build: d.build || "",
      allergies: d.allergies || "",
      weaknesses: d.weaknesses || "",
      biography: d.biography || "",
      faculty: d.faculty,
      attributes: d.attributes,
      skills: d.skills,
      money: Number(d.money) || 0,
      experience: Number(d.experience) || 0,
      "tension.current": Number(d.tension?.current) || 0,
      "tension.overcap": Number(d.tension?.overcap) || 0,
      "tension.energyPenalty": Number(d.tension?.energyPenalty) || 0,
      overflow_damage: Number(d.overflow_damage) || 0,
    });
  }

  const tension = d.tension || { current: 0, overcap: 0, energyPenalty: 0, max: 0 };

  return (
    <div className="kk-edit">
      <div className="kk-edit-bar">
        <span className="kk-edit-title">Ручная редактура · {d.name}</span>
        <div className="kk-edit-actions">
          <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
          <button className="kk-btn primary" onClick={commit}>Сохранить</button>
        </div>
      </div>

      <section className="kk-block">
        <h2 className="kk-h2">Профиль</h2>
        <div className="kk-portrait-upload" style={{ marginBottom: 12 }}>
          {d.portrait && (
            <img
              className="kk-portrait-preview"
              src={d.portrait}
              alt="портрет"
              onError={e => { e.target.style.display = "none"; }}
            />
          )}
          <div className="kk-portrait-controls">
            <button type="button" className="kk-btn ghost sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "Обработка…" : "Загрузить файл"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: "none" }} onChange={handlePortraitFile}/>
          </div>
          {uploadError && <p className="kk-error" style={{ margin: "4px 0 0" }}>{uploadError}</p>}
          <label className="kk-field" style={{ marginTop: 6 }}>
            <span>URL портрета</span>
            <input className="kk-input" value={d.portrait || ""} onChange={e => set({ portrait: e.target.value })} placeholder="https://…" disabled={uploading}/>
          </label>
        </div>
        <div className="kk-form-grid">
          <label className="kk-field"><span>Имя</span><input className="kk-input" value={d.name} onChange={e => set({ name: e.target.value })}/></label>
          <label className="kk-field"><span>Возраст</span><input className="kk-input" type="number" value={d.age} onChange={e => set({ age: e.target.value })}/></label>
          <label className="kk-field"><span>Курс</span><input className="kk-input" value={d.academyYear} onChange={e => set({ academyYear: e.target.value })}/></label>
          <label className="kk-field"><span>Семестр</span>
            <select className="kk-input" value={d.semester} onChange={e => set({ semester: e.target.value })}>
              <option value={1}>1</option><option value={2}>2</option>
            </select>
          </label>
          <label className="kk-field"><span>Деньги</span><input className="kk-input" type="number" value={d.money} onChange={e => set({ money: e.target.value })}/></label>
          <label className="kk-field"><span>Опыт</span><input className="kk-input" type="number" value={d.experience} onChange={e => set({ experience: e.target.value })}/></label>
        </div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Демография</h2>
        <div className="kk-form-grid">
          <label className="kk-field"><span>Пол</span><input className="kk-input" value={d.gender || ""} onChange={e => set({ gender: e.target.value })}/></label>
          <label className="kk-field"><span>Место рождения</span><input className="kk-input" value={d.birthplace || ""} onChange={e => set({ birthplace: e.target.value })}/></label>
          <label className="kk-field"><span>Общежитие</span><input className="kk-input" value={d.dormitory || ""} onChange={e => set({ dormitory: e.target.value })}/></label>
          <label className="kk-field"><span>Рост</span><input className="kk-input" value={d.height || ""} onChange={e => set({ height: e.target.value })}/></label>
          <label className="kk-field"><span>Телосложение</span><input className="kk-input" value={d.build || ""} onChange={e => set({ build: e.target.value })}/></label>
          <label className="kk-field"><span>Аллергии</span><input className="kk-input" value={d.allergies || ""} onChange={e => set({ allergies: e.target.value })}/></label>
          <label className="kk-field kk-field-wide"><span>Слабости</span><input className="kk-input" value={d.weaknesses || ""} onChange={e => set({ weaknesses: e.target.value })}/></label>
        </div>
        <div className="kk-form-col" style={{ marginTop: "10px" }}>
          <label className="kk-field">
            <span>Биография</span>
            <textarea className="kk-input kk-textarea" rows={4} value={d.biography || ""} onChange={e => set({ biography: e.target.value })}/>
          </label>
        </div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Напряжение · Состояние</h2>
        <div className="kk-form-grid">
          <label className="kk-field"><span>Напряжение текущее</span><input className="kk-input" type="number" min={0} value={tension.current} onChange={e => setD(p => ({ ...p, tension: { ...p.tension, current: Number(e.target.value) || 0 } }))}/></label>
          <label className="kk-field"><span>Перегруз</span><input className="kk-input" type="number" min={0} value={tension.overcap} onChange={e => setD(p => ({ ...p, tension: { ...p.tension, overcap: Number(e.target.value) || 0 } }))}/></label>
          <label className="kk-field"><span>Штраф к Энергии</span><input className="kk-input" type="number" min={0} value={tension.energyPenalty} onChange={e => setD(p => ({ ...p, tension: { ...p.tension, energyPenalty: Number(e.target.value) || 0 } }))}/></label>
          <label className="kk-field"><span>Переполнение урона</span><input className="kk-input" type="number" min={0} value={d.overflow_damage || 0} onChange={e => set({ overflow_damage: Number(e.target.value) || 0 })}/></label>
        </div>
        <p className="kk-note">Напряжение и перегруз — обычно меняются автоматически при бросках. Здесь ГМ может скорректировать вручную.</p>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Факультет</h2>
        <div className="kk-fac-grid">{FACULTIES.map(f => (
          <button key={f.key} className={`kk-fac-chip ${d.faculty?.key === f.key ? "on" : ""}`} style={{ ["--c"]: f.color }} onClick={() => pickFaculty(f)}>
            <span className="kk-fac-dot"/><span>{f.name.replace(" факультет", "")}</span>
          </button>
        ))}</div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Атрибуты</h2>
        <div className="kk-attrs-edit">{ATTR_ORDER.map(k => (
          <div className="kk-attr-edit" key={k}>
            <span className="kk-attr-name">{ATTR_LABEL[k]}</span>
            <select className="kk-input sm" value={d.attributes[k].die} onChange={e => setAttr(k, "die", Number(e.target.value))}>
              {DICE.map(x => <option key={x} value={x}>d{x}</option>)}
            </select>
            <input className="kk-input sm" type="number" value={d.attributes[k].modifier} onChange={e => setAttr(k, "modifier", Number(e.target.value))} title="модификатор"/>
          </div>
        ))}</div>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Навыки <span className="kk-count">{d.skills.length}</span></h2>
        <div className="kk-skills-edit">{d.skills.map((s, i) => (
          <div className="kk-skill-edit" key={s.name + i}>
            <span className="kk-skill-name" title={s.name}>{s.name}{s.custom && <span className="kk-custom-tag">свой</span>}</span>
            <span className="kk-skill-attr2">{ATTR_SHORT[s.attr]}</span>
            <select className="kk-input sm" value={s.die} onChange={e => setSkill(i, "die", Number(e.target.value))}>
              {DICE.map(x => <option key={x} value={x}>d{x}</option>)}
            </select>
            <input className="kk-input sm" type="number" value={s.modifier} onChange={e => setSkill(i, "modifier", Number(e.target.value))} title="модификатор"/>
            <button className="kk-x" onClick={() => removeSkill(i)} title="убрать">✕</button>
          </div>
        ))}</div>
        <div className="kk-add-skill">
          <select className="kk-input" defaultValue="" onChange={e => { addSkill(e.target.value); e.target.value = ""; }}>
            <option value="" disabled>+ добавить существующий навык…</option>
            {addable.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="kk-custom-skill">
          <span className="kk-custom-label">Кастомный навык:</span>
          <input className="kk-input sm" placeholder="название" value={cName} onChange={e => setCName(e.target.value)} style={{ width: "160px" }}/>
          <select className="kk-input sm" value={cAttr} onChange={e => setCAttr(e.target.value)}>
            {ATTR_ORDER.map(k => <option key={k} value={k}>{ATTR_LABEL[k]}</option>)}
          </select>
          <select className="kk-input sm" value={cCat} onChange={e => setCCat(e.target.value)}>
            {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="kk-btn ghost sm" onClick={addCustom}>+ добавить</button>
        </div>
        <p className="kk-note">Категория кастомного навыка задаёт множитель цены прокачки.</p>
      </section>

      <section className="kk-block">
        <h2 className="kk-h2">Заметки ГМ <span className="kk-note">(не видны игроку)</span></h2>
        <textarea
          className="kk-input kk-textarea"
          rows={4}
          value={gmNotesLoading ? "" : gmNotes}
          placeholder={gmNotesLoading ? "Загрузка…" : ""}
          disabled={gmNotesLoading}
          onChange={e => setGmNotes(e.target.value)}
        />
      </section>

      <div className="kk-edit-foot">
        <button className="kk-btn ghost" onClick={onCancel}>Отмена</button>
        <button className="kk-btn primary" onClick={commit}>Сохранить</button>
      </div>
    </div>
  );
}
