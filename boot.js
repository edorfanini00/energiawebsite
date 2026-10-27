// Energia AI landing preview: header bootstrap.
// Loaded synchronously in <head>, before the stylesheet, so the collapsed
// phone header is in place at first paint. If main.js then fails to load, or
// throws before it has wired the menu, the "js" flag is removed and the
// static fallback (nav in flow and open) returns. With JavaScript off this
// never runs, and if this file fails to load main.js leaves the page static.
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");
  window.addEventListener("error", function (event) {
    if (root.hasAttribute("data-menu-ready")) return;
    var target = event.target;
    var src = (target && target.src) || event.filename || "";
    if (/\/main\.js(?:[?#]|$)/.test(src)) root.classList.remove("js");
  }, true);
})();
