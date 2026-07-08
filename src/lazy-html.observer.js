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
