import React from "react";

/* ToolRail — vertical rail of takeoff tools. Each tool has an icon, an
   accessible label, an optional keyboard shortcut, and a selected state.
   Compose with the icon set of your choice (pass icon nodes). */
const CSS = `
.pl-rail{
  display:inline-flex; flex-direction:column; gap:var(--space-3);
  padding:var(--space-4);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-sm);
}
.pl-rail__group{ display:flex; flex-direction:column; gap:var(--space-3); }
.pl-rail__sep{ height:1px; margin:var(--space-2) var(--space-2); background:var(--border-subtle); }
.pl-tool{
  position:relative; display:inline-flex; align-items:center; justify-content:center;
  width:var(--control-lg); height:var(--control-lg);
  border:var(--border-hairline) solid transparent; border-radius:var(--radius-md);
  background:transparent; color:var(--text-body); cursor:pointer;
  transition:background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard);
}
.pl-tool svg{ width:20px; height:20px; }
.pl-tool:hover{ background:var(--surface-muted); }
.pl-tool:focus-visible{ outline:none; box-shadow:var(--focus-ring); }
.pl-tool[aria-pressed="true"]{ background:var(--brand-600); color:var(--action-primary-fg); border-color:var(--brand-700); box-shadow:var(--shadow-xs); }
.pl-tool__kbd{
  position:absolute; right:3px; bottom:2px;
  font-family:var(--font-mono); font-size:9px; line-height:1; color:var(--text-subtle);
}
.pl-tool[aria-pressed="true"] .pl-tool__kbd{ color:rgba(255,255,255,.7); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-rail-css")) {
  const el = document.createElement("style");
  el.id = "pl-rail-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function ToolRail({ tools = [], value, onChange, className = "" }) {
  // tools: [{ id, label, icon, shortcut } | "divider"]
  return (
    <div className={["pl-rail", className].filter(Boolean).join(" ")} role="toolbar" aria-orientation="vertical">
      {tools.map((t, i) =>
        t === "divider" ? (
          <div key={"sep" + i} className="pl-rail__sep" />
        ) : (
          <button
            key={t.id}
            type="button"
            className="pl-tool"
            aria-label={t.label}
            title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
            aria-pressed={value === t.id}
            onClick={() => onChange && onChange(t.id)}
          >
            {t.icon}
            {t.shortcut ? <span className="pl-tool__kbd">{t.shortcut}</span> : null}
          </button>
        )
      )}
    </div>
  );
}
