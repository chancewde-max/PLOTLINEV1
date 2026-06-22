import React from "react";

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

export function IconButton({
  variant = "ghost",
  size = "md",
  selected,
  disabled = false,
  label,
  className = "",
  children,
  ...rest
}) {
  const cls = [
    "pl-iconbtn",
    `pl-iconbtn--${variant}`,
    size !== "md" ? `pl-iconbtn--${size}` : "",
    className,
  ].filter(Boolean).join(" ");

  const pressed = selected === undefined ? undefined : selected ? "true" : "false";

  return (
    <button
      type="button"
      className={cls}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}
