import React from "react";

const CSS = `
.pl-tabs{ display:inline-flex; align-items:center; gap:2px; font-family:var(--font-sans); }
.pl-tabs--underline{ gap:var(--space-7); border-bottom:var(--border-hairline) solid var(--border-default); }
.pl-tabs--pill{ padding:3px; background:var(--surface-muted); border-radius:var(--radius-md); }

.pl-tab{
  position:relative; display:inline-flex; align-items:center; gap:var(--space-3);
  border:none; background:transparent; cursor:pointer;
  font-family:inherit; font-size:var(--text-sm); font-weight:var(--weight-semibold);
  color:var(--text-muted); white-space:nowrap;
  transition:color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard);
}
.pl-tab:hover{ color:var(--text-body); }
.pl-tab:focus-visible{ outline:none; box-shadow:var(--focus-ring); border-radius:var(--radius-sm); }

.pl-tabs--pill .pl-tab{ height:28px; padding:0 var(--space-6); border-radius:var(--radius-sm); }
.pl-tabs--pill .pl-tab[aria-selected="true"]{ background:var(--surface-card); color:var(--text-strong); box-shadow:var(--shadow-xs); }

.pl-tabs--underline .pl-tab{ height:38px; padding:0 1px; }
.pl-tabs--underline .pl-tab[aria-selected="true"]{ color:var(--text-strong); }
.pl-tabs--underline .pl-tab[aria-selected="true"]::after{
  content:""; position:absolute; left:0; right:0; bottom:-1px; height:2px;
  background:var(--action-primary); border-radius:2px;
}
.pl-tab__count{ font-family:var(--font-mono); font-size:var(--text-xs); color:var(--text-subtle); }
.pl-tab[aria-selected="true"] .pl-tab__count{ color:var(--text-brand); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-tabs-css")) {
  const el = document.createElement("style");
  el.id = "pl-tabs-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Tabs({ items = [], value, defaultValue, onChange, variant = "underline", className = "" }) {
  const [internal, setInternal] = React.useState(defaultValue ?? items[0]?.value);
  const active = value !== undefined ? value : internal;
  const select = (v) => { if (value === undefined) setInternal(v); onChange && onChange(v); };

  return (
    <div className={["pl-tabs", `pl-tabs--${variant}`, className].filter(Boolean).join(" ")} role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={active === it.value}
          className="pl-tab"
          onClick={() => select(it.value)}
        >
          {it.label}
          {it.count != null ? <span className="pl-tab__count">{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
