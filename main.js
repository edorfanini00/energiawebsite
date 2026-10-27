// Energia AI landing preview: header state, mobile menu and section reveals.
// No analytics, no network requests, no form handling.
(function () {
  "use strict";

  // The "js" class is set by a hashed inline script in <head> so the phone
  // menu never flashes open; set it again here in case that script is absent.
  document.documentElement.classList.add("js");

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

  // Section reveals. Content stays visible when motion is reduced or the
  // observer is unavailable.
  var items = document.querySelectorAll("[data-reveal]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }
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
