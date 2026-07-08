/*!
 * LazyHTML — colors.js
 * Resolves color values written the "lazy" way: bare hex without '#',
 * hex with a stray '#' typo like "#black", named CSS colors, css vars,
 * or already-valid rgb()/rgba()/hsl() strings. Never throws — worst case
 * it falls back to the raw string so the browser's own error handling
 * (silently ignoring an invalid declaration) takes over.
 */
(function (global) {
  "use strict";

  var NAMED = ("black white red green blue yellow orange purple pink gray grey " +
    "brown cyan magenta lime teal navy maroon olive silver gold indigo violet " +
    "coral salmon khaki crimson transparent currentColor").split(" ");

  var NAMED_SET = {};
  NAMED.forEach(function (n) { NAMED_SET[n.toLowerCase()] = n; });

  function isHex(str) {
    return /^[0-9a-f]{3}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(str);
  }

  function resolveColor(raw) {
    if (!raw) return null;
    var v = String(raw).trim();

    // css var: color="--signal" -> var(--signal)
    if (v.indexOf("--") === 0) return "var(" + v + ")";
    if (v.indexOf("var(") === 0) return v;

    // already a function form
    if (/^(rgb|hsl)a?\(/i.test(v)) return v;

    // strip any stray leading '#' characters (tolerates "#black", "##fff")
    var stripped = v.replace(/^#+/, "");

    if (isHex(stripped)) return "#" + stripped;

    var lower = stripped.toLowerCase();
    if (NAMED_SET[lower]) return NAMED_SET[lower];

    // unknown token: hand it to the browser as-is (covers extended/CSS4
    // color keywords LazyHTML doesn't enumerate, e.g. "rebeccapurple")
    return stripped;
  }

  global.LazyHTML = global.LazyHTML || {};
  global.LazyHTML.resolveColor = resolveColor;
})(typeof window !== "undefined" ? window : this);
