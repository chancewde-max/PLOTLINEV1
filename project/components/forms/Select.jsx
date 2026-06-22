import React from "react";

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

const Chevron = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);

export function Select({
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
  const cls = ["pl-select", size !== "md" ? `pl-select--${size}` : "", className]
    .filter(Boolean).join(" ");

  return (
    <div className={cls}>
      {label ? <label className="pl-select__label" htmlFor={fieldId}>{label}</label> : null}
      <div className="pl-select__box">
        <select id={fieldId} {...rest}>
          {children
            ? children
            : options.map((o) => {
                const opt = typeof o === "string" ? { value: o, label: o } : o;
                return <option key={opt.value} value={opt.value}>{opt.label}</option>;
              })}
        </select>
        <span className="pl-select__chevron">{Chevron}</span>
      </div>
    </div>
  );
}
