import React from "react";

const CSS = `
.pl-toast{
  display:flex; align-items:flex-start; gap:var(--space-5);
  width:min(380px,92vw); padding:var(--space-5) var(--space-6);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-lg);
  font-family:var(--font-sans);
}
.pl-toast__icon{ flex:0 0 auto; width:20px; height:20px; display:inline-flex; margin-top:1px; }
.pl-toast__icon svg{ width:100%; height:100%; }
.pl-toast--success .pl-toast__icon{ color:var(--success-500); }
.pl-toast--warning .pl-toast__icon{ color:var(--warning-500); }
.pl-toast--danger .pl-toast__icon{ color:var(--danger-500); }
.pl-toast--info .pl-toast__icon{ color:var(--info-500); }
.pl-toast__body{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:2px; }
.pl-toast__title{ font-size:var(--text-base); font-weight:var(--weight-semibold); color:var(--text-strong); }
.pl-toast__msg{ font-size:var(--text-sm); color:var(--text-muted); line-height:var(--leading-snug); }
.pl-toast__close{
  flex:0 0 auto; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;
  border:none; background:transparent; border-radius:var(--radius-xs); color:var(--text-subtle); cursor:pointer; margin:-2px -4px 0 0;
}
.pl-toast__close:hover{ background:var(--surface-muted); color:var(--text-body); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-toast-css")) {
  const el = document.createElement("style");
  el.id = "pl-toast-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

const ICONS = {
  success: "M20 6 9 17l-5-5",
  warning: "M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  danger: "M18 6 6 18 M6 6l12 12",
  info: "M12 16v-4 M12 8h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
};

function GlyphTick(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>; }
function GlyphWarn(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>; }
function GlyphInfo(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>; }
function GlyphX(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>; }

const GLYPH = { success:<GlyphTick/>, warning:<GlyphWarn/>, danger:<GlyphX/>, info:<GlyphInfo/> };

export function Toast({ variant = "info", title, message, onClose, className = "", ...rest }) {
  return (
    <div className={["pl-toast", `pl-toast--${variant}`, className].filter(Boolean).join(" ")} role="status" {...rest}>
      <span className="pl-toast__icon">{GLYPH[variant]}</span>
      <div className="pl-toast__body">
        {title ? <span className="pl-toast__title">{title}</span> : null}
        {message ? <span className="pl-toast__msg">{message}</span> : null}
      </div>
      {onClose ? (
        <button type="button" className="pl-toast__close" aria-label="Dismiss" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      ) : null}
    </div>
  );
}
