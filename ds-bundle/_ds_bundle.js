/* @ds-bundle: {"namespace":"Asgard","components":[{"name":"Badge","sourcePath":"components/general/Badge/Badge.jsx"},{"name":"Button","sourcePath":"components/general/Button/Button.jsx"},{"name":"CampaignCard","sourcePath":"components/general/CampaignCard/CampaignCard.jsx"},{"name":"EmptyState","sourcePath":"components/general/EmptyState/EmptyState.jsx"},{"name":"HealthTrack","sourcePath":"components/general/HealthTrack/HealthTrack.jsx"},{"name":"Input","sourcePath":"components/general/Input/Input.jsx"},{"name":"Modal","sourcePath":"components/general/Modal/Modal.jsx"},{"name":"PartyCard","sourcePath":"components/general/PartyCard/PartyCard.jsx"},{"name":"PartyRow","sourcePath":"components/general/PartyRow/PartyRow.jsx"},{"name":"Root","sourcePath":"components/general/Root/Root.jsx"},{"name":"SectionHeader","sourcePath":"components/general/SectionHeader/SectionHeader.jsx"},{"name":"Stat","sourcePath":"components/general/Stat/Stat.jsx"},{"name":"StatusBar","sourcePath":"components/general/StatusBar/StatusBar.jsx"},{"name":"Tip","sourcePath":"components/general/Tip/Tip.jsx"}],"sourceHashes":{"components/general/Badge/Badge.jsx":"25d48e618cfd","components/general/Badge/Badge.d.ts":"4dcf1f0853bb","components/general/Badge/Badge.prompt.md":"39aaf7eea384","components/general/Button/Button.jsx":"e82ca5566b22","components/general/Button/Button.d.ts":"4a18dfaa2acb","components/general/Button/Button.prompt.md":"f1955c33725a","components/general/CampaignCard/CampaignCard.jsx":"3512f53cea88","components/general/CampaignCard/CampaignCard.d.ts":"f9008e45fa97","components/general/CampaignCard/CampaignCard.prompt.md":"656ef39ac7dd","components/general/EmptyState/EmptyState.jsx":"0340e2327320","components/general/EmptyState/EmptyState.d.ts":"e246e7620d06","components/general/EmptyState/EmptyState.prompt.md":"e8c2967778d8","components/general/HealthTrack/HealthTrack.jsx":"7c6bf32ce034","components/general/HealthTrack/HealthTrack.d.ts":"d9aad9b83c65","components/general/HealthTrack/HealthTrack.prompt.md":"36bb4de355d2","components/general/Input/Input.jsx":"f85f7ed90457","components/general/Input/Input.d.ts":"cd33807f846b","components/general/Input/Input.prompt.md":"fcf2471f55e3","components/general/Modal/Modal.jsx":"efb943983ed6","components/general/Modal/Modal.d.ts":"015163552c70","components/general/Modal/Modal.prompt.md":"cb58d67df5d7","components/general/PartyCard/PartyCard.jsx":"49706dda9eaa","components/general/PartyCard/PartyCard.d.ts":"413199f5404c","components/general/PartyCard/PartyCard.prompt.md":"b80710343c03","components/general/PartyRow/PartyRow.jsx":"2fa8128fec33","components/general/PartyRow/PartyRow.d.ts":"e8f536795d95","components/general/PartyRow/PartyRow.prompt.md":"95416af1112b","components/general/Root/Root.jsx":"7f30aeb05d69","components/general/Root/Root.d.ts":"265a18ea8a0f","components/general/Root/Root.prompt.md":"6e2d9ee23576","components/general/SectionHeader/SectionHeader.jsx":"b88c50c1207a","components/general/SectionHeader/SectionHeader.d.ts":"c0b918648563","components/general/SectionHeader/SectionHeader.prompt.md":"a925abb0454e","components/general/Stat/Stat.jsx":"020eca31241b","components/general/Stat/Stat.d.ts":"cc3e9b38b175","components/general/Stat/Stat.prompt.md":"9f7c261731bc","components/general/StatusBar/StatusBar.jsx":"c196223666c4","components/general/StatusBar/StatusBar.d.ts":"edaf45f9a34a","components/general/StatusBar/StatusBar.prompt.md":"d674abdc5544","components/general/Tip/Tip.jsx":"fd908ccc7244","components/general/Tip/Tip.d.ts":"32cb76741800","components/general/Tip/Tip.prompt.md":"618415b7b458"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
var Asgard = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // <define:import.meta.env>
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
    }
  });

  // shim:react-shim
  var require_react_shim = __commonJS({
    "shim:react-shim"(exports, module) {
      init_define_import_meta_env();
      var R = window.React;
      function jsx14(t, p, k) {
        return R.createElement(t, k === void 0 ? p : Object.assign({ key: k }, p));
      }
      module.exports = R;
      module.exports.jsx = jsx14;
      module.exports.jsxs = jsx14;
      module.exports.jsxDEV = jsx14;
      module.exports.Fragment = R.Fragment;
    }
  });

  // design-system/dist/index.es.js
  var index_es_exports = {};
  __export(index_es_exports, {
    Badge: () => Badge,
    Button: () => Button,
    CampaignCard: () => CampaignCard,
    EmptyState: () => EmptyState,
    HealthTrack: () => HealthTrack,
    Input: () => Input,
    Modal: () => Modal,
    PartyCard: () => PartyCard,
    PartyRow: () => PartyRow,
    Root: () => Root,
    SectionHeader: () => SectionHeader,
    Stat: () => Stat,
    StatusBar: () => StatusBar,
    Tip: () => Tip
  });
  init_define_import_meta_env();
  var import_jsx_runtime = __toESM(require_react_shim());
  var import_react = __toESM(require_react_shim());
  var import_jsx_runtime2 = __toESM(require_react_shim());
  var import_jsx_runtime3 = __toESM(require_react_shim());
  var import_jsx_runtime4 = __toESM(require_react_shim());
  var import_jsx_runtime5 = __toESM(require_react_shim());
  var import_jsx_runtime6 = __toESM(require_react_shim());
  var import_jsx_runtime7 = __toESM(require_react_shim());
  var import_jsx_runtime8 = __toESM(require_react_shim());
  var import_jsx_runtime9 = __toESM(require_react_shim());
  var import_jsx_runtime10 = __toESM(require_react_shim());
  var import_jsx_runtime11 = __toESM(require_react_shim());
  var import_jsx_runtime12 = __toESM(require_react_shim());
  var import_jsx_runtime13 = __toESM(require_react_shim());
  var import_jsx_runtime14 = __toESM(require_react_shim());
  function Root({ children }) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "kk-root", children });
  }
  function Tip({ text, children, label }) {
    const [open, setOpen] = (0, import_react.useState)(false);
    const ref = (0, import_react.useRef)(null);
    const popRef = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      if (!open) return;
      const c = (e) => {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener("pointerdown", c);
      return () => document.removeEventListener("pointerdown", c);
    }, [open]);
    (0, import_react.useEffect)(() => {
      if (!open || !popRef.current) return;
      const rect = popRef.current.getBoundingClientRect();
      const margin = 8;
      if (rect.left < margin) {
        popRef.current.style.transform = `translateX(calc(-50% + ${margin - rect.left}px))`;
      } else if (rect.right > window.innerWidth - margin) {
        popRef.current.style.transform = `translateX(calc(-50% - ${rect.right - window.innerWidth + margin}px))`;
      }
    }, [open]);
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "span",
      {
        ref,
        className: "kk-tip",
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onClick: (e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        },
        tabIndex: 0,
        onFocus: () => setOpen(true),
        onBlur: () => setOpen(false),
        "aria-label": typeof text === "string" ? text : label,
        children: [
          children,
          open && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { ref: popRef, className: "kk-tip-pop", role: "tooltip", children: text })
        ]
      }
    );
  }
  function Stat({ label, value, onChange, max, tip, accent }) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "kk-stat", style: accent ? { ["--local-accent"]: accent } : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Tip, { text: tip, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "kk-stat-label kk-dotted", children: label }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "kk-stat-row", children: [
        onChange && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { className: "kk-step", onClick: () => onChange(value - 1), "aria-label": "\u2212", children: "\u2212" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "kk-stat-val", children: [
          value,
          max != null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "kk-stat-max", children: [
            "/",
            max
          ] })
        ] }),
        onChange && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { className: "kk-step", onClick: () => onChange(value + 1), "aria-label": "+", children: "+" })
      ] })
    ] });
  }
  function attrPipSizes(die) {
    switch (die) {
      case 20:
        return [2, 2, 2, 2, 1];
      case 12:
        return [1, 2, 2, 2, 1];
      case 10:
        return [1, 1, 2, 2, 1];
      case 8:
        return [1, 1, 1, 2, 1];
      default:
        return [1, 1, 1, 1, 1];
    }
  }
  function computeHealthPips(attrDie) {
    const sizes = attrPipSizes(attrDie).map((s, i) => i === 4 ? 1 : s);
    const thresholds = [0];
    for (let i = 0; i < 4; i++) thresholds.push(thresholds[i] + sizes[i]);
    return { sizes, thresholds, maxValue: sizes.reduce((a, b) => a + b, 0) };
  }
  function buildPipStates(value, sizes, thresholds) {
    return sizes.map((size, i) => {
      const lo = thresholds[i];
      const filled = Math.max(0, Math.min(size, value - lo));
      return {
        pip: i + 1,
        size,
        lo,
        cells: Array.from({ length: size }, (_, c) => ({ filled: c < filled })),
        started: filled > 0,
        closed: filled >= size,
        knockout: i === 4
      };
    });
  }
  function HealthTrack({ label, attrLabel, attrDie, value, onChange, tipExtra }) {
    const { sizes, thresholds, maxValue } = computeHealthPips(attrDie);
    const states = buildPipStates(value, sizes, thresholds);
    const setVal = (v) => onChange && onChange(Math.max(0, Math.min(maxValue, v)));
    return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "kk-track", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "kk-track-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Tip, { text: `${label}: ${value}/${maxValue}. ${tipExtra || ""}`, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "kk-track-name kk-dotted", children: label }) }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "kk-track-meta", children: [
          value,
          "/",
          maxValue,
          " \xB7 ",
          attrLabel,
          " d",
          attrDie
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "kk-pips", children: states.map((p) => {
        let ci = p.lo;
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: `kk-pip ${p.knockout ? "ko" : ""} ${p.started ? "started" : ""} ${p.closed ? "closed" : ""}`, children: [
          p.cells.map((c, k) => {
            const abs = ++ci;
            return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "button",
              {
                className: `kk-cell ${c.filled ? "filled" : ""}`,
                onClick: () => setVal(value === abs ? abs - 1 : abs),
                "aria-label": `${label} ${abs}`
              },
              k
            );
          }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "kk-pip-num", children: p.pip })
        ] }, p.pip);
      }) })
    ] });
  }
  function durationLabel(s) {
    if (s.durationMode === "charges" && s.durationRemaining != null) return ` [${s.durationRemaining}]`;
    if (s.durationMode === "counter" && s.durationRemaining != null) return ` (${s.durationRemaining})`;
    if (s.durationMode === "scene") return " (scene)";
    return "";
  }
  function StatusBar({ statuses = [], isGM, onRemove, onAdd, onView }) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "kk-status-bar", children: [
      statuses.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
        "span",
        {
          className: "kk-status-chip",
          onClick: () => onView?.(s),
          title: s.name + durationLabel(s),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "kk-status-chip-name", children: [
              s.name,
              durationLabel(s)
            ] }),
            isGM && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                className: "kk-status-remove",
                onClick: (e) => {
                  e.stopPropagation();
                  onRemove?.(s);
                },
                "aria-label": `Remove ${s.name}`,
                children: "\xD7"
              }
            )
          ]
        },
        (s._uid || s.definitionId || s.name) + i
      )),
      isGM && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { className: "kk-status-add", onClick: onAdd, title: "Add status", children: "+" })
    ] });
  }
  function Button({ children, variant = "primary", size, onClick, disabled, type = "button" }) {
    const cls = ["kk-btn", variant, size === "sm" ? "sm" : ""].filter(Boolean).join(" ");
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type, className: cls, onClick, disabled, children });
  }
  function Input({ value, onChange, placeholder, size, type = "text", ...rest }) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "input",
      {
        type,
        className: ["kk-input", size === "sm" ? "sm" : ""].filter(Boolean).join(" "),
        value,
        onChange,
        placeholder,
        ...rest
      }
    );
  }
  function Badge({ children, variant = "gold" }) {
    const colors = {
      gold: { background: "var(--kk-gold)", color: "#1a140c" },
      dim: { background: "var(--kk-surface-2)", color: "var(--kk-text-dim)", border: "1px solid var(--kk-line-soft)" },
      danger: { background: "var(--kk-danger-dim)", color: "var(--kk-danger)" }
    };
    return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { style: {
      display: "inline-block",
      fontSize: "10px",
      fontWeight: 700,
      letterSpacing: ".1em",
      padding: "2px 7px",
      borderRadius: "5px",
      ...colors[variant]
    }, children });
  }
  function EmptyState({ message, cta }) {
    return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "kk-empty", children: [
      message,
      cta && /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("span", { children: [
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("code", { children: cta })
      ] })
    ] });
  }
  function SectionHeader({ title, count, action }) {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("h2", { className: "kk-h2", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { children: [
        title,
        count != null && /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "kk-count", children: [
          " (",
          count,
          ")"
        ] })
      ] }),
      action
    ] });
  }
  function Modal({ title, onClose, children, footer }) {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "kk-overlay", onClick: onClose, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kk-modal", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "kk-modal-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "kk-modal-title", children: title }),
        onClose && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { className: "kk-modal-x", onClick: onClose, "aria-label": "Close", children: "\u2715" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "kk-modal-body", children }),
      footer && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "kk-modal-foot", children: footer })
    ] }) });
  }
  function PartyCard({ name, faction, factionColor, portraitUrl, subtitle, isSelf, onClick, disabled }) {
    const initial = name?.[0] ?? "?";
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
      "button",
      {
        className: ["kk-party-card", isSelf ? "self" : ""].filter(Boolean).join(" "),
        style: { "--fac-color": factionColor || "var(--kk-gold)" },
        onClick,
        disabled,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: "kk-party-av", children: portraitUrl ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("img", { src: portraitUrl, alt: name, style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" } }) : initial }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "kk-party-name", children: name }),
          isSelf && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "kk-party-you", children: "You" }),
          subtitle && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: "kk-party-sub", children: subtitle })
        ]
      }
    );
  }
  function PartyRow({ name, faction, factionColor, portraitUrl, subtitle, vitals, actions }) {
    const initial = name?.[0] ?? "?";
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
      "div",
      {
        className: "kk-party-row",
        style: { "--fac-color": factionColor || "var(--kk-gold)" },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "kk-party-row-av", children: portraitUrl ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("img", { src: portraitUrl, alt: name }) : initial }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: "kk-party-row-info", children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "kk-party-row-name", children: name }),
            subtitle && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: "kk-party-row-sub", children: subtitle }),
            vitals && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "kk-party-row-vitals", children: vitals.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("span", { className: v.tension ? "kk-vital-tension" : "", children: [
              v.label,
              ": ",
              v.value
            ] }, i)) })
          ] }),
          actions && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: "kk-party-row-acts", children: actions })
        ]
      }
    );
  }
  function CampaignCard({ name, system, playerCount, isGM, status, onClick }) {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "kk-campaign", style: { cursor: onClick ? "pointer" : void 0 }, onClick, children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "kk-campaign-name", children: [
        name,
        isGM && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Badge, { variant: "gold", children: "GM" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: "kk-campaign-meta", children: [
        system && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: system }),
        playerCount != null && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: "\xB7" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
            playerCount,
            " players"
          ] })
        ] }),
        status && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(import_jsx_runtime14.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: "\xB7" }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: status })
        ] })
      ] })
    ] });
  }
  return __toCommonJS(index_es_exports);
})();
window.Asgard=Asgard.__dsMainNs?Object.assign({},Asgard,Asgard.__dsMainNs,{__dsMainNs:undefined}):Asgard;
