import React from "react";

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

const Tick = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
);

export function Checkbox({ label, description, disabled = false, className = "", ...rest }) {
  return (
    <label className={["pl-check", disabled ? "pl-check--disabled" : "", className].filter(Boolean).join(" ")}>
      <input type="checkbox" disabled={disabled} {...rest} />
      <span className="pl-check__box">{Tick}</span>
      {(label || description) ? (
        <span className="pl-check__text">
          {label ? <span className="pl-check__label">{label}</span> : null}
          {description ? <span className="pl-check__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
