/* @ds-bundle: {"format":3,"namespace":"PlotlineDesignSystem_0cdb69","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"IconButton","sourcePath":"components/buttons/IconButton.jsx"},{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"Tag","sourcePath":"components/data-display/Tag.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Card","sourcePath":"components/surfaces/Card.jsx"},{"name":"Tabs","sourcePath":"components/surfaces/Tabs.jsx"},{"name":"EstimateRow","sourcePath":"components/takeoff/EstimateRow.jsx"},{"name":"MeasurementChip","sourcePath":"components/takeoff/MeasurementChip.jsx"},{"name":"SheetThumb","sourcePath":"components/takeoff/SheetThumb.jsx"},{"name":"ToolRail","sourcePath":"components/takeoff/ToolRail.jsx"}],"sourceHashes":{"assets/icons.js":"2e0774b4405f","components/buttons/Button.jsx":"a882ebc56b85","components/buttons/IconButton.jsx":"5a27fff026a8","components/data-display/Avatar.jsx":"32242bf4c979","components/data-display/Badge.jsx":"945513a0c21c","components/data-display/Tag.jsx":"d3978702cb33","components/feedback/Dialog.jsx":"a67d4ba13c26","components/feedback/Toast.jsx":"70b769fbd78b","components/feedback/Tooltip.jsx":"029ff7f7eb95","components/forms/Checkbox.jsx":"e7651da5ca46","components/forms/Input.jsx":"7ece9dc30946","components/forms/Select.jsx":"9e8debbcfe72","components/forms/Switch.jsx":"0839277e08fe","components/surfaces/Card.jsx":"6118bf6967c1","components/surfaces/Tabs.jsx":"a23df7b45edb","components/takeoff/EstimateRow.jsx":"b1078b2b7687","components/takeoff/MeasurementChip.jsx":"484ec2390eba","components/takeoff/SheetThumb.jsx":"07aa4410c3e7","components/takeoff/ToolRail.jsx":"c62a8d5741ae","ui_kits/app/Projects.jsx":"af8d76ad5c11","ui_kits/app/Workspace.jsx":"bb9cbaa733fa","ui_kits/app/common.jsx":"2d316c66597f"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PlotlineDesignSystem_0cdb69 = window.PlotlineDesignSystem_0cdb69 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/icons.js
try { (() => {
/* Plotline icon helper.
   Builds a Lucide SVG element from the loaded `lucide` UMD global, robust
   across the two shapes Lucide ships icon data in (children-array, or
   [tag, attrs, children]). Load AFTER the lucide UMD script:

     <script src="https://unpkg.com/lucide@0.456.0/dist/umd/lucide.min.js"></script>
     <script src="/assets/icons.js"></script>

   Then in React:  window.plIconSVG("ruler", { size: 18 })  -> <svg> element
*/
(function () {
  function toPascal(s) {
    return s.split(/[-_]/).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join("");
  }
  function getNode(name) {
    var L = window.lucide;
    if (!L) return null;
    var key = toPascal(name);
    return L.icons && L.icons[key] || L[key] || L.icons && L.icons[name] || null;
  }
  function childTuples(node) {
    if (!node) return [];
    if (Array.isArray(node)) {
      // [tag, attrs, children]  vs  [ [tag,attrs], [tag,attrs] ]
      if (typeof node[0] === "string") return node[2] || [];
      return node;
    }
    if (node.children) return node.children;
    return [];
  }
  window.plIconSVG = function (name, opts) {
    opts = opts || {};
    var size = opts.size || 18;
    var sw = opts.strokeWidth || 2;
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", sw);
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    childTuples(getNode(name)).forEach(function (c) {
      if (!Array.isArray(c)) return;
      var el = document.createElementNS(ns, c[0]);
      var attrs = c[1] || {};
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
      svg.appendChild(el);
    });
    return svg;
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/icons.js", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Inject component CSS once. Real :hover/:focus/:active need a stylesheet;
   inline styles can't express them. Tokens come from styles.css. */
const CSS = `
.pl-btn{
  --_h: var(--control-md);
  display:inline-flex; align-items:center; justify-content:center;
  gap: var(--space-4);
  height: var(--_h);
  padding: 0 var(--space-6);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-snug);
  line-height: 1;
  border-radius: var(--radius-md);
  border: var(--border-hairline) solid transparent;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: background var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard);
}
.pl-btn:focus-visible{ outline:none; box-shadow: var(--focus-ring); }
.pl-btn:active{ transform: translateY(0.5px); }
.pl-btn[disabled]{ opacity:.5; cursor:not-allowed; transform:none; }
.pl-btn--full{ width:100%; }

.pl-btn--sm{ --_h: var(--control-sm); font-size:var(--text-sm); padding:0 var(--space-5); border-radius:var(--radius-sm); }
.pl-btn--lg{ --_h: var(--control-lg); font-size:var(--text-md); padding:0 var(--space-8); }

.pl-btn--primary{ background:var(--action-primary); color:var(--action-primary-fg); }
.pl-btn--primary:hover:not([disabled]){ background:var(--action-primary-hover); }
.pl-btn--primary:active:not([disabled]){ background:var(--action-primary-active); }

.pl-btn--secondary{ background:var(--action-neutral); color:var(--action-neutral-fg); border-color:var(--border-default); box-shadow:var(--shadow-xs); }
.pl-btn--secondary:hover:not([disabled]){ background:var(--action-neutral-hover); border-color:var(--border-strong); }
.pl-btn--secondary:active:not([disabled]){ background:var(--action-neutral-active); }

.pl-btn--ghost{ background:transparent; color:var(--text-body); }
.pl-btn--ghost:hover:not([disabled]){ background:var(--surface-muted); }
.pl-btn--ghost:active:not([disabled]){ background:var(--action-neutral-active); }

.pl-btn--danger{ background:var(--action-danger); color:var(--action-danger-fg); }
.pl-btn--danger:hover:not([disabled]){ background:var(--action-danger-hover); }

.pl-btn__icon{ display:inline-flex; width:1.05em; height:1.05em; flex:0 0 auto; }
.pl-btn__icon svg{ width:100%; height:100%; display:block; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-btn-css")) {
  const el = document.createElement("style");
  el.id = "pl-btn-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled = false,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const cls = ["pl-btn", `pl-btn--${variant}`, size !== "md" ? `pl-btn--${size}` : "", fullWidth ? "pl-btn--full" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: disabled
  }, rest), iconLeft ? /*#__PURE__*/React.createElement("span", {
    className: "pl-btn__icon"
  }, iconLeft) : null, children != null ? /*#__PURE__*/React.createElement("span", null, children) : null, iconRight ? /*#__PURE__*/React.createElement("span", {
    className: "pl-btn__icon"
  }, iconRight) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/buttons/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* IconButton — a square, icon-only control for toolbars and dense UIs.
   Shares the visual language of Button. */
const CSS = `
.pl-iconbtn{
  --_s: var(--control-md);
  display:inline-flex; align-items:center; justify-content:center;
  width:var(--_s); height:var(--_s);
  padding:0;
  border-radius: var(--radius-md);
  border: var(--border-hairline) solid transparent;
  background: transparent;
  color: var(--text-body);
  cursor:pointer;
  transition: background var(--dur-fast) var(--ease-standard),
              color var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
.pl-iconbtn svg{ width:1.15em; height:1.15em; display:block; }
.pl-iconbtn:focus-visible{ outline:none; box-shadow: var(--focus-ring); }
.pl-iconbtn[disabled]{ opacity:.45; cursor:not-allowed; }
.pl-iconbtn--sm{ --_s: var(--control-sm); font-size:var(--text-sm); border-radius:var(--radius-sm); }
.pl-iconbtn--lg{ --_s: var(--control-lg); font-size:var(--text-lg); }

.pl-iconbtn--ghost:hover:not([disabled]){ background:var(--surface-muted); }
.pl-iconbtn--ghost:active:not([disabled]){ background:var(--action-neutral-active); }

.pl-iconbtn--solid{ background:var(--action-neutral); border-color:var(--border-default); box-shadow:var(--shadow-xs); }
.pl-iconbtn--solid:hover:not([disabled]){ background:var(--action-neutral-hover); border-color:var(--border-strong); }

.pl-iconbtn--primary{ background:var(--action-primary); color:var(--action-primary-fg); }
.pl-iconbtn--primary:hover:not([disabled]){ background:var(--action-primary-hover); }

/* selected = active tool in a toolbar */
.pl-iconbtn[aria-pressed="true"]{ background:var(--brand-50); color:var(--text-brand); border-color:var(--brand-200); }
.pl-iconbtn--primary[aria-pressed="true"]{ background:var(--action-primary-active); color:var(--action-primary-fg); border-color:transparent; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-iconbtn-css")) {
  const el = document.createElement("style");
  el.id = "pl-iconbtn-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function IconButton({
  variant = "ghost",
  size = "md",
  selected,
  disabled = false,
  label,
  className = "",
  children,
  ...rest
}) {
  const cls = ["pl-iconbtn", `pl-iconbtn--${variant}`, size !== "md" ? `pl-iconbtn--${size}` : "", className].filter(Boolean).join(" ");
  const pressed = selected === undefined ? undefined : selected ? "true" : "false";
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    disabled: disabled,
    "aria-label": label,
    "aria-pressed": pressed,
    title: label
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-avatar{
  position:relative; display:inline-flex; align-items:center; justify-content:center;
  flex:0 0 auto; overflow:hidden;
  width:var(--_s,32px); height:var(--_s,32px);
  border-radius:var(--radius-pill);
  background:var(--brand-100); color:var(--brand-800);
  font-family:var(--font-sans); font-weight:var(--weight-semibold);
  font-size:calc(var(--_s,32px) * 0.40); letter-spacing:var(--tracking-snug);
  user-select:none;
}
.pl-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.pl-avatar--ring{ box-shadow:0 0 0 2px var(--surface-card), 0 0 0 3px var(--border-default); }
.pl-avatar__status{
  position:absolute; right:-1px; bottom:-1px;
  width:30%; height:30%; min-width:8px; min-height:8px;
  border-radius:50%; border:2px solid var(--surface-card);
  background:var(--slate-400);
}
.pl-avatar__status--online{ background:var(--success-500); }
.pl-avatar__status--busy{ background:var(--danger-500); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-avatar-css")) {
  const el = document.createElement("style");
  el.id = "pl-avatar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const SIZES = {
  xs: 22,
  sm: 28,
  md: 32,
  lg: 40,
  xl: 52
};
function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
}
function Avatar({
  name = "",
  src,
  size = "md",
  ring = false,
  status,
  className = "",
  ...rest
}) {
  const px = typeof size === "number" ? size : SIZES[size] || 32;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["pl-avatar", ring ? "pl-avatar--ring" : "", className].filter(Boolean).join(" "),
    style: {
      "--_s": px + "px"
    },
    title: name || undefined
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : initials(name), status ? /*#__PURE__*/React.createElement("span", {
    className: `pl-avatar__status pl-avatar__status--${status}`
  }) : null);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-badge{
  display:inline-flex; align-items:center; gap:var(--space-3);
  height:20px; padding:0 var(--space-4);
  font-family:var(--font-sans); font-size:var(--text-xs); font-weight:var(--weight-semibold);
  letter-spacing:var(--tracking-snug); line-height:1;
  border-radius:var(--radius-pill);
  border:var(--border-hairline) solid transparent;
  white-space:nowrap;
}
.pl-badge__dot{ width:6px; height:6px; border-radius:50%; background:currentColor; flex:0 0 auto; }
.pl-badge--neutral{ background:var(--surface-muted); color:var(--text-body); border-color:var(--border-default); }
.pl-badge--brand{ background:var(--brand-50); color:var(--brand-700); border-color:var(--brand-200); }
.pl-badge--success{ background:var(--success-bg); color:var(--success-500); }
.pl-badge--warning{ background:var(--warning-bg); color:var(--warning-500); }
.pl-badge--danger{ background:var(--danger-bg); color:var(--danger-500); }
.pl-badge--info{ background:var(--info-bg); color:var(--info-500); }
.pl-badge--solid{ background:var(--action-primary); color:var(--action-primary-fg); border-color:transparent; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-badge-css")) {
  const el = document.createElement("style");
  el.id = "pl-badge-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Badge({
  variant = "neutral",
  dot = false,
  className = "",
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["pl-badge", `pl-badge--${variant}`, className].filter(Boolean).join(" ")
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    className: "pl-badge__dot"
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Tag — categorical chip used for takeoff layers / measurement categories.
   The `color` prop accepts a takeoff key (area|linear|count|volume|region|slope)
   or any CSS color; it tints the dot + text and a soft background. */
const CSS = `
.pl-tag{
  display:inline-flex; align-items:center; gap:var(--space-3);
  height:24px; padding:0 var(--space-4);
  font-family:var(--font-sans); font-size:var(--text-sm); font-weight:var(--weight-medium);
  line-height:1; border-radius:var(--radius-sm);
  border:var(--border-hairline) solid var(--border-default);
  background:var(--surface-card); color:var(--text-body);
  white-space:nowrap; max-width:100%;
}
.pl-tag__dot{ width:9px; height:9px; border-radius:2px; flex:0 0 auto; background:var(--_c, var(--slate-400)); }
.pl-tag__label{ overflow:hidden; text-overflow:ellipsis; }
.pl-tag--tinted{ background:var(--_bg, var(--surface-muted)); border-color:transparent; color:var(--_fg, var(--text-body)); }
.pl-tag__close{
  display:inline-flex; align-items:center; justify-content:center;
  width:16px; height:16px; margin-right:-3px; margin-left:1px;
  border:none; background:transparent; border-radius:var(--radius-xs);
  color:currentColor; opacity:.6; cursor:pointer;
}
.pl-tag__close:hover{ opacity:1; background:rgba(0,0,0,.07); }
.pl-tag__close svg{ width:11px; height:11px; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-tag-css")) {
  const el = document.createElement("style");
  el.id = "pl-tag-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const TAKEOFF = {
  area: ["var(--takeoff-area)", "var(--takeoff-area-bg)"],
  linear: ["var(--takeoff-linear)", "var(--takeoff-linear-bg)"],
  count: ["var(--takeoff-count)", "var(--takeoff-count-bg)"],
  volume: ["var(--takeoff-volume)", "var(--takeoff-volume-bg)"],
  region: ["var(--takeoff-region)", "var(--takeoff-region-bg)"],
  slope: ["var(--takeoff-slope)", "var(--takeoff-slope-bg)"]
};
function Tag({
  color,
  tinted = false,
  onRemove,
  className = "",
  children,
  ...rest
}) {
  const preset = color && TAKEOFF[color];
  const dotColor = preset ? preset[0] : color;
  const bg = preset ? preset[1] : undefined;
  const style = {
    "--_c": dotColor,
    ...(tinted ? {
      "--_bg": bg || "var(--surface-muted)",
      "--_fg": dotColor
    } : null)
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["pl-tag", tinted ? "pl-tag--tinted" : "", className].filter(Boolean).join(" "),
    style: style
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pl-tag__dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pl-tag__label"
  }, children), onRemove ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pl-tag__close",
    "aria-label": "Remove",
    onClick: onRemove
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }))) : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
const CSS = `
.pl-dialog__scrim{
  position:fixed; inset:0; z-index:100;
  background:var(--surface-overlay);
  backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center;
  padding:var(--space-8);
  animation:pl-dialog-fade var(--dur-base) var(--ease-standard);
}
.pl-dialog{
  width:100%; max-width:var(--_w,460px);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-xl);
  box-shadow:var(--shadow-xl);
  display:flex; flex-direction:column; max-height:88vh;
  animation:pl-dialog-pop var(--dur-base) var(--ease-out);
}
.pl-dialog__head{ display:flex; align-items:flex-start; gap:var(--space-5); padding:var(--space-7) var(--space-7) var(--space-5); }
.pl-dialog__titles{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:3px; }
.pl-dialog__title{ font-family:var(--font-display); font-size:var(--text-xl); font-weight:var(--weight-semibold); color:var(--text-strong); letter-spacing:var(--tracking-snug); }
.pl-dialog__desc{ font-size:var(--text-sm); color:var(--text-muted); line-height:var(--leading-snug); }
.pl-dialog__close{
  flex:0 0 auto; width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center;
  border:none; background:transparent; border-radius:var(--radius-sm); color:var(--text-muted); cursor:pointer;
}
.pl-dialog__close:hover{ background:var(--surface-muted); color:var(--text-strong); }
.pl-dialog__body{ padding:0 var(--space-7); overflow:auto; font-size:var(--text-base); color:var(--text-body); line-height:var(--leading-normal); }
.pl-dialog__footer{ display:flex; justify-content:flex-end; gap:var(--space-4); padding:var(--space-7); }
@keyframes pl-dialog-fade{ from{opacity:0} to{opacity:1} }
@keyframes pl-dialog-pop{ from{opacity:0; transform:translateY(8px) scale(.98)} to{opacity:1; transform:none} }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-dialog-css")) {
  const el = document.createElement("style");
  el.id = "pl-dialog-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  width,
  children
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "pl-dialog__scrim",
    onMouseDown: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pl-dialog",
    role: "dialog",
    "aria-modal": "true",
    style: {
      "--_w": width ? width + "px" : undefined
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "pl-dialog__head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pl-dialog__titles"
  }, title ? /*#__PURE__*/React.createElement("span", {
    className: "pl-dialog__title"
  }, title) : null, description ? /*#__PURE__*/React.createElement("span", {
    className: "pl-dialog__desc"
  }, description) : null), onClose ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pl-dialog__close",
    "aria-label": "Close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }))) : null), children ? /*#__PURE__*/React.createElement("div", {
    className: "pl-dialog__body"
  }, children) : null, footer ? /*#__PURE__*/React.createElement("div", {
    className: "pl-dialog__footer"
  }, footer) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-toast{
  display:flex; align-items:flex-start; gap:var(--space-5);
  width:min(380px,92vw); padding:var(--space-5) var(--space-6);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-lg);
  font-family:var(--font-sans);
}
.pl-toast__icon{ flex:0 0 auto; width:20px; height:20px; display:inline-flex; margin-top:1px; }
.pl-toast__icon svg{ width:100%; height:100%; }
.pl-toast--success .pl-toast__icon{ color:var(--success-500); }
.pl-toast--warning .pl-toast__icon{ color:var(--warning-500); }
.pl-toast--danger .pl-toast__icon{ color:var(--danger-500); }
.pl-toast--info .pl-toast__icon{ color:var(--info-500); }
.pl-toast__body{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:2px; }
.pl-toast__title{ font-size:var(--text-base); font-weight:var(--weight-semibold); color:var(--text-strong); }
.pl-toast__msg{ font-size:var(--text-sm); color:var(--text-muted); line-height:var(--leading-snug); }
.pl-toast__close{
  flex:0 0 auto; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;
  border:none; background:transparent; border-radius:var(--radius-xs); color:var(--text-subtle); cursor:pointer; margin:-2px -4px 0 0;
}
.pl-toast__close:hover{ background:var(--surface-muted); color:var(--text-body); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-toast-css")) {
  const el = document.createElement("style");
  el.id = "pl-toast-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const ICONS = {
  success: "M20 6 9 17l-5-5",
  warning: "M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  danger: "M18 6 6 18 M6 6l12 12",
  info: "M12 16v-4 M12 8h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
};
function GlyphTick() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m8.5 12 2.5 2.5 4.5-5"
  }));
}
function GlyphWarn() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 9v4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 17h.01"
  }));
}
function GlyphInfo() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 16v-4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 8h.01"
  }));
}
function GlyphX() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m15 9-6 6M9 9l6 6"
  }));
}
const GLYPH = {
  success: /*#__PURE__*/React.createElement(GlyphTick, null),
  warning: /*#__PURE__*/React.createElement(GlyphWarn, null),
  danger: /*#__PURE__*/React.createElement(GlyphX, null),
  info: /*#__PURE__*/React.createElement(GlyphInfo, null)
};
function Toast({
  variant = "info",
  title,
  message,
  onClose,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["pl-toast", `pl-toast--${variant}`, className].filter(Boolean).join(" "),
    role: "status"
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pl-toast__icon"
  }, GLYPH[variant]), /*#__PURE__*/React.createElement("div", {
    className: "pl-toast__body"
  }, title ? /*#__PURE__*/React.createElement("span", {
    className: "pl-toast__title"
  }, title) : null, message ? /*#__PURE__*/React.createElement("span", {
    className: "pl-toast__msg"
  }, message) : null), onClose ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pl-toast__close",
    "aria-label": "Dismiss",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  }))) : null);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
const CSS = `
.pl-tt{ position:relative; display:inline-flex; }
.pl-tt__pop{
  position:absolute; z-index:50; left:50%; transform:translateX(-50%) translateY(2px);
  background:var(--surface-inverse); color:var(--text-inverse);
  font-family:var(--font-sans); font-size:var(--text-xs); font-weight:var(--weight-medium);
  line-height:1.3; padding:5px 9px; border-radius:var(--radius-sm);
  white-space:nowrap; box-shadow:var(--shadow-md); pointer-events:none;
  opacity:0; transition:opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard);
}
.pl-tt__pop--top{ bottom:calc(100% + 7px); }
.pl-tt__pop--bottom{ top:calc(100% + 7px); }
.pl-tt[data-open="true"] .pl-tt__pop{ opacity:1; transform:translateX(-50%) translateY(0); }
.pl-tt__pop::after{
  content:""; position:absolute; left:50%; margin-left:-4px;
  border:4px solid transparent;
}
.pl-tt__pop--top::after{ top:100%; border-top-color:var(--surface-inverse); }
.pl-tt__pop--bottom::after{ bottom:100%; border-bottom-color:var(--surface-inverse); }
.pl-tt__kbd{ font-family:var(--font-mono); opacity:.7; margin-left:6px; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-tt-css")) {
  const el = document.createElement("style");
  el.id = "pl-tt-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Tooltip({
  label,
  shortcut,
  side = "top",
  className = "",
  children
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    className: ["pl-tt", className].filter(Boolean).join(" "),
    "data-open": open,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false)
  }, children, /*#__PURE__*/React.createElement("span", {
    className: `pl-tt__pop pl-tt__pop--${side}`,
    role: "tooltip"
  }, label, shortcut ? /*#__PURE__*/React.createElement("span", {
    className: "pl-tt__kbd"
  }, shortcut) : null));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-check{ display:inline-flex; align-items:flex-start; gap:var(--space-4); font-family:var(--font-sans); cursor:pointer; user-select:none; }
.pl-check input{ position:absolute; opacity:0; width:0; height:0; }
.pl-check__box{
  flex:0 0 auto; width:18px; height:18px; margin-top:1px;
  display:inline-flex; align-items:center; justify-content:center;
  background:var(--surface-card);
  border:var(--border-thick) solid var(--border-strong);
  border-radius:var(--radius-xs);
  color:#fff;
  transition:background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.pl-check__box svg{ opacity:0; transform:scale(.6); transition:opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.pl-check:hover .pl-check__box{ border-color:var(--brand-400); }
.pl-check input:checked + .pl-check__box{ background:var(--action-primary); border-color:var(--action-primary); }
.pl-check input:checked + .pl-check__box svg{ opacity:1; transform:scale(1); }
.pl-check input:focus-visible + .pl-check__box{ box-shadow:var(--focus-ring); }
.pl-check input:disabled + .pl-check__box{ opacity:.5; }
.pl-check--disabled{ cursor:not-allowed; opacity:.7; }
.pl-check__text{ display:flex; flex-direction:column; gap:1px; }
.pl-check__label{ font-size:var(--text-base); color:var(--text-strong); line-height:var(--leading-snug); }
.pl-check__desc{ font-size:var(--text-xs); color:var(--text-muted); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-check-css")) {
  const el = document.createElement("style");
  el.id = "pl-check-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Tick = /*#__PURE__*/React.createElement("svg", {
  width: "12",
  height: "12",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "3.5",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M20 6 9 17l-5-5"
}));
function Checkbox({
  label,
  description,
  disabled = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ["pl-check", disabled ? "pl-check--disabled" : "", className].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "pl-check__box"
  }, Tick), label || description ? /*#__PURE__*/React.createElement("span", {
    className: "pl-check__text"
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "pl-check__label"
  }, label) : null, description ? /*#__PURE__*/React.createElement("span", {
    className: "pl-check__desc"
  }, description) : null) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-field{ display:flex; flex-direction:column; gap:var(--space-3); font-family:var(--font-sans); }
.pl-field__label{ font-size:var(--text-sm); font-weight:var(--weight-semibold); color:var(--text-strong); letter-spacing:var(--tracking-snug); }
.pl-field__req{ color:var(--danger-500); margin-left:2px; }
.pl-field__hint{ font-size:var(--text-xs); color:var(--text-muted); }
.pl-field__hint--error{ color:var(--danger-500); }

.pl-input{
  display:flex; align-items:center; gap:var(--space-4);
  height:var(--control-md);
  padding:0 var(--space-5);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-md);
  box-shadow:var(--shadow-xs);
  transition:border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
}
.pl-input:hover{ border-color:var(--border-strong); }
.pl-input:focus-within{ border-color:var(--border-focus); box-shadow:var(--focus-ring); }
.pl-input--lg{ height:var(--control-lg); }
.pl-input--sm{ height:var(--control-sm); padding:0 var(--space-4); }
.pl-input--error{ border-color:var(--danger-500); }
.pl-input--error:focus-within{ box-shadow:0 0 0 3px var(--danger-bg); }
.pl-input--disabled{ background:var(--surface-sunken); opacity:.65; pointer-events:none; }

.pl-input input{
  flex:1 1 auto; min-width:0;
  border:none; outline:none; background:transparent;
  font-family:var(--font-sans); font-size:var(--text-base); color:var(--text-strong);
}
.pl-input input::placeholder{ color:var(--text-subtle); }
.pl-input--num input{ font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
.pl-input__icon{ display:inline-flex; color:var(--text-muted); flex:0 0 auto; }
.pl-input__icon svg{ display:block; }
.pl-input__suffix{ font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-muted); flex:0 0 auto; letter-spacing:.02em; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-input-css")) {
  const el = document.createElement("style");
  el.id = "pl-input-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Input({
  label,
  hint,
  error,
  required = false,
  size = "md",
  leadingIcon,
  suffix,
  numeric = false,
  disabled = false,
  id,
  className = "",
  ...rest
}) {
  const autoId = React.useId();
  const fieldId = id || autoId;
  const boxCls = ["pl-input", size !== "md" ? `pl-input--${size}` : "", numeric ? "pl-input--num" : "", error ? "pl-input--error" : "", disabled ? "pl-input--disabled" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: "pl-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "pl-field__label",
    htmlFor: fieldId
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    className: "pl-field__req"
  }, "*") : null) : null, /*#__PURE__*/React.createElement("div", {
    className: boxCls
  }, leadingIcon ? /*#__PURE__*/React.createElement("span", {
    className: "pl-input__icon"
  }, leadingIcon) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    disabled: disabled,
    "aria-invalid": !!error
  }, rest)), suffix ? /*#__PURE__*/React.createElement("span", {
    className: "pl-input__suffix"
  }, suffix) : null), hint || error ? /*#__PURE__*/React.createElement("span", {
    className: "pl-field__hint" + (error ? " pl-field__hint--error" : "")
  }, error || hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-select{ display:flex; flex-direction:column; gap:var(--space-3); font-family:var(--font-sans); }
.pl-select__label{ font-size:var(--text-sm); font-weight:var(--weight-semibold); color:var(--text-strong); }
.pl-select__box{ position:relative; display:flex; align-items:center; }
.pl-select__box select{
  appearance:none; -webkit-appearance:none;
  width:100%; height:var(--control-md);
  padding:0 calc(var(--space-8) + 8px) 0 var(--space-5);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-md);
  box-shadow:var(--shadow-xs);
  font-family:var(--font-sans); font-size:var(--text-base); color:var(--text-strong);
  cursor:pointer;
  transition:border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
}
.pl-select__box select:hover{ border-color:var(--border-strong); }
.pl-select__box select:focus-visible{ outline:none; border-color:var(--border-focus); box-shadow:var(--focus-ring); }
.pl-select--sm select{ height:var(--control-sm); }
.pl-select--lg select{ height:var(--control-lg); }
.pl-select__chevron{ position:absolute; right:var(--space-5); pointer-events:none; color:var(--text-muted); display:inline-flex; }
.pl-select__chevron svg{ display:block; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-select-css")) {
  const el = document.createElement("style");
  el.id = "pl-select-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const Chevron = /*#__PURE__*/React.createElement("svg", {
  width: "16",
  height: "16",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m6 9 6 6 6-6"
}));
function Select({
  label,
  options = [],
  size = "md",
  id,
  className = "",
  children,
  ...rest
}) {
  const autoId = React.useId();
  const fieldId = id || autoId;
  const cls = ["pl-select", size !== "md" ? `pl-select--${size}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: cls
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "pl-select__label",
    htmlFor: fieldId
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: "pl-select__box"
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fieldId
  }, rest), children ? children : options.map(o => {
    const opt = typeof o === "string" ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement("span", {
    className: "pl-select__chevron"
  }, Chevron)));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-switch{ display:inline-flex; align-items:center; gap:var(--space-5); font-family:var(--font-sans); cursor:pointer; user-select:none; }
.pl-switch input{ position:absolute; opacity:0; width:0; height:0; }
.pl-switch__track{
  position:relative; flex:0 0 auto;
  width:38px; height:22px; border-radius:var(--radius-pill);
  background:var(--slate-300);
  transition:background var(--dur-base) var(--ease-standard);
}
.pl-switch__thumb{
  position:absolute; top:2px; left:2px;
  width:18px; height:18px; border-radius:var(--radius-pill);
  background:#fff; box-shadow:var(--shadow-sm);
  transition:transform var(--dur-base) var(--ease-out);
}
.pl-switch input:checked + .pl-switch__track{ background:var(--action-primary); }
.pl-switch input:checked + .pl-switch__track .pl-switch__thumb{ transform:translateX(16px); }
.pl-switch input:focus-visible + .pl-switch__track{ box-shadow:var(--focus-ring); }
.pl-switch input:disabled + .pl-switch__track{ opacity:.5; }
.pl-switch--disabled{ cursor:not-allowed; }
.pl-switch__label{ font-size:var(--text-base); color:var(--text-strong); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-switch-css")) {
  const el = document.createElement("style");
  el.id = "pl-switch-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Switch({
  label,
  disabled = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ["pl-switch", disabled ? "pl-switch--disabled" : "", className].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "pl-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-switch__thumb"
  })), label ? /*#__PURE__*/React.createElement("span", {
    className: "pl-switch__label"
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.pl-card{
  display:flex; flex-direction:column;
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-sm);
  overflow:hidden;
}
.pl-card--flat{ box-shadow:none; }
.pl-card--raised{ box-shadow:var(--shadow-md); }
.pl-card--interactive{ cursor:pointer; transition:box-shadow var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard); }
.pl-card--interactive:hover{ box-shadow:var(--shadow-md); border-color:var(--border-strong); transform:translateY(-1px); }
.pl-card__header{
  display:flex; align-items:center; gap:var(--space-5);
  padding:var(--space-6) var(--space-7);
  border-bottom:var(--border-hairline) solid var(--border-subtle);
}
.pl-card__titles{ display:flex; flex-direction:column; gap:2px; min-width:0; flex:1 1 auto; }
.pl-card__title{ font-family:var(--font-display); font-size:var(--text-lg); font-weight:var(--weight-semibold); color:var(--text-strong); letter-spacing:var(--tracking-snug); }
.pl-card__subtitle{ font-size:var(--text-sm); color:var(--text-muted); }
.pl-card__actions{ display:flex; align-items:center; gap:var(--space-4); flex:0 0 auto; }
.pl-card__body{ padding:var(--space-7); }
.pl-card__body--tight{ padding:var(--space-5); }
.pl-card__body--none{ padding:0; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-card-css")) {
  const el = document.createElement("style");
  el.id = "pl-card-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Card({
  title,
  subtitle,
  actions,
  elevation = "default",
  interactive = false,
  padding = "default",
  className = "",
  children,
  ...rest
}) {
  const cls = ["pl-card", elevation === "flat" ? "pl-card--flat" : elevation === "raised" ? "pl-card--raised" : "", interactive ? "pl-card--interactive" : "", className].filter(Boolean).join(" ");
  const bodyCls = "pl-card__body" + (padding === "tight" ? " pl-card__body--tight" : padding === "none" ? " pl-card__body--none" : "");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), title || actions ? /*#__PURE__*/React.createElement("div", {
    className: "pl-card__header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pl-card__titles"
  }, title ? /*#__PURE__*/React.createElement("span", {
    className: "pl-card__title"
  }, title) : null, subtitle ? /*#__PURE__*/React.createElement("span", {
    className: "pl-card__subtitle"
  }, subtitle) : null), actions ? /*#__PURE__*/React.createElement("div", {
    className: "pl-card__actions"
  }, actions) : null) : null, /*#__PURE__*/React.createElement("div", {
    className: bodyCls
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Card.jsx", error: String((e && e.message) || e) }); }

// components/surfaces/Tabs.jsx
try { (() => {
const CSS = `
.pl-tabs{ display:inline-flex; align-items:center; gap:2px; font-family:var(--font-sans); }
.pl-tabs--underline{ gap:var(--space-7); border-bottom:var(--border-hairline) solid var(--border-default); }
.pl-tabs--pill{ padding:3px; background:var(--surface-muted); border-radius:var(--radius-md); }

.pl-tab{
  position:relative; display:inline-flex; align-items:center; gap:var(--space-3);
  border:none; background:transparent; cursor:pointer;
  font-family:inherit; font-size:var(--text-sm); font-weight:var(--weight-semibold);
  color:var(--text-muted); white-space:nowrap;
  transition:color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
}
.pl-tab:hover{ color:var(--text-body); }
.pl-tab:focus-visible{ outline:none; box-shadow:var(--focus-ring); border-radius:var(--radius-sm); }

.pl-tabs--pill .pl-tab{ height:28px; padding:0 var(--space-6); border-radius:var(--radius-sm); }
.pl-tabs--pill .pl-tab[aria-selected="true"]{ background:var(--surface-card); color:var(--text-strong); box-shadow:var(--shadow-xs); }

.pl-tabs--underline .pl-tab{ height:38px; padding:0 1px; }
.pl-tabs--underline .pl-tab[aria-selected="true"]{ color:var(--text-strong); }
.pl-tabs--underline .pl-tab[aria-selected="true"]::after{
  content:""; position:absolute; left:0; right:0; bottom:-1px; height:2px;
  background:var(--action-primary); border-radius:2px;
}
.pl-tab__count{ font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-subtle); }
.pl-tab[aria-selected="true"] .pl-tab__count{ color:var(--text-brand); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-tabs-css")) {
  const el = document.createElement("style");
  el.id = "pl-tabs-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  variant = "underline",
  className = ""
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value);
  const active = value !== undefined ? value : internal;
  const select = v => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: ["pl-tabs", `pl-tabs--${variant}`, className].filter(Boolean).join(" "),
    role: "tablist"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.value,
    type: "button",
    role: "tab",
    "aria-selected": active === it.value,
    className: "pl-tab",
    onClick: () => select(it.value)
  }, it.label, it.count != null ? /*#__PURE__*/React.createElement("span", {
    className: "pl-tab__count"
  }, it.count) : null)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/surfaces/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/takeoff/EstimateRow.jsx
try { (() => {
/* EstimateRow — a line item in the estimate / takeoff summary table.
   Category color · item name · quantity (mono) · unit · unit price · total.
   Use inside a table-like flex column; pair with EstimateRow header styling. */
const CSS = `
.pl-erow{
  display:grid;
  grid-template-columns:auto 1fr auto auto;
  align-items:center; gap:var(--space-6);
  padding:var(--space-5) var(--space-6);
  border-bottom:var(--border-hairline) solid var(--border-subtle);
  font-family:var(--font-sans);
}
.pl-erow:last-child{ border-bottom:none; }
.pl-erow--header{ padding-top:var(--space-4); padding-bottom:var(--space-4); }
.pl-erow--header span{ font-family:var(--font-mono); font-size:10px; letter-spacing:.07em; text-transform:uppercase; color:var(--text-subtle); }
.pl-erow--total{ border-top:var(--border-thick) solid var(--border-strong); border-bottom:none; }
.pl-erow__cat{ display:flex; align-items:center; gap:var(--space-4); min-width:0; }
.pl-erow__swatch{ flex:0 0 auto; width:10px; height:10px; border-radius:2px; background:var(--_c,var(--slate-400)); }
.pl-erow__name{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.pl-erow__title{ font-size:var(--text-base); font-weight:var(--weight-medium); color:var(--text-strong); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pl-erow__sub{ font-size:var(--text-xs); color:var(--text-muted); }
.pl-erow__qty{ font-family:var(--font-mono); font-variant-numeric:tabular-nums; font-size:var(--text-sm); color:var(--text-body); text-align:right; white-space:nowrap; }
.pl-erow__qty b{ color:var(--text-strong); font-weight:var(--weight-semibold); }
.pl-erow__total{ font-family:var(--font-mono); font-variant-numeric:tabular-nums; font-size:var(--text-base); font-weight:var(--weight-semibold); color:var(--text-strong); text-align:right; white-space:nowrap; min-width:84px; }
.pl-erow--total .pl-erow__total{ font-size:var(--text-lg); color:var(--text-brand); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-erow-css")) {
  const el = document.createElement("style");
  el.id = "pl-erow-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const COLORS = {
  area: "var(--takeoff-area)",
  linear: "var(--takeoff-linear)",
  count: "var(--takeoff-count)",
  volume: "var(--takeoff-volume)",
  region: "var(--takeoff-region)",
  slope: "var(--takeoff-slope)"
};
function EstimateRow({
  type,
  name,
  source,
  quantity,
  unit,
  unitPrice,
  total,
  header = false,
  isTotal = false,
  className = ""
}) {
  if (header) {
    return /*#__PURE__*/React.createElement("div", {
      className: ["pl-erow", "pl-erow--header", className].filter(Boolean).join(" ")
    }, /*#__PURE__*/React.createElement("span", null, "Item"), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right"
      }
    }, "Quantity"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: "right"
      }
    }, "Total"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: ["pl-erow", isTotal ? "pl-erow--total" : "", className].filter(Boolean).join(" "),
    style: {
      "--_c": COLORS[type] || "var(--slate-400)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-erow__cat"
  }, !isTotal ? /*#__PURE__*/React.createElement("span", {
    className: "pl-erow__swatch"
  }) : null), /*#__PURE__*/React.createElement("span", {
    className: "pl-erow__name"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-erow__title"
  }, name), source ? /*#__PURE__*/React.createElement("span", {
    className: "pl-erow__sub"
  }, source) : null), /*#__PURE__*/React.createElement("span", {
    className: "pl-erow__qty"
  }, quantity != null ? /*#__PURE__*/React.createElement("b", null, quantity) : null, unit ? " " + unit : "", unitPrice ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--text-subtle)"
    }
  }, "@ ", unitPrice) : null), /*#__PURE__*/React.createElement("span", {
    className: "pl-erow__total"
  }, total));
}
Object.assign(__ds_scope, { EstimateRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/takeoff/EstimateRow.jsx", error: String((e && e.message) || e) }); }

// components/takeoff/MeasurementChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* MeasurementChip — a single takeoff measurement: a color square (keyed to the
   measurement type), a label, and a value+unit in mono tabular figures.
   Used in layer lists, the estimate panel, and as on-canvas callouts. */
const CSS = `
.pl-mchip{
  display:flex; align-items:center; gap:var(--space-5);
  width:100%; padding:var(--space-4) var(--space-5);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-md);
  font-family:var(--font-sans); text-align:left;
  transition:background var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
button.pl-mchip{ cursor:pointer; }
button.pl-mchip:hover{ background:var(--surface-sunken); border-color:var(--border-strong); }
.pl-mchip[data-selected="true"]{ border-color:var(--_c); box-shadow:0 0 0 1px var(--_c); background:var(--_bg); }
.pl-mchip__swatch{ flex:0 0 auto; width:14px; height:14px; border-radius:3px; background:var(--_c); }
.pl-mchip__main{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:1px; }
.pl-mchip__label{ font-size:var(--text-sm); font-weight:var(--weight-medium); color:var(--text-strong); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pl-mchip__type{ font-family:var(--font-mono); font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--text-subtle); }
.pl-mchip__value{ flex:0 0 auto; display:flex; align-items:baseline; gap:3px; font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
.pl-mchip__num{ font-size:var(--text-base); font-weight:var(--weight-semibold); color:var(--text-strong); }
.pl-mchip__unit{ font-size:var(--text-xs); color:var(--text-muted); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-mchip-css")) {
  const el = document.createElement("style");
  el.id = "pl-mchip-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
const COLORS = {
  area: ["var(--takeoff-area)", "var(--takeoff-area-bg)"],
  linear: ["var(--takeoff-linear)", "var(--takeoff-linear-bg)"],
  count: ["var(--takeoff-count)", "var(--takeoff-count-bg)"],
  volume: ["var(--takeoff-volume)", "var(--takeoff-volume-bg)"],
  region: ["var(--takeoff-region)", "var(--takeoff-region-bg)"],
  slope: ["var(--takeoff-slope)", "var(--takeoff-slope-bg)"]
};
const TYPE_LABEL = {
  area: "Area",
  linear: "Linear",
  count: "Count",
  volume: "Volume",
  region: "Region",
  slope: "Slope"
};
function MeasurementChip({
  type = "area",
  label,
  value,
  unit,
  selected = false,
  onClick,
  className = "",
  ...rest
}) {
  const [c, bg] = COLORS[type] || COLORS.area;
  const Tag = onClick ? "button" : "div";
  return /*#__PURE__*/React.createElement(Tag, _extends({
    type: onClick ? "button" : undefined,
    className: ["pl-mchip", className].filter(Boolean).join(" "),
    style: {
      "--_c": c,
      "--_bg": bg
    },
    "data-selected": selected,
    onClick: onClick
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pl-mchip__swatch"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pl-mchip__main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-mchip__label"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "pl-mchip__type"
  }, TYPE_LABEL[type] || type)), /*#__PURE__*/React.createElement("span", {
    className: "pl-mchip__value"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-mchip__num"
  }, value), unit ? /*#__PURE__*/React.createElement("span", {
    className: "pl-mchip__unit"
  }, unit) : null));
}
Object.assign(__ds_scope, { MeasurementChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/takeoff/MeasurementChip.jsx", error: String((e && e.message) || e) }); }

// components/takeoff/SheetThumb.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* SheetThumb — a plan-sheet thumbnail tile for the sheets panel / project grid.
   Shows a preview (image or blueprint placeholder), the sheet code, name,
   measurement count, and selected/active state. */
const CSS = `
.pl-sheet{
  display:flex; flex-direction:column;
  width:100%; padding:0; overflow:hidden; text-align:left;
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-md);
  cursor:pointer;
  transition:border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
}
.pl-sheet:hover{ border-color:var(--border-strong); box-shadow:var(--shadow-sm); }
.pl-sheet[data-selected="true"]{ border-color:var(--brand-500); box-shadow:0 0 0 2px var(--brand-100); }
.pl-sheet__preview{
  position:relative; aspect-ratio:4/3; background:var(--paper-0);
  background-image:linear-gradient(var(--paper-line) 1px, transparent 1px), linear-gradient(90deg, var(--paper-line) 1px, transparent 1px);
  background-size:14px 14px;
  border-bottom:var(--border-hairline) solid var(--border-subtle);
  overflow:hidden;
}
.pl-sheet__preview img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.pl-sheet__code{
  position:absolute; top:6px; left:6px;
  font-family:var(--font-mono); font-size:10px; font-weight:600; letter-spacing:.04em;
  padding:2px 5px; border-radius:var(--radius-xs);
  background:var(--surface-inverse); color:var(--text-inverse);
}
.pl-sheet__count{
  position:absolute; bottom:6px; right:6px;
  display:inline-flex; align-items:center; gap:4px;
  font-family:var(--font-mono); font-size:10px; font-weight:600;
  padding:2px 6px; border-radius:var(--radius-pill);
  background:var(--surface-card); border:1px solid var(--border-default); color:var(--text-body);
}
.pl-sheet__meta{ display:flex; align-items:center; justify-content:space-between; gap:var(--space-4); padding:var(--space-4) var(--space-5); }
.pl-sheet__name{ font-size:var(--text-sm); font-weight:var(--weight-semibold); color:var(--text-strong); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pl-sheet__scale{ font-family:var(--font-mono); font-size:10px; color:var(--text-subtle); white-space:nowrap; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-sheet-css")) {
  const el = document.createElement("style");
  el.id = "pl-sheet-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function SheetThumb({
  code,
  name,
  scale,
  count,
  src,
  selected = false,
  onClick,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: ["pl-sheet", className].filter(Boolean).join(" "),
    "data-selected": selected,
    onClick: onClick
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pl-sheet__preview"
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : null, code ? /*#__PURE__*/React.createElement("span", {
    className: "pl-sheet__code"
  }, code) : null, count != null ? /*#__PURE__*/React.createElement("span", {
    className: "pl-sheet__count"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  })), count) : null), /*#__PURE__*/React.createElement("span", {
    className: "pl-sheet__meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pl-sheet__name"
  }, name), scale ? /*#__PURE__*/React.createElement("span", {
    className: "pl-sheet__scale"
  }, scale) : null));
}
Object.assign(__ds_scope, { SheetThumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/takeoff/SheetThumb.jsx", error: String((e && e.message) || e) }); }

// components/takeoff/ToolRail.jsx
try { (() => {
/* ToolRail — vertical rail of takeoff tools. Each tool has an icon, an
   accessible label, an optional keyboard shortcut, and a selected state.
   Compose with the icon set of your choice (pass icon nodes). */
const CSS = `
.pl-rail{
  display:inline-flex; flex-direction:column; gap:var(--space-3);
  padding:var(--space-4);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-sm);
}
.pl-rail__group{ display:flex; flex-direction:column; gap:var(--space-3); }
.pl-rail__sep{ height:1px; margin:var(--space-2) var(--space-2); background:var(--border-subtle); }
.pl-tool{
  position:relative; display:inline-flex; align-items:center; justify-content:center;
  width:var(--control-lg); height:var(--control-lg);
  border:var(--border-hairline) solid transparent; border-radius:var(--radius-md);
  background:transparent; color:var(--text-body); cursor:pointer;
  transition:background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.pl-tool svg{ width:20px; height:20px; }
.pl-tool:hover{ background:var(--surface-muted); }
.pl-tool:focus-visible{ outline:none; box-shadow:var(--focus-ring); }
.pl-tool[aria-pressed="true"]{ background:var(--brand-600); color:var(--action-primary-fg); border-color:var(--brand-700); box-shadow:var(--shadow-xs); }
.pl-tool__kbd{
  position:absolute; right:3px; bottom:2px;
  font-family:var(--font-mono); font-size:9px; line-height:1; color:var(--text-subtle);
}
.pl-tool[aria-pressed="true"] .pl-tool__kbd{ color:rgba(255,255,255,.7); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-rail-css")) {
  const el = document.createElement("style");
  el.id = "pl-rail-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}
function ToolRail({
  tools = [],
  value,
  onChange,
  className = ""
}) {
  // tools: [{ id, label, icon, shortcut } | "divider"]
  return /*#__PURE__*/React.createElement("div", {
    className: ["pl-rail", className].filter(Boolean).join(" "),
    role: "toolbar",
    "aria-orientation": "vertical"
  }, tools.map((t, i) => t === "divider" ? /*#__PURE__*/React.createElement("div", {
    key: "sep" + i,
    className: "pl-rail__sep"
  }) : /*#__PURE__*/React.createElement("button", {
    key: t.id,
    type: "button",
    className: "pl-tool",
    "aria-label": t.label,
    title: t.shortcut ? `${t.label} (${t.shortcut})` : t.label,
    "aria-pressed": value === t.id,
    onClick: () => onChange && onChange(t.id)
  }, t.icon, t.shortcut ? /*#__PURE__*/React.createElement("span", {
    className: "pl-tool__kbd"
  }, t.shortcut) : null)));
}
Object.assign(__ds_scope, { ToolRail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/takeoff/ToolRail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Projects.jsx
try { (() => {
/* Plotline projects dashboard — landing screen of the app. */

const PRJ_CSS = `
.prj{ position:fixed; inset:0; display:flex; flex-direction:column; background:var(--bg-app); font-family:var(--font-sans); color:var(--text-body); overflow:auto; }
.prj-top{ height:var(--topbar); flex:0 0 auto; display:flex; align-items:center; gap:var(--space-7); padding:0 var(--space-8); background:var(--surface-card); border-bottom:1px solid var(--border-default); position:sticky; top:0; z-index:5; }
.prj-brand{ display:flex; align-items:center; gap:9px; }
.prj-brand img{ width:26px; height:26px; }
.prj-brand b{ font-family:var(--font-display); font-weight:700; font-size:17px; letter-spacing:-0.02em; color:var(--text-strong); }
.prj-brand .dot{ color:var(--brand-600); }
.prj-nav{ display:flex; align-items:center; gap:2px; }
.prj-nav a{ font-size:13px; font-weight:600; color:var(--text-muted); padding:6px 11px; border-radius:var(--radius-sm); text-decoration:none; cursor:pointer; }
.prj-nav a[data-on="true"]{ color:var(--text-strong); background:var(--surface-muted); }
.prj-search{ margin-left:auto; }
.prj-main{ max-width:1120px; width:100%; margin:0 auto; padding:var(--space-9) var(--space-8) var(--space-12); }
.prj-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin-bottom:var(--space-7); }
.prj-head h1{ font-family:var(--font-display); font-size:30px; font-weight:600; letter-spacing:-0.02em; color:var(--text-strong); margin:0 0 4px; }
.prj-head p{ margin:0; color:var(--text-muted); font-size:14px; }
.prj-stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:var(--space-8); }
.prj-stat{ background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-lg); padding:var(--space-6); }
.prj-stat .k{ font-size:12px; color:var(--text-muted); }
.prj-stat .v{ font-family:var(--font-mono); font-size:26px; font-weight:600; color:var(--text-strong); margin-top:4px; letter-spacing:-0.01em; }
.prj-stat .v.brand{ color:var(--text-brand); }
.prj-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
.prj-card{ display:flex; flex-direction:column; background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-lg); overflow:hidden; cursor:pointer; transition:box-shadow var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard); }
.prj-card:hover{ box-shadow:var(--shadow-md); transform:translateY(-2px); border-color:var(--border-strong); }
.prj-prev{ position:relative; aspect-ratio:16/9; background:var(--paper-0); background-image:linear-gradient(var(--paper-line) 1px,transparent 1px),linear-gradient(90deg,var(--paper-line) 1px,transparent 1px); background-size:18px 18px; border-bottom:1px solid var(--border-subtle); overflow:hidden; }
.prj-prev .badge{ position:absolute; top:10px; right:10px; }
.prj-prev svg{ position:absolute; inset:0; }
.prj-card-body{ padding:var(--space-6); display:flex; flex-direction:column; gap:10px; }
.prj-card-body h3{ margin:0; font-size:16px; font-weight:600; color:var(--text-strong); }
.prj-card-body .client{ font-size:13px; color:var(--text-muted); margin-top:-6px; }
.prj-meta{ display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid var(--border-subtle); }
.prj-meta .sheets{ font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:6px; }
.prj-meta .bid{ font-family:var(--font-mono); font-weight:600; font-size:15px; color:var(--text-strong); }
`;
if (!document.getElementById("prj-css")) {
  const el = document.createElement("style");
  el.id = "prj-css";
  el.textContent = PRJ_CSS;
  document.head.appendChild(el);
}
const PROJECTS = [{
  name: "Maple Grove Estates",
  client: "Hilltop Developments",
  sheets: 3,
  bid: "$48,210",
  status: ["success", "Bid sent"],
  poly: "30,70 150,55 175,120 45,135",
  color: "var(--takeoff-area)"
}, {
  name: "Riverside Commons",
  client: "City of Fairview",
  sheets: 6,
  bid: "$182,400",
  status: ["warning", "Draft"],
  poly: "40,40 180,60 170,130 30,110",
  color: "var(--takeoff-volume)"
}, {
  name: "Oakmont Clubhouse",
  client: "Oakmont HOA",
  sheets: 4,
  bid: "$96,750",
  status: ["brand", "Won"],
  poly: "50,50 160,45 185,120 60,135",
  color: "var(--takeoff-linear)"
}, {
  name: "Cedar Park Trailhead",
  client: "Parks & Rec",
  sheets: 2,
  bid: "$31,900",
  status: ["success", "Bid sent"],
  line: "30,120 80,60 130,100 185,50",
  color: "var(--takeoff-count)"
}, {
  name: "Lakeshore Townhomes",
  client: "Beacon Living",
  sheets: 5,
  bid: "$124,000",
  status: ["neutral", "Archived"],
  poly: "35,60 175,50 165,125 45,120",
  color: "var(--takeoff-region)"
}, {
  name: "Summit Office Park",
  client: "Vantage RE",
  sheets: 7,
  bid: "$210,500",
  status: ["warning", "Draft"],
  poly: "45,45 170,65 180,125 30,115",
  color: "var(--takeoff-slope)"
}];
function Projects({
  onOpen
}) {
  const {
    Input,
    Button,
    Badge,
    Avatar
  } = window.PlotlineDesignSystem_0cdb69;
  return /*#__PURE__*/React.createElement("div", {
    className: "prj"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prj-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prj-brand"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/plotline-mark.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("b", null, "Plotline", /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."))), /*#__PURE__*/React.createElement("div", {
    className: "prj-nav"
  }, /*#__PURE__*/React.createElement("a", {
    "data-on": "true"
  }, "Projects"), /*#__PURE__*/React.createElement("a", null, "Templates"), /*#__PURE__*/React.createElement("a", null, "Pricebook"), /*#__PURE__*/React.createElement("a", null, "Team")), /*#__PURE__*/React.createElement("div", {
    className: "prj-search",
    style: {
      width: 240
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search projects\u2026",
    size: "sm",
    leadingIcon: /*#__PURE__*/React.createElement(KitIcon, {
      name: "search",
      size: 15
    })
  })), /*#__PURE__*/React.createElement(Avatar, {
    name: "Amy Reyes",
    status: "online"
  })), /*#__PURE__*/React.createElement("div", {
    className: "prj-main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prj-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Projects"), /*#__PURE__*/React.createElement("p", null, "6 active \xB7 2 awaiting decision")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(KitIcon, {
      name: "plus",
      size: 16
    }),
    onClick: () => onOpen(PROJECTS[0])
  }, "New project")), /*#__PURE__*/React.createElement("div", {
    className: "prj-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "prj-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Open bids"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "6")), /*#__PURE__*/React.createElement("div", {
    className: "prj-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Pipeline value"), /*#__PURE__*/React.createElement("div", {
    className: "v brand"
  }, "$693,760")), /*#__PURE__*/React.createElement("div", {
    className: "prj-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Win rate (90d)"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "42%")), /*#__PURE__*/React.createElement("div", {
    className: "prj-stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, "Sheets measured"), /*#__PURE__*/React.createElement("div", {
    className: "v"
  }, "27"))), /*#__PURE__*/React.createElement("div", {
    className: "prj-grid"
  }, PROJECTS.map((p, i) => /*#__PURE__*/React.createElement("div", {
    className: "prj-card",
    key: i,
    onClick: () => onOpen(p)
  }, /*#__PURE__*/React.createElement("div", {
    className: "prj-prev"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 220 160",
    fill: "none"
  }, p.poly && /*#__PURE__*/React.createElement("polygon", {
    points: p.poly,
    fill: p.color,
    fillOpacity: "0.16",
    stroke: p.color,
    strokeWidth: "2.5"
  }), p.line && /*#__PURE__*/React.createElement("polyline", {
    points: p.line,
    fill: "none",
    stroke: p.color,
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, /*#__PURE__*/React.createElement(Badge, {
    variant: p.status[0],
    dot: p.status[0] === "success"
  }, p.status[1]))), /*#__PURE__*/React.createElement("div", {
    className: "prj-card-body"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", null, p.name), /*#__PURE__*/React.createElement("div", {
    className: "client"
  }, p.client)), /*#__PURE__*/React.createElement("div", {
    className: "prj-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "sheets"
  }, /*#__PURE__*/React.createElement(KitIcon, {
    name: "map",
    size: 14
  }), " ", p.sheets, " sheets"), /*#__PURE__*/React.createElement("span", {
    className: "bid"
  }, p.bid))))))));
}
Object.assign(window, {
  Projects
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Projects.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/Workspace.jsx
try { (() => {
/* Plotline takeoff workspace — the product's core screen.
   Topbar · tool rail · sheets/layers panel · plan canvas · estimate panel. */

const WS_CSS = `
.ws{ position:fixed; inset:0; display:flex; flex-direction:column; background:var(--bg-app); font-family:var(--font-sans); color:var(--text-body); }
.ws *{ box-sizing:border-box; }

/* Topbar */
.ws-top{ height:var(--topbar); flex:0 0 auto; display:flex; align-items:center; gap:var(--space-6); padding:0 var(--space-6); background:var(--surface-card); border-bottom:1px solid var(--border-default); z-index:5; }
.ws-brand{ display:flex; align-items:center; gap:9px; }
.ws-brand img{ width:26px; height:26px; }
.ws-brand b{ font-family:var(--font-display); font-weight:700; font-size:17px; letter-spacing:-0.02em; color:var(--text-strong); }
.ws-brand .dot{ color:var(--brand-600); }
.ws-crumb{ display:flex; align-items:center; gap:8px; font-size:13px; color:var(--text-muted); }
.ws-crumb .sep{ color:var(--border-strong); }
.ws-crumb b{ color:var(--text-strong); font-weight:600; }
.ws-top-right{ margin-left:auto; display:flex; align-items:center; gap:var(--space-5); }
.ws-zoom{ display:flex; align-items:center; gap:2px; background:var(--surface-sunken); border:1px solid var(--border-default); border-radius:var(--radius-md); padding:2px; }
.ws-zoom .z{ width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:var(--radius-sm); color:var(--text-body); cursor:pointer; }
.ws-zoom .z:hover{ background:var(--surface-card); }
.ws-zoom .val{ font-family:var(--font-mono); font-size:12px; color:var(--text-body); min-width:42px; text-align:center; }
.ws-avatars{ display:flex; }
.ws-avatars > *{ margin-left:-8px; }

/* Body grid */
.ws-body{ flex:1 1 auto; display:flex; min-height:0; }
.ws-rail{ width:var(--rail-left); flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:var(--space-3); padding:var(--space-5) 0; background:var(--surface-card); border-right:1px solid var(--border-default); }
.ws-rail .tool{ position:relative; width:40px; height:40px; display:inline-flex; align-items:center; justify-content:center; border:1px solid transparent; border-radius:var(--radius-md); background:transparent; color:var(--text-body); cursor:pointer; transition:background var(--dur-fast) var(--ease-standard); }
.ws-rail .tool:hover{ background:var(--surface-muted); }
.ws-rail .tool[data-on="true"]{ background:var(--brand-600); color:#fff; border-color:var(--brand-700); }
.ws-rail .tool .kbd{ position:absolute; right:2px; bottom:1px; font-family:var(--font-mono); font-size:8px; color:var(--text-subtle); }
.ws-rail .tool[data-on="true"] .kbd{ color:rgba(255,255,255,.7); }
.ws-rail .sep{ width:24px; height:1px; background:var(--border-subtle); margin:2px 0; }

/* Left panel */
.ws-left{ width:var(--panel-left); flex:0 0 auto; display:flex; flex-direction:column; background:var(--surface-card); border-right:1px solid var(--border-default); min-height:0; }
.ws-left .ph{ padding:var(--space-5) var(--space-6) var(--space-4); display:flex; align-items:center; justify-content:space-between; }
.ws-left .ph h3{ margin:0; font-family:var(--font-display); font-size:15px; font-weight:600; color:var(--text-strong); }
.ws-tabs{ padding:0 var(--space-5); }
.ws-scroll{ overflow:auto; padding:var(--space-5) var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }
.ws-layer{ display:flex; align-items:center; gap:10px; }
.ws-layer .eye{ width:26px; height:26px; display:inline-flex; align-items:center; justify-content:center; border:none; background:transparent; border-radius:var(--radius-sm); color:var(--text-subtle); cursor:pointer; flex:0 0 auto; }
.ws-layer .eye:hover{ background:var(--surface-muted); color:var(--text-body); }
.ws-layer .eye[data-off="true"]{ color:var(--border-strong); }
.ws-sheets-grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }

/* Canvas */
.ws-canvas{ flex:1 1 auto; position:relative; background:var(--bg-canvas); background-image:var(--grid-blueprint); background-size:var(--grid-size) var(--grid-size); display:flex; align-items:center; justify-content:center; overflow:hidden; min-width:0; }
.ws-sheet-wrap{ transition:transform var(--dur-base) var(--ease-out); }
.ws-sheet{ position:relative; background:var(--surface-paper); border:1px solid var(--paper-edge); border-radius:3px; box-shadow:var(--sheet-shadow); background-image:linear-gradient(var(--paper-line) 1px,transparent 1px),linear-gradient(90deg,var(--paper-line) 1px,transparent 1px); background-size:24px 24px; }
.ws-titleblock{ position:absolute; right:14px; bottom:14px; width:150px; border:1px solid var(--paper-edge); background:rgba(255,255,255,.6); border-radius:3px; font-family:var(--font-mono); font-size:9px; color:var(--text-muted); }
.ws-titleblock div{ padding:4px 7px; border-bottom:1px solid var(--paper-edge); }
.ws-titleblock div:last-child{ border-bottom:none; }
.ws-titleblock b{ color:var(--text-strong); font-size:11px; }
.ws-callout{ position:absolute; transform:translate(-50%,-50%); font-family:var(--font-mono); font-size:11px; font-weight:600; padding:3px 7px; border-radius:var(--radius-sm); white-space:nowrap; box-shadow:var(--shadow-sm); pointer-events:none; }
.ws-hint{ position:absolute; top:12px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text-body); background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-pill); padding:6px 14px; box-shadow:var(--shadow-sm); }
.ws-hint b{ color:var(--text-strong); }
.ws-scale{ position:absolute; left:14px; bottom:14px; display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; color:var(--text-body); background:var(--surface-card); border:1px solid var(--border-default); border-radius:var(--radius-sm); padding:5px 10px; box-shadow:var(--shadow-xs); }
.ws-scale .ruler{ width:46px; height:6px; border:1px solid var(--text-body); border-top:none; }

/* Right panel */
.ws-right{ width:var(--panel-right); flex:0 0 auto; display:flex; flex-direction:column; background:var(--surface-card); border-left:1px solid var(--border-default); min-height:0; }
.ws-right .ph{ padding:var(--space-6); display:flex; flex-direction:column; gap:3px; border-bottom:1px solid var(--border-subtle); }
.ws-right .ph h3{ margin:0; font-family:var(--font-display); font-size:16px; font-weight:600; color:var(--text-strong); }
.ws-right .ph span{ font-size:12px; color:var(--text-muted); }
.ws-est{ flex:1 1 auto; overflow:auto; }
.ws-est-foot{ padding:var(--space-6); border-top:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:var(--space-5); }
`;
if (!document.getElementById("ws-css")) {
  const el = document.createElement("style");
  el.id = "ws-css";
  el.textContent = WS_CSS;
  document.head.appendChild(el);
}
const TOOLS = [{
  id: "pan",
  label: "Pan",
  icon: "hand",
  k: "H"
}, {
  id: "area",
  label: "Area",
  icon: "square-dashed",
  k: "A"
}, {
  id: "linear",
  label: "Linear",
  icon: "spline",
  k: "L"
}, {
  id: "count",
  label: "Count",
  icon: "locate",
  k: "C"
}, {
  id: "volume",
  label: "Volume",
  icon: "box",
  k: "V"
}, "sep", {
  id: "scale",
  label: "Set scale",
  icon: "ruler",
  k: "S"
}, {
  id: "note",
  label: "Note",
  icon: "message-square",
  k: "N"
}];

// Measurements with geometry on the sheet (sheet viewBox 880x620)
const MEAS = [{
  id: "a1",
  type: "area",
  label: "Sod — rear lawn",
  value: "4,820",
  unit: "sq ft",
  qty: 4820,
  poly: "120,150 470,130 520,360 150,400",
  cx: 300,
  cy: 270
}, {
  id: "a2",
  type: "area",
  label: "Sod — side yard",
  value: "1,640",
  unit: "sq ft",
  qty: 1640,
  poly: "560,120 690,135 700,300 575,300",
  cx: 628,
  cy: 215
}, {
  id: "v1",
  type: "volume",
  label: "Mulch beds 3″",
  value: "38",
  unit: "cu yd",
  qty: 38,
  poly: "150,430 360,430 360,510 150,510",
  cx: 255,
  cy: 470
}, {
  id: "l1",
  type: "linear",
  label: "Steel edging",
  value: "312",
  unit: "ln ft",
  qty: 312,
  line: "120,150 470,130 520,360 150,400 120,150",
  cx: 90,
  cy: 275
}, {
  id: "c1",
  type: "count",
  label: "Shade trees",
  value: "9",
  unit: "ea",
  qty: 9,
  pts: [[200, 190], [330, 175], [440, 200], [250, 330], [400, 320], [610, 170], [660, 260], [230, 470], [320, 470]]
}];
const TYPE_COLOR = {
  area: "var(--takeoff-area)",
  linear: "var(--takeoff-linear)",
  count: "var(--takeoff-count)",
  volume: "var(--takeoff-volume)",
  region: "var(--takeoff-region)",
  slope: "var(--takeoff-slope)"
};
const TYPE_BG = {
  area: "var(--takeoff-area-bg)",
  linear: "var(--takeoff-linear-bg)",
  count: "var(--takeoff-count-bg)",
  volume: "var(--takeoff-volume-bg)"
};
function Workspace({
  onExport
}) {
  const {
    Tabs,
    Badge,
    Avatar,
    Button,
    MeasurementChip,
    Tooltip
  } = window.PlotlineDesignSystem_0cdb69;
  const [tool, setTool] = React.useState("area");
  const [zoom, setZoom] = React.useState(100);
  const [sel, setSel] = React.useState("a1");
  const [panel, setPanel] = React.useState("layers");
  const [hidden, setHidden] = React.useState({});
  const sheetW = 880,
    sheetH = 620,
    scale = 0.62;
  const toggle = id => setHidden(h => ({
    ...h,
    [id]: !h[id]
  }));
  const visible = m => !hidden[m.id];
  return /*#__PURE__*/React.createElement("div", {
    className: "ws"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-brand"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/plotline-mark.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("b", null, "Plotline", /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }, "."))), /*#__PURE__*/React.createElement("div", {
    className: "ws-crumb"
  }, /*#__PURE__*/React.createElement("span", null, "Maple Grove Estates"), /*#__PURE__*/React.createElement("span", {
    className: "sep"
  }, "/"), /*#__PURE__*/React.createElement("b", null, "L-2 \xB7 Planting Plan")), /*#__PURE__*/React.createElement("div", {
    className: "ws-top-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-zoom"
  }, /*#__PURE__*/React.createElement("button", {
    className: "z",
    onClick: () => setZoom(z => Math.max(25, z - 25))
  }, /*#__PURE__*/React.createElement(KitIcon, {
    name: "minus",
    size: 15
  })), /*#__PURE__*/React.createElement("span", {
    className: "val"
  }, zoom, "%"), /*#__PURE__*/React.createElement("button", {
    className: "z",
    onClick: () => setZoom(z => Math.min(200, z + 25))
  }, /*#__PURE__*/React.createElement(KitIcon, {
    name: "plus",
    size: 15
  }))), /*#__PURE__*/React.createElement(Badge, {
    variant: "success",
    dot: true
  }, "Synced"), /*#__PURE__*/React.createElement("div", {
    className: "ws-avatars"
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Amy Reyes",
    size: "sm",
    ring: true,
    status: "online"
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: "Jordan Tate",
    size: "sm",
    ring: true
  })), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary",
    iconLeft: /*#__PURE__*/React.createElement(KitIcon, {
      name: "share-2",
      size: 15
    })
  }, "Share"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary",
    iconLeft: /*#__PURE__*/React.createElement(KitIcon, {
      name: "file-down",
      size: 15
    }),
    onClick: onExport
  }, "Export"))), /*#__PURE__*/React.createElement("div", {
    className: "ws-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-rail"
  }, TOOLS.map((t, i) => t === "sep" ? /*#__PURE__*/React.createElement("div", {
    className: "sep",
    key: "s" + i
  }) : /*#__PURE__*/React.createElement(Tooltip, {
    key: t.id,
    label: t.label,
    shortcut: t.k,
    side: "bottom"
  }, /*#__PURE__*/React.createElement("button", {
    className: "tool",
    "data-on": tool === t.id,
    onClick: () => setTool(t.id),
    "aria-label": t.label
  }, /*#__PURE__*/React.createElement(KitIcon, {
    name: t.icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", {
    className: "kbd"
  }, t.k))))), /*#__PURE__*/React.createElement("div", {
    className: "ws-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-tabs",
    style: {
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    variant: "pill",
    value: panel,
    onChange: setPanel,
    items: [{
      value: "layers",
      label: "Layers",
      count: MEAS.length
    }, {
      value: "sheets",
      label: "Sheets",
      count: 3
    }]
  })), panel === "layers" ? /*#__PURE__*/React.createElement("div", {
    className: "ws-scroll"
  }, MEAS.map(m => /*#__PURE__*/React.createElement("div", {
    className: "ws-layer",
    key: m.id
  }, /*#__PURE__*/React.createElement("button", {
    className: "eye",
    "data-off": !visible(m),
    onClick: () => toggle(m.id),
    "aria-label": "Toggle visibility"
  }, /*#__PURE__*/React.createElement(KitIcon, {
    name: visible(m) ? "eye" : "eye-off",
    size: 16
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(MeasurementChip, {
    type: m.type,
    label: m.label,
    value: m.value,
    unit: m.unit,
    selected: sel === m.id,
    onClick: () => setSel(m.id)
  }))))) : /*#__PURE__*/React.createElement("div", {
    className: "ws-scroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-sheets-grid"
  }, window.PlotlineDesignSystem_0cdb69.SheetThumb ? [["L-1", "Site Plan", `1"=30'`, 8, false], ["L-2", "Planting", `1"=20'`, MEAS.length, true], ["L-3", "Grading", `1"=20'`, 5, false], ["D-1", "Details", `NTS`, 2, false]].map(([code, name, sc, ct, on]) => React.createElement(window.PlotlineDesignSystem_0cdb69.SheetThumb, {
    key: code,
    code,
    name,
    scale: sc,
    count: ct,
    selected: on
  })) : null))), /*#__PURE__*/React.createElement("div", {
    className: "ws-canvas",
    "data-tool": tool
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-hint"
  }, /*#__PURE__*/React.createElement(KitIcon, {
    name: tool === "pan" ? "hand" : tool === "area" ? "square-dashed" : tool === "linear" ? "spline" : tool === "count" ? "locate" : tool === "volume" ? "box" : tool === "scale" ? "ruler" : "message-square",
    size: 15
  }), tool === "pan" ? /*#__PURE__*/React.createElement("span", null, "Drag to pan \xB7 scroll to zoom") : tool === "scale" ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "Set scale"), " \xB7 click two points of known distance") : /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, TOOLS.find(t => t.id === tool)?.label), " tool \xB7 click to place vertices, double-click to finish")), /*#__PURE__*/React.createElement("div", {
    className: "ws-sheet-wrap",
    style: {
      transform: `scale(${zoom / 100 * scale})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ws-sheet",
    style: {
      width: sheetW,
      height: sheetH
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: sheetW,
    height: sheetH,
    viewBox: `0 0 ${sheetW} ${sheetH}`,
    style: {
      position: "absolute",
      inset: 0
    }
  }, MEAS.filter(visible).map(m => {
    const c = TYPE_COLOR[m.type];
    const on = sel === m.id;
    if (m.poly) {
      const fill = m.type === "volume" ? "rgba(124,58,237,.13)" : "rgba(46,158,79,.15)";
      return /*#__PURE__*/React.createElement("g", {
        key: m.id,
        onClick: () => setSel(m.id),
        style: {
          cursor: "pointer"
        }
      }, /*#__PURE__*/React.createElement("polygon", {
        points: m.poly,
        fill: fill,
        stroke: c,
        strokeWidth: on ? 3 : 2,
        strokeDasharray: m.type === "volume" ? "7 5" : "0"
      }), on && m.poly.split(" ").map((p, idx) => {
        const [x, y] = p.split(",");
        return /*#__PURE__*/React.createElement("rect", {
          key: idx,
          x: +x - 4,
          y: +y - 4,
          width: "8",
          height: "8",
          fill: "#fff",
          stroke: c,
          strokeWidth: "2"
        });
      }));
    }
    if (m.line) {
      return /*#__PURE__*/React.createElement("g", {
        key: m.id,
        onClick: () => setSel(m.id),
        style: {
          cursor: "pointer"
        }
      }, /*#__PURE__*/React.createElement("polyline", {
        points: m.line,
        fill: "none",
        stroke: c,
        strokeWidth: on ? 4 : 3,
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }));
    }
    if (m.pts) {
      return /*#__PURE__*/React.createElement("g", {
        key: m.id,
        onClick: () => setSel(m.id),
        style: {
          cursor: "pointer"
        }
      }, m.pts.map(([x, y], idx) => /*#__PURE__*/React.createElement("g", {
        key: idx
      }, /*#__PURE__*/React.createElement("circle", {
        cx: x,
        cy: y,
        r: on ? 9 : 8,
        fill: "#fff",
        stroke: c,
        strokeWidth: on ? 3 : 2
      }), /*#__PURE__*/React.createElement("circle", {
        cx: x,
        cy: y,
        r: "3",
        fill: c
      }))));
    }
    return null;
  })), MEAS.filter(m => visible(m) && m.cx).map(m => {
    const c = TYPE_COLOR[m.type];
    const bg = TYPE_BG[m.type] || "#fff";
    const on = sel === m.id;
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      className: "ws-callout",
      style: {
        left: `${m.cx / sheetW * 100}%`,
        top: `${m.cy / sheetH * 100}%`,
        background: on ? c : bg,
        color: on ? "#fff" : c,
        border: `1px solid ${on ? c : "transparent"}`
      }
    }, m.value, " ", m.unit);
  }), /*#__PURE__*/React.createElement("div", {
    className: "ws-titleblock"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "PLANTING PLAN")), /*#__PURE__*/React.createElement("div", null, "Maple Grove Estates"), /*#__PURE__*/React.createElement("div", null, "SHEET L-2 \xB7 1\" = 20'-0\"")))), /*#__PURE__*/React.createElement("div", {
    className: "ws-scale"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ruler"
  }), " 20'-0\" \xB7 1\" = 20'")), /*#__PURE__*/React.createElement("div", {
    className: "ws-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph"
  }, /*#__PURE__*/React.createElement("h3", null, "Estimate"), /*#__PURE__*/React.createElement("span", null, "Maple Grove Estates \xB7 live from takeoff")), /*#__PURE__*/React.createElement("div", {
    className: "ws-est"
  }, (() => {
    const ER = window.PlotlineDesignSystem_0cdb69.EstimateRow;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(ER, {
      header: true
    }), /*#__PURE__*/React.createElement(ER, {
      type: "area",
      name: "Sod & turf",
      source: "L-2 \xB7 2 areas",
      quantity: "6,460",
      unit: "sq ft",
      unitPrice: "$0.85 / sq ft",
      total: "$5,491"
    }), /*#__PURE__*/React.createElement(ER, {
      type: "linear",
      name: "Steel edging",
      source: "L-2 \xB7 1 run",
      quantity: "312",
      unit: "ln ft",
      unitPrice: "$6.20 / ln ft",
      total: "$1,934"
    }), /*#__PURE__*/React.createElement(ER, {
      type: "count",
      name: "Shade trees",
      source: "L-2 \xB7 9 pts",
      quantity: "9",
      unit: "ea",
      unitPrice: "$420 / ea",
      total: "$3,780"
    }), /*#__PURE__*/React.createElement(ER, {
      type: "volume",
      name: "Mulch, 3\u2033 beds",
      source: "L-2 \xB7 1 region",
      quantity: "38",
      unit: "cu yd",
      unitPrice: "$52 / cu yd",
      total: "$1,976"
    }));
  })()), /*#__PURE__*/React.createElement("div", {
    className: "ws-est-foot"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: "var(--text-muted)"
    }
  }, "Subtotal \xB7 4 categories"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-mono)",
      fontWeight: 600,
      fontSize: 15,
      color: "var(--text-strong)"
    }
  }, "$13,181")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    iconLeft: /*#__PURE__*/React.createElement(KitIcon, {
      name: "file-down",
      size: 16
    }),
    onClick: onExport
  }, "Export estimate")))));
}
Object.assign(window, {
  Workspace
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/Workspace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/common.jsx
try { (() => {
/* Shared helpers for the Plotline app UI kit.
   Exposes window.KitIcon (React icon component backed by Lucide). */

function KitIcon({
  name,
  size = 18,
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = "";
      const n = window.plIconSVG ? window.plIconSVG(name, {
        size
      }) : null;
      if (n) ref.current.appendChild(n);
    }
  }, [name, size]);
  return React.createElement("span", {
    ref,
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      ...style
    }
  });
}
Object.assign(window, {
  KitIcon
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/common.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.EstimateRow = __ds_scope.EstimateRow;

__ds_ns.MeasurementChip = __ds_scope.MeasurementChip;

__ds_ns.SheetThumb = __ds_scope.SheetThumb;

__ds_ns.ToolRail = __ds_scope.ToolRail;

})();
