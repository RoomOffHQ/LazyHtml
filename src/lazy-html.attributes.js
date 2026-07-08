/*!
 * LazyHTML — attributes.js
 * Maps every element attribute LazyHTML understands to one or more CSS
 * declarations. This is the actual "language": what you can write on a
 * tag, and what it becomes. Each entry is fn(value, el) -> ["prop:val", ...]
 */
(function (global) {
  "use strict";

  var LH = global.LazyHTML;
  var color = LH.resolveColor;

  function unit(v) {
    if (v == null) return v;
    v = String(v).trim();
    if (v === "0" || v === "") return v || "0";
    if (/^-?\d+(\.\d+)?$/.test(v)) return v + "px"; // bare number -> px
    return v; // already has a unit, is a %, var(), calc(), etc.
  }

  function bool(v) {
    return v === "true" || v === "" || v === true || v === "1";
  }

  var map = {
    /* ---- typography ---- */
    color:      function (v) { return ["color:" + color(v)]; },
    bg:         function (v) { return ["background-color:" + color(v)]; },
    "bg-image": function (v) { return ["background-image:url(" + v + ")"]; },
    "bg-size":  function (v) { return ["background-size:" + v]; },
    "bg-pos":   function (v) { return ["background-position:" + v]; },
    size:       function (v) { return ["font-size:" + unit(v)]; },
    weight:     function (v) { return ["font-weight:" + v]; },
    font:       function (v) { return ["font-family:" + v]; },
    lh:         function (v) { return ["line-height:" + v]; },
    ls:         function (v) { return ["letter-spacing:" + unit(v)]; },
    align:      function (v) { return ["text-align:" + v]; },
    bold:       function (v) { return bool(v) ? ["font-weight:700"] : []; },
    italic:     function (v) { return bool(v) ? ["font-style:italic"] : []; },
    underline:  function (v) { return bool(v) ? ["text-decoration:underline"] : []; },
    strike:     function (v) { return bool(v) ? ["text-decoration:line-through"] : []; },
    uppercase:  function (v) { return bool(v) ? ["text-transform:uppercase"] : []; },
    lowercase:  function (v) { return bool(v) ? ["text-transform:lowercase"] : []; },
    capitalize: function (v) { return bool(v) ? ["text-transform:capitalize"] : []; },
    nowrap:     function (v) { return bool(v) ? ["white-space:nowrap"] : []; },
    truncate:   function (v) { return bool(v) ? [
      "overflow:hidden", "text-overflow:ellipsis", "white-space:nowrap"
    ] : []; },

    /* ---- box model ---- */
    w:      function (v) { return ["width:" + unit(v)]; },
    h:      function (v) { return ["height:" + unit(v)]; },
    minw:   function (v) { return ["min-width:" + unit(v)]; },
    minh:   function (v) { return ["min-height:" + unit(v)]; },
    maxw:   function (v) { return ["max-width:" + unit(v)]; },
    maxh:   function (v) { return ["max-height:" + unit(v)]; },

    pad:    function (v) { return ["padding:" + unit(v)]; },
    "pad-x":function (v) { return ["padding-left:" + unit(v), "padding-right:" + unit(v)]; },
    "pad-y":function (v) { return ["padding-top:" + unit(v), "padding-bottom:" + unit(v)]; },
    pt:     function (v) { return ["padding-top:" + unit(v)]; },
    pr:     function (v) { return ["padding-right:" + unit(v)]; },
    pb:     function (v) { return ["padding-bottom:" + unit(v)]; },
    pl:     function (v) { return ["padding-left:" + unit(v)]; },

    m:      function (v) { return ["margin:" + unit(v)]; },
    mx:     function (v) { return ["margin-left:" + unit(v), "margin-right:" + unit(v)]; },
    my:     function (v) { return ["margin-top:" + unit(v), "margin-bottom:" + unit(v)]; },
    mt:     function (v) { return ["margin-top:" + unit(v)]; },
    mr:     function (v) { return ["margin-right:" + unit(v)]; },
    mb:     function (v) { return ["margin-bottom:" + unit(v)]; },
    ml:     function (v) { return ["margin-left:" + unit(v)]; },

    gap:      function (v) { return ["gap:" + unit(v)]; },
    "row-gap":function (v) { return ["row-gap:" + unit(v)]; },
    "col-gap":function (v) { return ["column-gap:" + unit(v)]; },

    /* ---- border / shape / effects ---- */
    border:        function (v) { return ["border:" + v]; },
    "border-color":function (v) { return ["border-color:" + color(v)]; },
    "border-width":function (v) { return ["border-width:" + unit(v)]; },
    radius:        function (v) { return ["border-radius:" + unit(v)]; },
    shadow:        function (v) { return ["box-shadow:" + v]; },
    opacity:       function (v) { return ["opacity:" + v]; },
    cursor:        function (v) { return ["cursor:" + v]; },
    blur:          function (v) { return ["filter:blur(" + unit(v) + ")"]; },
    rotate:        function (v) { return ["transform:rotate(" + v + ")"]; },
    scale:         function (v) { return ["transform:scale(" + v + ")"]; },
    translate:     function (v) { return ["transform:translate(" + v + ")"]; },
    transition:    function (v) { return ["transition:" + v]; },
    duration:      function (v) { return ["transition-duration:" + v]; },
    ease:          function (v) { return ["transition-timing-function:" + v]; },
    animate:       function (v) { return ["animation:" + v]; },

    /* ---- layout ---- */
    display: function (v) { return ["display:" + v]; },
    flex:    function (v) { return v === "true" || v === "" ? ["display:flex"] : ["flex:" + v]; },
    grid:    function (v) { return ["display:grid", "grid-template-columns:" + v]; },
    cols:    function (v) { return ["grid-template-columns:repeat(" + v + ",1fr)"]; },
    rows:    function (v) { return ["grid-template-rows:repeat(" + v + ",1fr)"]; },
    direction: function (v) { return ["flex-direction:" + v]; },
    wrap:    function (v) { return ["flex-wrap:" + v]; },
    justify: function (v) { return ["justify-content:" + v]; },
    items:   function (v) { return ["align-items:" + v]; },
    self:    function (v) { return ["align-self:" + v]; },
    center:  function (v) { return bool(v) ? [
      "display:flex", "align-items:center", "justify-content:center"
    ] : []; },

    /* ---- position ---- */
    pos:    function (v) { return ["position:" + v]; },
    top:    function (v) { return ["top:" + unit(v)]; },
    right:  function (v) { return ["right:" + unit(v)]; },
    bottom: function (v) { return ["bottom:" + unit(v)]; },
    left:   function (v) { return ["left:" + unit(v)]; },
    z:      function (v) { return ["z-index:" + v]; },

    /* ---- visibility ---- */
    hide:    function (v) { return bool(v) ? ["display:none"] : []; },
    visible: function (v) { return bool(v) ? ["visibility:visible"] : ["visibility:hidden"]; }
  };

  Object.keys(map).forEach(function (key) {
    LH.registerAttribute(key, map[key]);
  });
})(typeof window !== "undefined" ? window : this);
