import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCharacter, saveCharacterDebounced, updateCharacterNow, saveChargenRequest, addLogEntry,
} from "../lib/db";
import { enrichPatch } from "../lib/derive";
import { CAMPAIGN_ID } from "../lib/config";
import { buildBaseSkills } from "../lib/seed-skills";
import { skillPointsSpent, DEFAULT_BACKGROUNDS } from "../lib/chargen";
import StepIdentity from "./wizard/StepIdentity";
import StepAttributes from "./wizard/StepAttributes";
import StepSkills from "./wizard/StepSkills";
import StepBackgrounds from "./wizard/StepBackgrounds";
import StepReview from "./wizard/StepReview";

const STEP_LABELS = ["Личность", "Атрибуты", "Навыки", "Бэкграунды", "Итог"];

function parseBackgrounds(campaign) {
  try {
    const raw = campaign?.chargen?.backgrounds;
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  return DEFAULT_BACKGROUNDS;
}

export default function CharacterCreationWizard({ user, myChar, campaign }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [charId, setCharId] = useState(myChar?.id || null);
  const [initializing, setInitializing] = useState(myChar?.id == null);
  const [saving, setSaving] = useState(false);

  // Step 0 — Identity (no dormitory per IMP-08)
  const [identity, setIdentity] = useState({
    name:       myChar?.name       || "",
    portrait:   myChar?.portrait   || "",
    age:        myChar?.age        ?? 15,
    gender:     myChar?.gender     || "",
    birthplace: myChar?.birthplace || "",
    height:     myChar?.height     || "",
  });

  // Step 1 — Attributes
  const [attrDice, setAttrDice] = useState({
    agility:   myChar?.attributes?.agility?.die   ?? 4,
    smarts:    myChar?.attributes?.smarts?.die    ?? 4,
    spirit:    myChar?.attributes?.spirit?.die    ?? 4,
    endurance: myChar?.attributes?.endurance?.die ?? 4,
    magic:     myChar?.attributes?.magic?.die     ?? 4,
  });
  const [attrSave, setAttrSave] = useState(false);

  // Step 2 — Skills: raises as {name: {die, modifier}}
  const [currentSkills] = useState(
    () => myChar?.skills?.length > 0 ? [...myChar.skills] : buildBaseSkills()
  );
  const [skillRaises, setSkillRaises] = useState(() => {
    if (!myChar?.skills) return {};
    const result = {};
    for (const s of myChar.skills) {
      if (s.die > 4 || (s.modifier ?? -2) > -2) {
        result[s.name] = { die: s.die, modifier: s.modifier ?? -2 };
      }
    }
    return result;
  });
  const [specCount, setSpecCount] = useState(0);

  // Step 3 — Backgrounds
  const [bgSelections, setBgSelections] = useState({});

  // Chargen settings from campaign (FEAT-09 keys)
  const attrBudget   = campaign?.chargen?.points?.attributes   ?? 5;
  const skillBudget  = campaign?.chargen?.points?.skills        ?? 10;
  const maxDie       = campaign?.chargen?.attr?.maxDie          ?? 8;   // BUG-04 fixed
  const attrToSkill  = campaign?.chargen?.convert?.attrToSkill  ?? 5;
  const specCost     = campaign?.chargen?.special?.cost         ?? 3;
  const specMax      = campaign?.chargen?.special?.max          ?? 1;
  const maxSave      = campaign?.chargen?.skills?.maxSave       ?? 2;
  const backgrounds  = parseBackgrounds(campaign);

  // Effective skill budget includes attrSave bonus
  const effectiveSkillBudget = skillBudget + (attrSave ? attrToSkill : 0);

  // Points spent on skills
  const totalSkillSpent = currentSkills.reduce((sum, s) => {
    const raise = skillRaises[s.name];
    if (!raise) return sum;
    return sum + skillPointsSpent(s.die, s.modifier, raise.die, raise.modifier);
  }, 0);
  const specTotalCost = specCount * specCost;
  const skillRemaining = effectiveSkillBudget - totalSkillSpent - specTotalCost;
  const skillSave = Math.min(Math.max(skillRemaining, 0), maxSave);

  // Create character doc on first mount if no myChar
  useEffect(() => {
    if (charId) return;
    const newId = crypto.randomUUID();
    createCharacter(CAMPAIGN_ID, newId, { name: "", ownerUid: user.uid })
      .then(() => { setCharId(newId); setInitializing(false); })
      .catch(e => console.error("wizard: createCharacter failed", e));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function saveIdentityDebounced(patch) {
    if (!charId) return;
    const stub = { attributes: { spirit: { die: attrDice.spirit } }, age: patch.age ?? identity.age, skills: [] };
    saveCharacterDebounced(CAMPAIGN_ID, charId, enrichPatch(stub, patch));
  }

  function handleIdentityChange(patch) {
    const next = { ...identity, ...patch };
    setIdentity(next);
    saveIdentityDebounced(patch);
  }

  function handleAttrChange(newDice) {
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
  }

  function handleSkillRaiseChange(newRaises) {
    setSkillRaises(newRaises);
    if (!charId) return;
    const mergedSkills = currentSkills.map(s => {
      const raise = newRaises[s.name];
      return raise ? { ...s, die: raise.die, modifier: raise.modifier } : s;
    });
    const stub = { attributes: { spirit: { die: attrDice.spirit } }, age: identity.age, skills: mergedSkills };
    saveCharacterDebounced(CAMPAIGN_ID, charId, enrichPatch(stub, { skills: mergedSkills }));
  }

  const finalSkills = currentSkills.map(s => {
    const raise = skillRaises[s.name];
    return raise ? { ...s, die: raise.die, modifier: raise.modifier } : s;
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
      const age = Number(identity.age) || 15;
      const stub = { attributes: attrs, age, skills: finalSkills };
      const patch = {
        name:       identity.name.trim(),
        portrait:   identity.portrait,
        age,
        gender:     identity.gender,
        birthplace: identity.birthplace,
        height:     identity.height,
        attributes: attrs,
        skills:     finalSkills,
        characterCreated: true,
      };
      await updateCharacterNow(CAMPAIGN_ID, charId, enrichPatch(stub, patch));

      // Save GM requests if any
      const chosenBgs = Object.entries(bgSelections)
        .filter(([, v]) => v.selected)
        .map(([key, v]) => ({ key, label: backgrounds.find(b => b.key === key)?.label || key, notes: v.notes || "" }));
      if (specCount > 0 || chosenBgs.length > 0) {
        await saveChargenRequest(CAMPAIGN_ID, charId, {
          actorName:   identity.name.trim(),
          specCount,
          backgrounds: chosenBgs,
        });
      }

      // Write creation log entry for GM (issue 4)
      await addLogEntry(CAMPAIGN_ID, charId, {
        type:       "chargen_created",
        actorName:  identity.name.trim(),
        identity: {
          age:        Number(identity.age) || 15,
          gender:     identity.gender,
          birthplace: identity.birthplace,
          height:     identity.height,
        },
        attributes: Object.fromEntries(
          Object.entries(attrs).map(([k, v]) => [k, `d${v.die}`])
        ),
        attrSave,
        skills: finalSkills.map(s => ({
          name:     s.name,
          attr:     s.attr,
          die:      s.die,
          modifier: s.modifier,
        })),
        specCount,
        backgrounds: chosenBgs,
      });

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
        {step === 0 && (
          <StepIdentity data={identity} onChange={handleIdentityChange} />
        )}
        {step === 1 && (
          <StepAttributes
            attrDice={attrDice}
            onChange={handleAttrChange}
            budget={attrBudget}
            maxDie={maxDie}
            attrSave={attrSave}
            onAttrSave={setAttrSave}
            attrToSkill={attrToSkill}
          />
        )}
        {step === 2 && (
          <StepSkills
            skills={currentSkills}
            skillRaises={skillRaises}
            onChange={handleSkillRaiseChange}
            budget={effectiveSkillBudget}
            maxDie={maxDie}
            attrDice={attrDice}
            specCount={specCount}
            onSpecCount={setSpecCount}
            specCost={specCost}
            specMax={specMax}
          />
        )}
        {step === 3 && (
          <StepBackgrounds
            backgrounds={backgrounds}
            bgBudget={skillSave}
            selections={bgSelections}
            onChange={setBgSelections}
          />
        )}
        {step === 4 && (
          <StepReview
            identity={identity}
            attrDice={attrDice}
            skills={finalSkills}
            specCount={specCount}
            bgSelections={bgSelections}
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
          <button className="kk-btn primary" onClick={() => setStep(s => s + 1)}>
            Далее →
          </button>
        )}
      </div>
    </div>
  );
}
