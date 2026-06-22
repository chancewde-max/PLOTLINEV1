import React from "react";

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

export function Switch({ label, disabled = false, className = "", ...rest }) {
  return (
    <label className={["pl-switch", disabled ? "pl-switch--disabled" : "", className].filter(Boolean).join(" ")}>
      <input type="checkbox" role="switch" disabled={disabled} {...rest} />
      <span className="pl-switch__track"><span className="pl-switch__thumb" /></span>
      {label ? <span className="pl-switch__label">{label}</span> : null}
    </label>
  );
}
