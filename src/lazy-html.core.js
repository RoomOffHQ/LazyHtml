/*!
 * LazyHTML — core.js
 * Author: Jade Hamel
 * The atomic-style engine. Turns "prop:value" declarations into a single
 * shared class, injected once into a live <style> sheet. Everything else
 * (attributes.js, responsive.js, states.js, colors.js, observer.js) is
 * built on top of the three methods exposed here: injectRule, resolve, scan.
 */
(function (global) {
  "use strict";

  var LazyHTML = {
    version: "1.0.0",
    config: {
      prefix: "lz-",       // prefix used for raw/passthrough CSS attributes: lz-text-shadow="..."
      autoInit: true,      // auto-scan on DOMContentLoaded
      lazyAttr: "lazy",    // <div lazy="true" ...> defers style resolution until it enters the viewport
      root: null           // set once mounted, the <style> element's sheet
    },
    attributeMap: {},      // filled in by lazy-html.attributes.js
    breakpoints: {},       // filled in by lazy-html.responsive.js
    states: {},            // filled in by lazy-html.states.js

    _cache: new Map(),
    _sheetEl: null,

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

      var body = declarations.join(";");
      var key = media + "|" + pseudo + "|" + body;

      if (this._cache.has(key)) return this._cache.get(key);

      var cls = this._hash(key);
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
        if (!prop) return null;
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
    }
  };

  global.LazyHTML = LazyHTML;
})(typeof window !== "undefined" ? window : this);
