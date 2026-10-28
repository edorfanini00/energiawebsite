// Meta pixel for the Energia AI Web dataset: Meta's standard base code,
// served from this site because the CSP allows no inline script. It loads
// Meta's fbevents.js and records a PageView. main.js adds one Lead after the
// server has stored a new inquiry. Automatic configuration is off to suppress
// automatic events; the dataset must also keep advanced matching off. Loopback hosts (local
// preview and tests) and pages opened from disk never load it, so they send
// nothing to Meta. /admin does not include this file, and its CSP (the
// site default) would block Meta's script. Automatic advanced matching must
// stay Off on the dataset: the privacy page says the answers are never sent.
(function () {
  "use strict";
  var PIXEL_ID = "2313981812785333";
  var host = location.hostname;
  if (!host || /^(?:localhost|127(?:\.\d{1,3}){3}|\[::1\])$/.test(host) || window.fbq) return;
  var fbq = (window.fbq = function () {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
    else fbq.queue.push(arguments);
  });
  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  var script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  // One PageView per page load: the "Discuss savings" links change the URL
  // hash with pushState, which fbevents.js would otherwise count again.
  fbq.disablePushState = true;
  fbq("set", "autoConfig", false, PIXEL_ID);
  fbq("init", PIXEL_ID);
  fbq("track", "PageView");
})();
