import React from "react";

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

export function Input({
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
  const boxCls = [
    "pl-input",
    size !== "md" ? `pl-input--${size}` : "",
    numeric ? "pl-input--num" : "",
    error ? "pl-input--error" : "",
    disabled ? "pl-input--disabled" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className="pl-field">
      {label ? (
        <label className="pl-field__label" htmlFor={fieldId}>
          {label}{required ? <span className="pl-field__req">*</span> : null}
        </label>
      ) : null}
      <div className={boxCls}>
        {leadingIcon ? <span className="pl-input__icon">{leadingIcon}</span> : null}
        <input id={fieldId} disabled={disabled} aria-invalid={!!error} {...rest} />
        {suffix ? <span className="pl-input__suffix">{suffix}</span> : null}
      </div>
      {(hint || error) ? (
        <span className={"pl-field__hint" + (error ? " pl-field__hint--error" : "")}>
          {error || hint}
        </span>
      ) : null}
    </div>
  );
}
