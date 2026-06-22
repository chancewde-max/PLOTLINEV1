import React from "react";

const CSS = `
.pl-avatar{
  position:relative; display:inline-flex; align-items:center; justify-content:center;
  flex:0 0 auto; overflow:hidden;
  width:var(--_s,32px); height:var(--_s,32px);
  border-radius:var(--radius-pill);
  background:var(--brand-100); color:var(--brand-800);
  font-family:var(--font-sans); font-weight:var(--weight-semibold);
  font-size:calc(var(--_s,32px) * 0.40); letter-spacing:var(--tracking-snug);
  user-select:none;
}
.pl-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
.pl-avatar--ring{ box-shadow:0 0 0 2px var(--surface-card), 0 0 0 3px var(--border-default); }
.pl-avatar__status{
  position:absolute; right:-1px; bottom:-1px;
  width:30%; height:30%; min-width:8px; min-height:8px;
  border-radius:50%; border:2px solid var(--surface-card);
  background:var(--slate-400);
}
.pl-avatar__status--online{ background:var(--success-500); }
.pl-avatar__status--busy{ background:var(--danger-500); }
`;
if (typeof document !== "undefined" && !document.getElementById("pl-avatar-css")) {
  const el = document.createElement("style");
  el.id = "pl-avatar-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

const SIZES = { xs: 22, sm: 28, md: 32, lg: 40, xl: 52 };

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
}

export function Avatar({ name = "", src, size = "md", ring = false, status, className = "", ...rest }) {
  const px = typeof size === "number" ? size : SIZES[size] || 32;
  return (
    <span
      className={["pl-avatar", ring ? "pl-avatar--ring" : "", className].filter(Boolean).join(" ")}
      style={{ "--_s": px + "px" }}
      title={name || undefined}
      {...rest}
    >
      {src ? <img src={src} alt={name} /> : initials(name)}
      {status ? <span className={`pl-avatar__status pl-avatar__status--${status}`} /> : null}
    </span>
  );
}
