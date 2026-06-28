import { useState } from "react";
import "../styles/theme-explorer.css";

const THEMES = [
  { key: "original",      label: "Original", bg: "#181410", accent: "#c8a14e", tone: "dark" },
  { key: "parchment",     label: "Parchment", bg: "#efe6d4", accent: "#b08526", tone: "light" },
  { key: "arcane",        label: "Arcane", bg: "#0f1226", accent: "#5fd3e6", tone: "dark" },
  { key: "arcane-light",  label: "Arcane", bg: "#eef1fb", accent: "#2c8aa0", tone: "light" },
  { key: "verdant",       label: "Verdant", bg: "#0f1a14", accent: "#4fc07e", tone: "dark" },
  { key: "verdant-light", label: "Verdant", bg: "#eef4ec", accent: "#2f9b5e", tone: "light" },
  { key: "blood",         label: "Blood", bg: "#16100f", accent: "#d9534a", tone: "dark" },
  { key: "blood-light",   label: "Blood", bg: "#f6ece9", accent: "#c23a32", tone: "light" },
];

function ThemePreview() {
  const [hp, setHp] = useState(14);
  const [armor, setArmor] = useState(3);
  const [focus, setFocus] = useState(5);
  const [grit, setGrit] = useState(5);
  const [nerve, setNerve] = useState(7);

  const step = (val, delta, max) => Math.max(0, max != null ? Math.min(max, val + delta) : val + delta);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "26px 22px 64px", display: "flex", flexDirection: "column", gap: 26 }}>

      {/* App top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <button className="kk-logo">КК<span>9</span></button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="kk-btn ghost sm">Ростер</button>
          <button className="kk-btn primary sm">Прокачка</button>
        </div>
      </div>

      {/* Campaign card */}
      <div className="kk-campaign">
        <div className="kk-campaign-name">
          Пустая корона
          <span className="kk-gm-badge">GM</span>
        </div>
        <div className="kk-campaign-meta">
          <span>Daggerheart</span>
          <span style={{ color: "var(--kk-line)" }}>·</span>
          <span>4 игрока</span>
          <span style={{ color: "var(--kk-line)" }}>·</span>
          <span>Сессия 12 · идёт</span>
        </div>
      </div>

      {/* Party */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="kk-h2">
          <span>Активная партия <span className="kk-count">4</span></span>
          <button className="kk-btn ghost sm">Управление</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 10 }}>
          {[
            { name: "Бринн Вэйл", sub: "Страж", color: "var(--kk-gold)" },
            { name: "Соррел",     sub: "Маг",   color: "var(--kk-tension)" },
            { name: "Кэл Дорн",   sub: "Плут",  color: "var(--kk-danger)" },
            { name: "Мира",       sub: "Бард",  color: "var(--kk-gold)", self: true },
          ].map(c => (
            <button key={c.name} className={`kk-party-card${c.self ? " self" : ""}`} style={{ "--fac-color": c.color }}>
              <div className="kk-party-av">{c.name[0]}</div>
              <div className="kk-party-name">{c.name}</div>
              {c.self && <div className="kk-party-you">вы</div>}
              <div className="kk-party-sub">{c.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Character sheet */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="kk-h2">
          <span>Активный персонаж</span>
          <span style={{ fontFamily: "var(--kk-font-b)", textTransform: "uppercase", letterSpacing: ".14em", fontSize: 11, fontWeight: 600, color: "var(--kk-text-faint)" }}>Ур. 5</span>
        </div>

        {/* Portrait + name */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="kk-portrait">
            <div className="kk-portrait-ph">М</div>
          </div>
          <div className="kk-head-main">
            <div className="kk-name">Мира Эшфорд</div>
            <div className="kk-head-tags">
              <span style={{ color: "var(--kk-gold)", fontWeight: 600 }}>Бард</span>
              <span className="kk-sep">·</span>
              <span>Странник</span>
              <span className="kk-sep">·</span>
              <span style={{ color: "var(--kk-danger)" }}>Ранена</span>
            </div>
            <div className="kk-head-econ">
              <span className="kk-econ">42 монеты</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
          {[
            { label: "Здоровье", val: hp,    max: 18, set: setHp,    accent: "var(--kk-gold-bright)" },
            { label: "Броня",    val: armor, max: 6,  set: setArmor, accent: null },
            { label: "Фокус",   val: focus,  max: 6,  set: setFocus, accent: "var(--kk-tension)" },
          ].map(s => (
            <div key={s.label} className="kk-stat" style={s.accent ? { "--local-accent": s.accent } : {}}>
              <div className="kk-stat-label">{s.label}</div>
              <div className="kk-stat-row">
                <button className="kk-step" onClick={() => s.set(v => step(v, -1, s.max))}>−</button>
                <span className="kk-stat-val">{s.val}</span>
                {s.max != null && <span className="kk-stat-max">/ {s.max}</span>}
                <button className="kk-step" onClick={() => s.set(v => step(v, 1, s.max))}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontFamily: "var(--kk-font-b)", textTransform: "uppercase", letterSpacing: ".14em", fontSize: 11, fontWeight: 600, color: "var(--kk-text-faint)" }}>Состояния</span>
          <div className="kk-status-bar">
            {["✨ Благословлён", "☠ Отравлен", "⚡ Воодушевлён"].map(s => (
              <div key={s} className="kk-status-chip">
                <span className="kk-status-chip-name">{s}</span>
              </div>
            ))}
            <button className="kk-status-add">+</button>
          </div>
        </div>

        {/* Health tracks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Стойкость", attr: "Сила", die: 8,  val: grit,  set: setGrit,  max: 6 },
            { label: "Выдержка",  attr: "Дух",  die: 10, val: nerve, set: setNerve, max: 6 },
          ].map(t => (
            <div key={t.label} className="kk-track">
              <div className="kk-track-head">
                <span className="kk-track-name">{t.label}</span>
                <span className="kk-track-meta">{t.attr} d{t.die} · {t.val}/{t.max}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: t.max }).map((_, i) => (
                  <div
                    key={i}
                    onClick={() => t.set(i < t.val ? i : i + 1)}
                    style={{
                      flex: 1, height: 16, borderRadius: 4, cursor: "pointer",
                      background: i < t.val ? "var(--kk-gold)" : "var(--kk-cell-empty)",
                      border: "1px solid " + (i < t.val ? "var(--kk-gold-bright)" : "var(--kk-cell-line)"),
                      transition: "background .12s",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Buttons + input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="kk-input" placeholder="Заметка для следующей сессии…" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="kk-btn primary">Сохранить</button>
            <button className="kk-btn ghost">Бросок</button>
            <button className="kk-btn danger">Урон</button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="kk-h2">
          <span>Журнал квестов <span className="kk-count">0</span></span>
        </div>
        <div className="kk-empty">Квесты не записаны.</div>
      </div>

    </div>
  );
}

export default function ThemeExplorer() {
  const [theme, setTheme] = useState("original");

  return (
    <div style={{ minHeight: "100vh", background: "#14161b", fontFamily: "var(--kk-font-b, system-ui, sans-serif)" }}>
      <header style={{
        position: "sticky", top: 0, zIndex: 20, background: "#15181f",
        borderBottom: "1px solid #262b36", padding: "14px 22px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 18, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f2f4f8", letterSpacing: ".01em" }}>
            KK9 · Theme Explorer
          </div>
          <div style={{ fontSize: 12, color: "#7f8696" }}>
            Один экран, восемь палитр — выберите схему.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {THEMES.map(t => {
            const active = t.key === theme;
            return (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 12px 6px 8px", borderRadius: 9,
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  color: active ? "#f2f4f8" : "#aab0bd",
                  background: active ? "#222732" : "transparent",
                  border: active ? "1px solid #3a4252" : "1px solid #262b36",
                  boxShadow: active ? `0 0 0 1px ${t.accent} inset, 0 2px 8px rgba(0,0,0,.3)` : "none",
                  transition: "background .15s, color .15s, border-color .15s",
                }}
              >
                <span style={{ display: "inline-flex", borderRadius: 5, overflow: "hidden", border: "1px solid rgba(255,255,255,.18)" }}>
                  <span style={{ width: 12, height: 18, background: t.bg, display: "block" }} />
                  <span style={{ width: 12, height: 18, background: t.accent, display: "block" }} />
                </span>
                <span>{t.label}</span>
                <span style={{ fontSize: 11, opacity: active ? 0.95 : 0.55, color: t.tone === "light" ? "#e7b34a" : "#8e9bb5" }}>
                  {t.tone === "light" ? "☀" : "☽"}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className={theme !== "original" ? `te-theme-${theme}` : ""}>
        <div className="kk-root">
          <div className="kk-bg" aria-hidden />
          <ThemePreview />
        </div>
      </div>
    </div>
  );
}
