/* Shared helpers for the Plotline app UI kit.
   Exposes window.KitIcon (React icon component backed by Lucide). */

function KitIcon({ name, size = 18, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = "";
      const n = window.plIconSVG ? window.plIconSVG(name, { size }) : null;
      if (n) ref.current.appendChild(n);
    }
  }, [name, size]);
  return React.createElement("span", {
    ref,
    style: { display: "inline-flex", width: size, height: size, ...style },
  });
}

Object.assign(window, { KitIcon });
