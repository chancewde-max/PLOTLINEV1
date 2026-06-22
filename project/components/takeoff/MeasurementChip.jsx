import React from "react";

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
  slope: ["var(--takeoff-slope)", "var(--takeoff-slope-bg)"],
};
const TYPE_LABEL = { area: "Area", linear: "Linear", count: "Count", volume: "Volume", region: "Region", slope: "Slope" };

export function MeasurementChip({ type = "area", label, value, unit, selected = false, onClick, className = "", ...rest }) {
  const [c, bg] = COLORS[type] || COLORS.area;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={["pl-mchip", className].filter(Boolean).join(" ")}
      style={{ "--_c": c, "--_bg": bg }}
      data-selected={selected}
      onClick={onClick}
      {...rest}
    >
      <span className="pl-mchip__swatch" />
      <span className="pl-mchip__main">
        <span className="pl-mchip__label">{label}</span>
        <span className="pl-mchip__type">{TYPE_LABEL[type] || type}</span>
      </span>
      <span className="pl-mchip__value">
        <span className="pl-mchip__num">{value}</span>
        {unit ? <span className="pl-mchip__unit">{unit}</span> : null}
      </span>
    </Tag>
  );
}
