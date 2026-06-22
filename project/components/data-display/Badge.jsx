import React from "react";

const CSS = `
.pl-badge{
  display:inline-flex; align-items:center; gap:var(--space-3);
  height:20px; padding:0 var(--space-4);
  font-family:var(--font-sans); font-size:var(--text-xs); font-weight:var(--weight-semibold);
  letter-spacing:var(--tracking-snug); line-height:1;
  border-radius:var(--radius-pill);
  border:var(--border-hairline) solid transparent;
  white-space:nowrap;
}
.pl-badge__dot{ width:6px; height:6px; border-radius:50%; background:currentColor; flex:0 0 auto; }
.pl-badge--neutral{ background:var(--surface-muted); color:var(--text-body); border-color:var(--border-default); }
.pl-badge--brand{ background:var(--brand-50); color:var(--brand-700); border-color:var(--brand-200); }
.pl-badge--success{ background:var(--success-bg); color:var(--success-500); }
.pl-badge--warning{ background:var(--warning-bg); color:var(--warning-500); }
.pl-badge--danger{ background:var(--danger-bg); color:var(--danger-500); }
.pl-badge--info{ background:var(--info-bg); color:var(--info-500); }
.pl-badge--solid{ background:var(--action-primary); color:var(--action-primary-fg); border-color:transparent; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-badge-css")) {
  const el = document.createElement("style");
  el.id = "pl-badge-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Badge({ variant = "neutral", dot = false, className = "", children, ...rest }) {
  return (
    <span className={["pl-badge", `pl-badge--${variant}`, className].filter(Boolean).join(" ")} {...rest}>
      {dot ? <span className="pl-badge__dot" /> : null}
      {children}
    </span>
  );
}
