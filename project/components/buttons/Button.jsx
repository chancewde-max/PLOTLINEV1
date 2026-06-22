import React from "react";

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

export function Button({
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
  const cls = [
    "pl-btn",
    `pl-btn--${variant}`,
    size !== "md" ? `pl-btn--${size}` : "",
    fullWidth ? "pl-btn--full" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button type={type} className={cls} disabled={disabled} {...rest}>
      {iconLeft ? <span className="pl-btn__icon">{iconLeft}</span> : null}
      {children != null ? <span>{children}</span> : null}
      {iconRight ? <span className="pl-btn__icon">{iconRight}</span> : null}
    </button>
  );
}
