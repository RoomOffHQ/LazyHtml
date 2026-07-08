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
