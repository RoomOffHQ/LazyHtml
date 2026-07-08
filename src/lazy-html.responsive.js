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
