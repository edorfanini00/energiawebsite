// Energia AI landing preview: header state, mobile menu and section reveals.
// No analytics, no network requests, no form handling.
(function () {
  "use strict";

  // boot.js sets "js" before first paint. Without it (boot.js blocked, or
  // removed after a failure) the page stays in its static layout.
  var root = document.documentElement;
  if (!root.classList.contains("js")) return;

  var bar = document.querySelector("[data-bar]");
  var toggle = document.querySelector("[data-toggle]");
  var toggleLabel = document.querySelector("[data-toggle-label]");
  var nav = document.querySelector("[data-nav]");
  var phone = window.matchMedia("(max-width: 860px)");

  // Keep the closed phone menu out of the tab order; restore it on desktop.
  function syncNavInert() {
    var hidden = phone.matches && !bar.classList.contains("is-open");
    if (hidden) nav.setAttribute("inert", "");
    else nav.removeAttribute("inert");
  }

  // Header picks up a paper background once the page moves.
  function onScroll() {
    bar.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile menu: aria-expanded, Escape to close, focus returns to the toggle.
  function setOpen(open, restoreFocus) {
    bar.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggleLabel.textContent = open ? "Close" : "Menu";
    // Update inert before moving focus; an inert link cannot take focus.
    syncNavInert();
    if (open) {
      var first = nav.querySelector("a");
      if (first) first.focus();
    } else if (restoreFocus) {
      toggle.focus();
    }
  }

  toggle.addEventListener("click", function () {
    setOpen(toggle.getAttribute("aria-expanded") !== "true", false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && bar.classList.contains("is-open")) {
      setOpen(false, true);
    }
  });

  nav.addEventListener("click", function (event) {
    if (event.target.closest("a") && bar.classList.contains("is-open")) {
      setOpen(false, false);
    }
  });

  document.addEventListener("click", function (event) {
    if (bar.classList.contains("is-open") && !bar.contains(event.target)) {
      setOpen(false, false);
    }
  });

  phone.addEventListener("change", function () {
    if (!phone.matches) setOpen(false, false);
    syncNavInert();
  });
  syncNavInert();

  // The menu is wired: enable the toggle (disabled in the markup so an early
  // tap is never silently lost) and tell boot.js not to fall back any more.
  toggle.disabled = false;
  root.setAttribute("data-menu-ready", "");

  // Section reveals. Content is visible by default; it is only hidden for
  // the reveal once "reveal-ready" is set below. Nothing is hidden when
  // motion is reduced or the observer is unavailable.
  var items = document.querySelectorAll("[data-reveal]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;
  // Anything already on screen stays as it is, so nothing blinks out.
  items.forEach(function (el) {
    var r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-in");
  });
  document.documentElement.classList.add("reveal-ready");
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  items.forEach(function (el) { observer.observe(el); });
})();
