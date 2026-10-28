// Energia AI landing preview: header state, mobile menu, the day tabs, the
// inquiry form and section reveals. The form talks only to this site's own
// /api endpoints; after a newly stored inquiry it adds one Meta Lead through
// the pixel (pixel.js) when that has loaded.
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

  // This is a disclosure, not a modal: sequential focus may leave it in
  // either direction. Close without stealing focus from the destination.
  document.addEventListener("focusin", function (event) {
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

  // The inquiry form. Same origin only: a challenge from /api/challenge,
  // solved here with Web Crypto (ALTCHA proof of work, no third party
  // script), then one JSON POST to /api/inquiry. Nothing is fetched until
  // someone types or sends, and nothing is stored in the browser.
  var contact = document.querySelector("#contact");
  var form = document.querySelector("[data-inquiry]");
  if (contact && form) {
    try {
      setupInquiry(contact, form);
    } catch (error) {
      // Never leave a form that cannot send: fall back to the email link.
      contact.setAttribute("data-form-off", "");
    }
  }

  function setupInquiry(contact, form) {
    var MAIL = "edo.orfanini@energiaigroup.com";
    var submit = form.querySelector("[data-submit]");
    var submitLabel = form.querySelector("[data-submit-label]");
    var status = form.querySelector("[data-status]");
    var failure = form.querySelector("[data-failure]");
    var done = contact.querySelector("[data-done]");
    var doneTitle = done.querySelector("[data-done-title]");
    var bms = form.elements.namedItem("bms");
    var bmsName = form.querySelector("[data-bms-name]");
    var names = ["name", "email", "company", "buildingType", "floorArea", "role", "buildingCount", "bms", "bmsName", "energySpend", "improve", "phone"];
    var required = {
      name: "Enter your name.",
      email: "Enter your work email.",
      company: "Enter your company.",
      buildingType: "Choose a building type.",
      floorArea: "Choose a floor area."
    };
    var EMAIL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
    var PHONE = /^\+?[0-9 ().-]{7,40}(?:\s*(?:x|ext\.?)\s*[0-9]{1,6})?$/i;
    var sending = false;
    var sent = null; // { body, key } of the last attempt that may have reached the server
    var proof = null; // { promise, at }

    if (!window.crypto || !crypto.subtle || !window.fetch || !window.TextEncoder) throw new Error("unsupported");

    function control(name) { return form.elements.namedItem(name); }
    function errorFor(name) { return document.getElementById(control(name).id + "-error"); }

    function check(name) {
      var value = control(name).value.trim();
      if (!value) return required[name] || "";
      if (name === "email" && !EMAIL.test(value)) return "Enter an email address like name@company.com.";
      if (name === "phone" && !PHONE.test(value)) return "Enter a phone number using digits, spaces, + or parentheses.";
      return "";
    }
    function show(name, message) {
      var input = control(name);
      errorFor(name).textContent = message;
      if (message) {
        input.setAttribute("aria-invalid", "true");
        // An error inside the closed optional details opens them, so the
        // message is seen and focus can reach the field.
        var details = input.closest("details");
        if (details) details.open = true;
      } else input.removeAttribute("aria-invalid");
    }

    // Once a field has shown an error, it rechecks as the visitor fixes it.
    names.forEach(function (name) {
      var input = control(name);
      var recheck = function () {
        if (input.getAttribute("aria-invalid") === "true") show(name, check(name));
      };
      input.addEventListener("input", recheck);
      input.addEventListener("change", recheck);
    });

    function syncBms() {
      var on = bms.value === "Yes";
      bmsName.hidden = !on;
      if (!on) { control("bmsName").value = ""; show("bmsName", ""); }
    }
    bms.addEventListener("change", syncBms);
    syncBms();

    // Near the limit, the hint counts. It is announced only once the limit
    // is reached; before that it is read with the field's description.
    var improve = control("improve");
    var count = form.querySelector("[data-count]");
    var MAX_IMPROVE = improve.maxLength;
    improve.addEventListener("input", function () {
      var n = improve.value.length;
      if (n >= MAX_IMPROVE) count.setAttribute("aria-live", "polite");
      else count.removeAttribute("aria-live");
      count.textContent = n > 800 ? n.toLocaleString("en-US") + " of " + MAX_IMPROVE.toLocaleString("en-US") + " characters" : "Up to " + MAX_IMPROVE.toLocaleString("en-US") + " characters.";
    });

    // Start the security check as soon as someone begins typing, so it is
    // usually finished before they send.
    form.addEventListener("input", function () { freshProof(); }, { once: true });

    function hex(bytes) {
      var out = "";
      for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
      return out;
    }
    function unhex(text) {
      var out = new Uint8Array(text.length / 2);
      for (var i = 0; i < out.length; i++) out[i] = parseInt(text.substr(i * 2, 2), 16);
      return out;
    }
    // PBKDF2 over nonce + big endian counter, as altcha-lib derives it.
    function derive(nonce, salt, counter, cost, length) {
      var password = new Uint8Array(nonce.length + 4);
      password.set(nonce, 0);
      new DataView(password.buffer).setUint32(nonce.length, counter, false);
      return crypto.subtle.importKey("raw", password, "PBKDF2", false, ["deriveBits"]).then(function (key) {
        return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: cost }, key, length * 8);
      }).then(function (bits) { return hex(new Uint8Array(bits)); });
    }
    async function solve(challenge) {
      var p = challenge.parameters;
      if (!p || p.algorithm !== "PBKDF2/SHA-256") throw new Error("unexpected challenge");
      var nonce = unhex(p.nonce);
      var salt = unhex(p.salt);
      for (var start = 0; start <= 100000; start += 16) {
        var batch = [];
        for (var n = start; n < start + 16; n++) batch.push(derive(nonce, salt, n, p.cost, p.keyLength || 32));
        var keys = await Promise.all(batch);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i].indexOf(p.keyPrefix) === 0) {
            return btoa(JSON.stringify({ challenge: challenge, solution: { counter: start + i, derivedKey: keys[i] } }));
          }
        }
      }
      throw new Error("unsolved");
    }
    function withTimeout(ms) {
      var controller = new AbortController();
      var timer = setTimeout(function () { controller.abort(); }, ms);
      return { signal: controller.signal, done: function () { clearTimeout(timer); } };
    }
    async function fetchProof() {
      var t = withTimeout(10000);
      try {
        // A POST, so every browser sends its Origin, even without Fetch Metadata.
        var response = await fetch("/api/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: "{}",
          signal: t.signal
        });
        if (!response.ok) throw new Error("challenge " + response.status);
        return await solve(await response.json());
      } finally {
        t.done();
      }
    }
    // A solved proof is good for five minutes; ask for a new one after four.
    function freshProof(force) {
      if (force || !proof || Date.now() - proof.at > 240000) {
        proof = { at: Date.now(), promise: fetchProof() };
        proof.promise.catch(function () { proof = null; });
      }
      return proof.promise;
    }

    function uuid() {
      if (crypto.randomUUID) return crypto.randomUUID();
      var b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 15) | 64;
      b[8] = (b[8] & 63) | 128;
      var h = hex(b);
      return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    }

    function setSending(on) {
      sending = on;
      submit.disabled = on;
      if (on) form.setAttribute("aria-busy", "true");
      else form.removeAttribute("aria-busy");
      submitLabel.textContent = on ? "Sending" : "Send";
      status.textContent = on ? "Sending your details." : "";
    }
    function fail(message) {
      failure.textContent = "";
      failure.appendChild(document.createTextNode(message + " Please try again, or email "));
      var link = document.createElement("a");
      link.href = "mailto:" + MAIL;
      link.textContent = MAIL;
      failure.appendChild(link);
      failure.appendChild(document.createTextNode("."));
    }

    // One Meta Lead per newly stored inquiry, with its reference as the event
    // ID so Meta can drop duplicates. Never for a replay that returns an
    // existing reference (fresh: false), a filled honeypot or any failure,
    // and only once: after a success the form stays hidden and sending.
    // The pixel may be absent or blocked; the form never depends on it.
    function lead(reference) {
      if (typeof window.fbq !== "function") return;
      try { window.fbq("track", "Lead", {}, { eventID: reference }); } catch (error) { /* measurement only */ }
    }

    async function post(payload) {
      var t = withTimeout(20000);
      try {
        var response = await fetch("/api/inquiry", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify(payload),
          signal: t.signal
        });
        var data = null;
        try { data = await response.json(); } catch (e) { data = null; }
        return { code: response.status, data: data || {} };
      } finally {
        t.done();
      }
    }

    async function send(answers) {
      setSending(true);
      failure.textContent = "";
      try {
        // A retry of the same answers reuses the same key, so a request that
        // reached the server before timing out is never stored twice.
        var body = JSON.stringify(answers);
        if (!sent || sent.body !== body) sent = { body: body, key: uuid() };
        var payload = Object.assign({}, answers, {
          idempotencyKey: sent.key,
          sourcePath: location.pathname,
          utm: location.search.slice(0, 2000),
          website: control("website").value,
          altcha: await freshProof()
        });
        var result = await post(payload);
        if (result.code === 422 && result.data.status === "verification_required") {
          payload.altcha = await freshProof(true);
          result = await post(payload);
        }
        proof = null; // each proof is single use
        var reference = result.data.reference;
        if (result.code === 200 && result.data.status === "accepted" && typeof reference === "string" && /^EA-[0-9A-Z]{8}$/.test(reference)) {
          // Shown with a space: no dashes in anything a visitor reads. The
          // stored reference keeps its hyphen.
          done.querySelector("[data-reference]").textContent = reference.replace("-", " ");
          form.hidden = true;
          done.hidden = false;
          doneTitle.focus();
          sent = null;
          if (result.data.fresh === true && payload.website === "") lead(reference);
          return;
        }
        if (result.code === 422 && result.data.status === "invalid_fields" && result.data.fields) {
          var first = null;
          names.forEach(function (name) {
            var message = result.data.fields[name];
            if (typeof message === "string") {
              show(name, message);
              if (!first) first = name;
            }
          });
          if (first) {
            setSending(false);
            control(first).focus();
            return;
          }
        }
        if (result.code === 409) sent = null; // start a clean attempt next time
        fail(result.code === 429 ? "Too many messages were sent from here just now." : "Your details were not sent.");
      } catch (error) {
        // Timeout or network failure: the answers stay, and the same key is
        // reused when the visitor tries again.
        proof = null;
        fail("Your details could not be sent.");
      }
      setSending(false);
      submit.focus();
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (sending) return;
      var first = null;
      names.forEach(function (name) {
        if (name === "bmsName" && bmsName.hidden) return;
        var message = check(name);
        show(name, message);
        if (message && !first) first = name;
      });
      if (first) {
        failure.textContent = "";
        control(first).focus();
        return;
      }
      var answers = {};
      names.forEach(function (name) { answers[name] = control(name).value.trim(); });
      send(answers);
    });

    // Every "Discuss savings" link brings the form into view and puts the
    // cursor in the first field. Without this script they are plain anchors.
    var firstField = control("name");
    document.querySelectorAll("a[data-cta]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var target = form.hidden ? doneTitle : firstField;
        var barHeight = bar.getBoundingClientRect().height;
        var sectionTop = contact.getBoundingClientRect().top + window.scrollY - barHeight - 8;
        var fieldBox = target.getBoundingClientRect();
        var fieldBottom = fieldBox.bottom + window.scrollY;
        // Show the section heading too when the field still fits below it.
        var top = fieldBottom - sectionTop <= window.innerHeight - barHeight - 24 ? sectionTop : fieldBox.top + window.scrollY - barHeight - 48;
        var smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
        target.focus({ preventScroll: true });
        if (location.hash !== "#contact" && history.pushState) history.pushState(null, "", "#contact");
      });
    });

    // Wired: enable the button (disabled in the markup so a press before the
    // script runs is never lost or sent as a page navigation).
    submit.disabled = false;
    form.setAttribute("data-ready", "");
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
