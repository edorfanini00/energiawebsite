// Energia AI landing preview: header state, mobile menu, the day tabs and section reveals.
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

  // The day: four illustrative moments become tabs on a day line. The markup
  // shows every moment in order, so without this script nothing is lost.
  // Roles, roving tabindex and arrow keys follow the WAI-ARIA tabs pattern
  // with automatic activation; the selected panel is itself focusable so
  // Tab moves from the selected tab into its content.
  var day = document.querySelector("[data-day]");
  if (day) {
    var list = day.querySelector("[data-day-list]");
    var line = day.querySelector("[data-dayline]");
    var tabs = Array.prototype.slice.call(day.querySelectorAll("[data-day-tab]"));
    var panels = Array.prototype.slice.call(day.querySelectorAll("[data-moment]"));
    if (list && line && tabs.length && tabs.length === panels.length) {
      list.setAttribute("role", "tablist");
      list.setAttribute("aria-label", list.getAttribute("data-label") || "Times of day");
      function syncOrientation() {
        list.setAttribute("aria-orientation", phone.matches ? "horizontal" : "vertical");
      }
      syncOrientation();
      phone.addEventListener("change", syncOrientation);
      tabs.forEach(function (tab, i) {
        var panel = panels[i];
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-controls", panel.id);
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tab.id);
        panel.setAttribute("tabindex", "0");
      });
      var select = function (index, focus) {
        tabs.forEach(function (tab, i) {
          var on = i === index;
          tab.setAttribute("aria-selected", String(on));
          tab.tabIndex = on ? 0 : -1;
          panels[i].hidden = !on;
        });
        line.style.setProperty("--at", tabs[index].getAttribute("data-at"));
        line.toggleAttribute("data-dark", tabs[index].hasAttribute("data-dark"));
        if (focus) tabs[index].focus();
      };
      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { select(i, false); });
        tab.addEventListener("keydown", function (event) {
          var next = null;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (i + 1) % tabs.length;
          else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (i - 1 + tabs.length) % tabs.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = tabs.length - 1;
          if (next === null) return;
          event.preventDefault();
          select(next, true);
        });
      });
      var initial = Math.max(0, tabs.findIndex(function (t) { return t.hasAttribute("data-initial"); }));
      select(initial, false);
      day.setAttribute("data-ready", "");
      // Fetch the other moments' images once the section is near, so a
      // switch does not wait on the network. Hidden lazy images would
      // otherwise load only when shown.
      var warm = function () {
        day.querySelectorAll("img[loading='lazy']").forEach(function (img) { img.loading = "eager"; });
      };
      if ("IntersectionObserver" in window) {
        var near = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting; })) { warm(); near.disconnect(); }
        }, { rootMargin: "600px 0px" });
        near.observe(day);
      } else {
        warm();
      }
    }
  }

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
