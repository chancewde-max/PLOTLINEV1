import React from "react";

const CSS = `
.pl-tt{ position:relative; display:inline-flex; }
.pl-tt__pop{
  position:absolute; z-index:50; left:50%; transform:translateX(-50%) translateY(2px);
  background:var(--surface-inverse); color:var(--text-inverse);
  font-family:var(--font-sans); font-size:var(--text-xs); font-weight:var(--weight-medium);
  line-height:1.3; padding:5px 9px; border-radius:var(--radius-sm);
  white-space:nowrap; box-shadow:var(--shadow-md); pointer-events:none;
  opacity:0; transition:opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard);
}
.pl-tt__pop--top{ bottom:calc(100% + 7px); }
.pl-tt__pop--bottom{ top:calc(100% + 7px); }
.pl-tt[data-open="true"] .pl-tt__pop{ opacity:1; transform:translateX(-50%) translateY(0); }
.pl-tt__pop::after{
  content:""; position:absolute; left:50%; margin-left:-4px;
  border:4px solid transparent;
}
.pl-tt__pop--top::after{ top:100%; border-top-color:var(--surface-inverse); }
.pl-tt__pop--bottom::after{ bottom:100%; border-bottom-color:var(--surface-inverse); }
.pl-tt__kbd{ font-family:var(--font-mono); opacity:.7; margin-left:6px; }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-tt-css")) {
  const el = document.createElement("style");
  el.id = "pl-tt-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Tooltip({ label, shortcut, side = "top", className = "", children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className={["pl-tt", className].filter(Boolean).join(" ")}
      data-open={open}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span className={`pl-tt__pop pl-tt__pop--${side}`} role="tooltip">
        {label}
        {shortcut ? <span className="pl-tt__kbd">{shortcut}</span> : null}
      </span>
    </span>
  );
}
