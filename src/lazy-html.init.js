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
