import React from "react";

const CSS = `
.pl-dialog__scrim{
  position:fixed; inset:0; z-index:100;
  background:var(--surface-overlay);
  backdrop-filter:blur(2px);
  display:flex; align-items:center; justify-content:center;
  padding:var(--space-8);
  animation:pl-dialog-fade var(--dur-base) var(--ease-standard);
}
.pl-dialog{
  width:100%; max-width:var(--_w,460px);
  background:var(--surface-card);
  border:var(--border-hairline) solid var(--border-default);
  border-radius:var(--radius-xl);
  box-shadow:var(--shadow-xl);
  display:flex; flex-direction:column; max-height:88vh;
  animation:pl-dialog-pop var(--dur-base) var(--ease-out);
}
.pl-dialog__head{ display:flex; align-items:flex-start; gap:var(--space-5); padding:var(--space-7) var(--space-7) var(--space-5); }
.pl-dialog__titles{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:3px; }
.pl-dialog__title{ font-family:var(--font-display); font-size:var(--text-xl); font-weight:var(--weight-semibold); color:var(--text-strong); letter-spacing:var(--tracking-snug); }
.pl-dialog__desc{ font-size:var(--text-sm); color:var(--text-muted); line-height:var(--leading-snug); }
.pl-dialog__close{
  flex:0 0 auto; width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center;
  border:none; background:transparent; border-radius:var(--radius-sm); color:var(--text-muted); cursor:pointer;
}
.pl-dialog__close:hover{ background:var(--surface-muted); color:var(--text-strong); }
.pl-dialog__body{ padding:0 var(--space-7); overflow:auto; font-size:var(--text-base); color:var(--text-body); line-height:var(--leading-normal); }
.pl-dialog__footer{ display:flex; justify-content:flex-end; gap:var(--space-4); padding:var(--space-7); }
@keyframes pl-dialog-fade{ from{opacity:0} to{opacity:1} }
@keyframes pl-dialog-pop{ from{opacity:0; transform:translateY(8px) scale(.98)} to{opacity:1; transform:none} }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-dialog-css")) {
  const el = document.createElement("style");
  el.id = "pl-dialog-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Dialog({ open, onClose, title, description, footer, width, children }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="pl-dialog__scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className="pl-dialog" role="dialog" aria-modal="true" style={{ "--_w": width ? width + "px" : undefined }}>
        <div className="pl-dialog__head">
          <div className="pl-dialog__titles">
            {title ? <span className="pl-dialog__title">{title}</span> : null}
            {description ? <span className="pl-dialog__desc">{description}</span> : null}
          </div>
          {onClose ? (
            <button type="button" className="pl-dialog__close" aria-label="Close" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          ) : null}
        </div>
        {children ? <div className="pl-dialog__body">{children}</div> : null}
        {footer ? <div className="pl-dialog__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
