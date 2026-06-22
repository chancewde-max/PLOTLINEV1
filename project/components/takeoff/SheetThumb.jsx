import React from "react";

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

export function SheetThumb({ code, name, scale, count, src, selected = false, onClick, className = "", ...rest }) {
  return (
    <button
      type="button"
      className={["pl-sheet", className].filter(Boolean).join(" ")}
      data-selected={selected}
      onClick={onClick}
      {...rest}
    >
      <span className="pl-sheet__preview">
        {src ? <img src={src} alt={name} /> : null}
        {code ? <span className="pl-sheet__code">{code}</span> : null}
        {count != null ? (
          <span className="pl-sheet__count">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
            {count}
          </span>
        ) : null}
      </span>
      <span className="pl-sheet__meta">
        <span className="pl-sheet__name">{name}</span>
        {scale ? <span className="pl-sheet__scale">{scale}</span> : null}
      </span>
    </button>
  );
}
