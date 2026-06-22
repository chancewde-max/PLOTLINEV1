/* Plotline icon helper.
   Builds a Lucide SVG element from the loaded `lucide` UMD global, robust
   across the two shapes Lucide ships icon data in (children-array, or
   [tag, attrs, children]). Load AFTER the lucide UMD script:

     <script src="https://unpkg.com/lucide@0.456.0/dist/umd/lucide.min.js"></script>
     <script src="/assets/icons.js"></script>

   Then in React:  window.plIconSVG("ruler", { size: 18 })  -> <svg> element
*/
(function () {
  function toPascal(s) {
    return s.split(/[-_]/).map(function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1);
    }).join("");
  }
  function getNode(name) {
    var L = window.lucide;
    if (!L) return null;
    var key = toPascal(name);
    return (L.icons && L.icons[key]) || L[key] || (L.icons && L.icons[name]) || null;
  }
  function childTuples(node) {
    if (!node) return [];
    if (Array.isArray(node)) {
      // [tag, attrs, children]  vs  [ [tag,attrs], [tag,attrs] ]
      if (typeof node[0] === "string") return node[2] || [];
      return node;
    }
    if (node.children) return node.children;
    return [];
  }
  window.plIconSVG = function (name, opts) {
    opts = opts || {};
    var size = opts.size || 18;
    var sw = opts.strokeWidth || 2;
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", sw);
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    childTuples(getNode(name)).forEach(function (c) {
      if (!Array.isArray(c)) return;
      var el = document.createElementNS(ns, c[0]);
      var attrs = c[1] || {};
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      svg.appendChild(el);
    });
    return svg;
  };
})();
