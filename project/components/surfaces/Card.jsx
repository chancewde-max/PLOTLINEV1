import React from "react";

const CSS = `
.pl-card{
  display:flex; flex-direction:column;
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-sm);
  overflow:hidden;
}
.pl-card--flat{ box-shadow:none; }
.pl-card--raised{ box-shadow:var(--shadow-md); }
.pl-card--interactive{ cursor:pointer; transition:box-shadow var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard), transform var(--dur-base) var(--ease-standard); }
.pl-card--interactive:hover{ box-shadow:var(--shadow-md); border-color:var(--border-strong); transform:translateY(-1px); }
.pl-card__header{
  display:flex; align-items:center; gap:var(--space-5);
  padding:var(--space-6) var(--space-7);
  border-bottom:var(--border-hairline) solid var(--border-subtle);
}
.pl-card__titles{ display:flex; flex-direction:column; gap:2px; min-width:0; flex:1 1 auto; }
.pl-card__title{ font-family:var(--font-display); font-size:var(--text-lg); font-weight:var(--weight-semibold); color:var(--text-strong); letter-spacing:var(--tracking-snug); }
.pl-card__subtitle{ font-size:var(--text-sm); color:var(--text-muted); }
.pl-card__actions{ display:flex; align-items:center; gap:var(--space-4); flex:0 0 auto; }
.pl-card__body{ padding:var(--space-7); }
.pl-card__body--tight{ padding:var(--space-5); }
.pl-card__body--none{ padding:0; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-card-css")) {
  const el = document.createElement("style");
  el.id = "pl-card-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Card({
  title,
  subtitle,
  actions,
  elevation = "default",
  interactive = false,
  padding = "default",
  className = "",
  children,
  ...rest
}) {
  const cls = [
    "pl-card",
    elevation === "flat" ? "pl-card--flat" : elevation === "raised" ? "pl-card--raised" : "",
    interactive ? "pl-card--interactive" : "",
    className,
  ].filter(Boolean).join(" ");
  const bodyCls = "pl-card__body" + (padding === "tight" ? " pl-card__body--tight" : padding === "none" ? " pl-card__body--none" : "");

  return (
    <div className={cls} {...rest}>
      {(title || actions) ? (
        <div className="pl-card__header">
          <div className="pl-card__titles">
            {title ? <span className="pl-card__title">{title}</span> : null}
            {subtitle ? <span className="pl-card__subtitle">{subtitle}</span> : null}
          </div>
          {actions ? <div className="pl-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className={bodyCls}>{children}</div>
    </div>
  );
}
