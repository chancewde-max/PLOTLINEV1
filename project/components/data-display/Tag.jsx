import React from "react";

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
  slope: ["var(--takeoff-slope)", "var(--takeoff-slope-bg)"],
};

export function Tag({ color, tinted = false, onRemove, className = "", children, ...rest }) {
  const preset = color && TAKEOFF[color];
  const dotColor = preset ? preset[0] : color;
  const bg = preset ? preset[1] : undefined;
  const style = {
    "--_c": dotColor,
    ...(tinted ? { "--_bg": bg || "var(--surface-muted)", "--_fg": dotColor } : null),
  };
  return (
    <span
      className={["pl-tag", tinted ? "pl-tag--tinted" : "", className].filter(Boolean).join(" ")}
      style={style}
      {...rest}
    >
      <span className="pl-tag__dot" />
      <span className="pl-tag__label">{children}</span>
      {onRemove ? (
        <button type="button" className="pl-tag__close" aria-label="Remove" onClick={onRemove}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
               strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      ) : null}
    </span>
  );
}
