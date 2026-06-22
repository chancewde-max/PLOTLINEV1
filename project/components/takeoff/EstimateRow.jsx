import React from "react";

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
  area: "var(--takeoff-area)", linear: "var(--takeoff-linear)", count: "var(--takeoff-count)",
  volume: "var(--takeoff-volume)", region: "var(--takeoff-region)", slope: "var(--takeoff-slope)",
};

export function EstimateRow({ type, name, source, quantity, unit, unitPrice, total, header = false, isTotal = false, className = "" }) {
  if (header) {
    return (
      <div className={["pl-erow", "pl-erow--header", className].filter(Boolean).join(" ")}>
        <span>Item</span><span /><span style={{ textAlign: "right" }}>Quantity</span><span style={{ textAlign: "right" }}>Total</span>
      </div>
    );
  }
  return (
    <div
      className={["pl-erow", isTotal ? "pl-erow--total" : "", className].filter(Boolean).join(" ")}
      style={{ "--_c": COLORS[type] || "var(--slate-400)" }}
    >
      <span className="pl-erow__cat">
        {!isTotal ? <span className="pl-erow__swatch" /> : null}
      </span>
      <span className="pl-erow__name">
        <span className="pl-erow__title">{name}</span>
        {source ? <span className="pl-erow__sub">{source}</span> : null}
      </span>
      <span className="pl-erow__qty">
        {quantity != null ? <b>{quantity}</b> : null}{unit ? " " + unit : ""}
        {unitPrice ? <div style={{ color: "var(--text-subtle)" }}>@ {unitPrice}</div> : null}
      </span>
      <span className="pl-erow__total">{total}</span>
    </div>
  );
}
