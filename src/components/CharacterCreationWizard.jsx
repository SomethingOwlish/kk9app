import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCharacter, saveCharacterDebounced, updateCharacterNow,
  setFaculty as dbSetFaculty,
} from "../lib/db";
import { enrichPatch } from "../lib/derive";
import { CAMPAIGN_ID } from "../lib/config";
import { SKILLS_DATA, buildBaseSkills } from "../lib/seed-skills";
import StepIdentity from "./wizard/StepIdentity";
import StepFaculty from "./wizard/StepFaculty";
import StepAttributes from "./wizard/StepAttributes";
import StepSkills from "./wizard/StepSkills";
import StepReview from "./wizard/StepReview";

const STEP_LABELS = ["Личность", "Факультет", "Атрибуты", "Навыки", "Итог"];
const SKILL_BY_NAME = Object.fromEntries(SKILLS_DATA.map(s => [s.name, s]));

function mergeSkillsWithFaculty(baseSkills, fac) {
  if (!fac) return baseSkills;
  const have = new Set(baseSkills.map(s => s.name));
  const additions = (fac.abilities || [])
    .filter(n => !have.has(n))
    .map(n => {
      const ref = SKILL_BY_NAME[n];
      return { name: n, attr: ref?.attr || "smarts", categ: ref?.categ || "learned", die: 4, modifier: -2 };
    });
  return [...baseSkills, ...additions];
}

export default function CharacterCreationWizard({ user, myChar, campaign }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [charId, setCharId] = useState(myChar?.id || null);
  const [initializing, setInitializing] = useState(myChar?.id == null);
  const [saving, setSaving] = useState(false);

  const [identity, setIdentity] = useState({
    name: myChar?.name || "",
    portrait: myChar?.portrait || "",
    age: myChar?.age ?? 15,
    gender: myChar?.gender || "",
    birthplace: myChar?.birthplace || "",
    dormitory: myChar?.dormitory || "",
    height: myChar?.height || "",
  });

  const [chosenFaculty, setChosenFaculty] = useState(
    myChar?.faculty?.key
      ? { key: myChar.faculty.key, name: myChar.faculty.name, color: myChar.faculty.color, abilities: [] }
      : null
  );

  const [currentSkills, setCurrentSkills] = useState(
    () => myChar?.skills?.length > 0 ? [...myChar.skills] : buildBaseSkills()
  );

  const [attrDice, setAttrDice] = useState({
    agility:   myChar?.attributes?.agility?.die   ?? 4,
    smarts:    myChar?.attributes?.smarts?.die    ?? 4,
    spirit:    myChar?.attributes?.spirit?.die    ?? 4,
    endurance: myChar?.attributes?.endurance?.die ?? 4,
    magic:     myChar?.attributes?.magic?.die     ?? 4,
  });

  const [skillRaises, setSkillRaises] = useState(() => {
    if (!myChar?.skills) return {};
    const result = {};
    for (const s of myChar.skills) {
      if (s.die > 4) result[s.name] = s.die;
    }
    return result;
  });

  const attrBudget = campaign?.chargen?.points?.attributes ?? 5;
  const skillBudget = campaign?.chargen?.points?.skills ?? 10;
  const maxDie = campaign?.chargen?.maxDie ?? 12;

  useEffect(() => {
    if (charId) return;
    const newId = crypto.randomUUID();
    createCharacter(CAMPAIGN_ID, newId, { name: "", ownerUid: user.uid })
      .then(() => { setCharId(newId); setInitializing(false); })
      .catch(e => console.error("wizard: createCharacter failed", e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIdentityChange = useCallback((patch) => {
    setIdentity(prev => {
      const next = { ...prev, ...patch };
      if (charId) {
        const stub = { attributes: { spirit: { die: attrDice.spirit } }, age: next.age, skills: [] };
        saveCharacterDebounced(CAMPAIGN_ID, charId, enrichPatch(stub, patch));
      }
      return next;
    });
  }, [charId, attrDice.spirit]);

  const handleFacultyChoose = useCallback(async (fac) => {
    setChosenFaculty(fac);
    const merged = mergeSkillsWithFaculty(buildBaseSkills(), fac);
    setCurrentSkills(merged);
    if (charId) {
      await dbSetFaculty(CAMPAIGN_ID, charId, fac, buildBaseSkills());
    }
  }, [charId]);

  const handleAttrChange = useCallback((newDice) => {
    setAttrDice(newDice);
    if (!charId) return;
    const attrs = {
      agility:   { die: newDice.agility,   modifier: 0 },
      smarts:    { die: newDice.smarts,    modifier: 0 },
      spirit:    { die: newDice.spirit,    modifier: 0 },
      endurance: { die: newDice.endurance, modifier: 0 },
      magic:     { die: newDice.magic,     modifier: 0 },
    };
    const stub = { attributes: attrs, age: identity.age, skills: currentSkills };
    saveCharacterDebounced(CAMPAIGN_ID, charId, enrichPatch(stub, { attributes: attrs }));
  }, [charId, identity.age, currentSkills]);

  const handleSkillRaiseChange = useCallback((newRaises) => {
    setSkillRaises(newRaises);
    if (!charId) return;
    const mergedSkills = currentSkills.map(s => {
      const raisedDie = newRaises[s.name];
      return raisedDie ? { ...s, die: raisedDie } : s;
    });
    const stub = { attributes: { spirit: { die: attrDice.spirit } }, age: identity.age, skills: mergedSkills };
    saveCharacterDebounced(CAMPAIGN_ID, charId, enrichPatch(stub, { skills: mergedSkills }));
  }, [charId, currentSkills, attrDice.spirit, identity.age]);

  const finalSkills = currentSkills.map(s => {
    const raisedDie = skillRaises[s.name];
    return raisedDie ? { ...s, die: raisedDie } : s;
  });

  async function handleConfirm() {
    if (!charId || !identity.name.trim()) return;
    setSaving(true);
    try {
      const attrs = {
        agility:   { die: attrDice.agility,   modifier: 0 },
        smarts:    { die: attrDice.smarts,    modifier: 0 },
        spirit:    { die: attrDice.spirit,    modifier: 0 },
        endurance: { die: attrDice.endurance, modifier: 0 },
        magic:     { die: attrDice.magic,     modifier: 0 },
      };
      const stub = { attributes: attrs, age: Number(identity.age) || 15, skills: finalSkills };
      const patch = {
        name: identity.name.trim(),
        portrait: identity.portrait,
        age: Number(identity.age) || 15,
        gender: identity.gender,
        birthplace: identity.birthplace,
        dormitory: identity.dormitory,
        height: identity.height,
        attributes: attrs,
        skills: finalSkills,
        characterCreated: true,
      };
      await updateCharacterNow(CAMPAIGN_ID, charId, enrichPatch(stub, patch));
      navigate("/");
    } catch (e) {
      alert("Не удалось сохранить: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  if (initializing) {
    return <div className="kk-load">Создаём персонажа…</div>;
  }

  return (
    <div className="kk-wizard">
      <div className="kk-wizard-steps">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            className={`kk-wiz-step-btn${i === step ? " active" : ""}${i < step ? " done" : ""}`}
            onClick={() => i < step && setStep(i)}
          >
            <span className="kk-wiz-step-num">{i + 1}</span>
            <span className="kk-wiz-step-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="kk-wizard-body">
        {step === 0 && <StepIdentity data={identity} onChange={handleIdentityChange} />}
        {step === 1 && <StepFaculty chosen={chosenFaculty} onChoose={handleFacultyChoose} />}
        {step === 2 && (
          <StepAttributes
            attrDice={attrDice}
            onChange={handleAttrChange}
            budget={attrBudget}
            maxDie={maxDie}
          />
        )}
        {step === 3 && (
          <StepSkills
            skills={currentSkills}
            skillRaises={skillRaises}
            onChange={handleSkillRaiseChange}
            budget={skillBudget}
            maxDie={maxDie}
          />
        )}
        {step === 4 && (
          <StepReview
            identity={identity}
            faculty={chosenFaculty}
            attrDice={attrDice}
            skills={finalSkills}
            saving={saving}
            onConfirm={handleConfirm}
          />
        )}
      </div>

      <div className="kk-wizard-nav">
        {step > 0 && (
          <button className="kk-btn ghost" onClick={() => setStep(s => s - 1)}>
            ← Назад
          </button>
        )}
        {step < STEP_LABELS.length - 1 && (
          <button
            className="kk-btn primary"
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && !chosenFaculty}
          >
            Далее →
          </button>
        )}
      </div>
    </div>
  );
}
