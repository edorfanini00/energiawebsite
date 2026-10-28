// Energia AI private inquiry dashboard. Talks only to /api/admin with the
// session cookie; every value is written with textContent, never as HTML.
(function () {
  "use strict";

  var $ = function (sel) { return document.querySelector(sel); };
  var login = $("[data-login]");
  var loginForm = $("[data-login-form]");
  var loginError = $("[data-login-error]");
  var board = $("[data-board]");
  var listEl = $("[data-list]");
  var boardStatus = $("[data-board-status]");
  var detailEl = $("[data-detail]");
  var errorEl = $("[data-error]");
  var logout = $("[data-logout]");
  var older = $("[data-older]");
  var newer = $("[data-newer]");
  var csrf = "";
  var page = 0;
  var currentRef = "";

  var FIELDS = [
    ["email", "Work email"],
    ["company", "Company"],
    ["role", "Role"],
    ["building_type", "Building type"],
    ["floor_area", "Total floor area"],
    ["building_count", "Number of buildings"],
    ["bms", "Building management system"],
    ["bms_name", "Which BMS"],
    ["energy_spend", "Annual energy spend"],
    ["phone", "Phone"],
    ["improve", "What they want to improve"],
    ["source_url", "Source page"],
    ["utm_source", "Campaign source"],
    ["utm_medium", "Campaign medium"],
    ["utm_campaign", "Campaign name"],
    ["utm_term", "Campaign term"],
    ["utm_content", "Campaign content"]
  ];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function when(value) {
    var d = new Date(value);
    return isNaN(d) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  async function api(method, query, body) {
    var options = { method: method, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } };
    if (body) {
      options.headers["Content-Type"] = "application/json";
      if (csrf) options.headers["X-CSRF-Token"] = csrf;
      options.body = JSON.stringify(body);
    }
    var response = await fetch("/api/admin" + (query || ""), options);
    var data = {};
    try { data = await response.json(); } catch (e) { data = {}; }
    if (response.status === 401 && !(body && body.action === "login")) showLogin();
    return { code: response.status, data: data };
  }

  function view(name) {
    login.hidden = name !== "login";
    board.hidden = name !== "board";
    detailEl.hidden = name !== "detail";
    logout.hidden = name === "login";
    errorEl.textContent = "";
  }
  function showLogin() {
    csrf = "";
    view("login");
    $("#password").focus();
  }

  // The list title already shows the company; the detail view repeats it.
  function answers(dl, row, skip) {
    dl.textContent = "";
    FIELDS.forEach(function (f) {
      if (skip && skip.indexOf(f[0]) !== -1) return;
      var value = row[f[0]];
      if (value === null || value === undefined || value === "") return;
      dl.appendChild(el("dt", "", f[1]));
      dl.appendChild(el("dd", f[0] === "improve" ? "long" : "", value));
    });
  }

  function statusLine(row) {
    return row.status === "contacted" ? "Contacted " + when(row.contacted_at) : "New";
  }

  function item(row) {
    var li = el("li", "item");
    li.setAttribute("data-reference", row.reference);
    var head = el("div", "item__head");
    var title = el("h2", "item__title");
    title.appendChild(el("span", "", row.company));
    title.appendChild(el("span", "item__name", row.name));
    head.appendChild(title);
    var meta = el("p", "item__meta");
    meta.appendChild(el("span", "ref", row.reference));
    meta.appendChild(el("span", "", when(row.created_at)));
    meta.appendChild(el("span", row.status === "contacted" ? "badge badge--done" : "badge", statusLine(row)));
    head.appendChild(meta);
    li.appendChild(head);
    var dl = el("dl", "answers");
    answers(dl, row, ["company"]);
    li.appendChild(dl);

    var actions = el("div", "item__actions");
    var open = el("button", "link", "Details");
    open.type = "button";
    open.setAttribute("data-open", "");
    open.addEventListener("click", function () { showDetail(row.reference); });
    var mark = el("button", "link", row.status === "contacted" ? "Mark as new" : "Mark contacted");
    mark.type = "button";
    mark.setAttribute("data-mark", "");
    mark.addEventListener("click", async function () {
      mark.disabled = true;
      var r = await api("POST", "", { action: "status", reference: row.reference, status: row.status === "contacted" ? "new" : "contacted" });
      if (r.code === 200) {
        await loadList();
        focusItem(row.reference, "[data-mark]");
      } else if (r.code !== 401) {
        mark.disabled = false;
        errorEl.textContent = "Could not update the status. Try again.";
        mark.focus();
      }
    });
    var erase = el("button", "link link--danger", "Erase");
    erase.type = "button";
    actions.appendChild(open);
    actions.appendChild(mark);
    actions.appendChild(erase);
    li.appendChild(actions);

    // Erasing is permanent, so it asks once more, inline.
    var confirmBox = el("div", "confirm");
    confirmBox.hidden = true;
    confirmBox.appendChild(el("p", "", "Erase " + row.reference + " permanently? This removes every answer and cannot be undone."));
    var yes = el("button", "danger", "Erase permanently");
    yes.type = "button";
    var no = el("button", "link", "Keep it");
    no.type = "button";
    confirmBox.appendChild(yes);
    confirmBox.appendChild(no);
    li.appendChild(confirmBox);
    erase.addEventListener("click", function () { confirmBox.hidden = false; no.focus(); });
    no.addEventListener("click", function () { confirmBox.hidden = true; erase.focus(); });
    yes.addEventListener("click", async function () {
      yes.disabled = true;
      var r = await api("POST", "", { action: "erase", reference: row.reference, confirm: row.reference });
      if (r.code === 200) {
        await loadList();
        boardStatus.textContent = row.reference + " was erased.";
        $("#board-title").focus();
      } else if (r.code !== 401) {
        yes.disabled = false;
        errorEl.textContent = "Could not erase " + row.reference + ". Try again.";
        yes.focus();
      }
    });
    return li;
  }

  // The list is rebuilt after every action, so the button that had focus is
  // gone; put focus back on the same control of the same inquiry, or on the
  // list heading when that inquiry is no longer shown.
  function focusItem(reference, selector) {
    if (board.hidden) return; // the list did not load; the error says so
    var target = listEl.querySelector('[data-reference="' + reference + '"] ' + selector);
    if (target && !target.disabled) target.focus();
    else $("#board-title").focus();
  }

  async function loadList() {
    var r = await api("GET", "?action=list&page=" + page);
    if (r.code !== 200) {
      if (r.code !== 401) errorEl.textContent = "Inquiries could not be loaded. Try Refresh.";
      return;
    }
    view("board");
    listEl.textContent = "";
    r.data.inquiries.forEach(function (row) { listEl.appendChild(item(row)); });
    boardStatus.textContent = r.data.inquiries.length ? "" : page ? "No older inquiries." : "No inquiries yet.";
    older.hidden = !r.data.hasMore;
    newer.hidden = page === 0;
  }

  async function showDetail(reference) {
    var r = await api("GET", "?action=detail&reference=" + encodeURIComponent(reference));
    if (r.code !== 200) {
      if (r.code !== 401) errorEl.textContent = "That inquiry could not be loaded.";
      return;
    }
    var row = r.data.inquiry;
    currentRef = row.reference;
    view("detail");
    var title = $("[data-detail-title]");
    title.textContent = row.company + ", " + row.name + " (" + row.reference + ")";
    var dl = $("[data-detail-answers]");
    answers(dl, row);
    dl.insertBefore(el("dd", "", statusLine(row)), dl.firstChild);
    dl.insertBefore(el("dt", "", "Status"), dl.firstChild);
    dl.insertBefore(el("dd", "", when(row.created_at)), dl.firstChild);
    dl.insertBefore(el("dt", "", "Received"), dl.firstChild);
    dl.insertBefore(el("dd", "", row.name), dl.firstChild);
    dl.insertBefore(el("dt", "", "Name"), dl.firstChild);
    var history = $("[data-detail-history]");
    history.textContent = "";
    r.data.events.forEach(function (e) {
      history.appendChild(el("li", "", e.action.charAt(0).toUpperCase() + e.action.slice(1) + ", " + when(e.created_at)));
    });
    title.focus();
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    loginError.textContent = "";
    var input = $("#password");
    if (!input.value) { loginError.textContent = "Enter the password."; input.focus(); return; }
    var button = loginForm.querySelector("button");
    button.disabled = true;
    try {
      var r = await api("POST", "", { action: "login", password: input.value });
      if (r.code === 200 && r.data.csrf) {
        csrf = r.data.csrf;
        input.value = "";
        page = 0;
        await loadList();
        $("#board-title").focus();
      } else {
        loginError.textContent = r.code === 429 ? "Too many attempts. Wait 15 minutes and try again." : r.code === 401 ? "That password is not correct." : "Sign in is unavailable right now.";
        input.focus();
      }
    } catch (e) {
      loginError.textContent = "Sign in is unavailable right now.";
      input.focus(); // the disabled button lost focus while waiting
    }
    button.disabled = false;
  });

  // Only a confirmed sign out (or a session that is already gone) leaves the
  // dashboard; otherwise the session may still be valid on the server.
  logout.addEventListener("click", async function () {
    var r;
    try {
      r = await api("POST", "", { action: "logout" });
    } catch (e) {
      r = { code: 0 };
    }
    if (r.code !== 200 && r.code !== 401) {
      errorEl.textContent = "Could not sign out. Try again.";
      logout.focus();
      return;
    }
    listEl.textContent = "";
    showLogin();
  });
  $("[data-refresh]").addEventListener("click", function () { loadList(); });
  $("[data-back]").addEventListener("click", async function () {
    var ref = currentRef;
    await loadList();
    focusItem(ref, "[data-open]");
  });
  // Paging replaces the whole list and may hide the button just pressed.
  older.addEventListener("click", async function () { page++; await loadList(); $("#board-title").focus(); });
  newer.addEventListener("click", async function () { page = Math.max(0, page - 1); await loadList(); $("#board-title").focus(); });
  $("#board-title").tabIndex = -1;

  // Resume an existing session, otherwise ask for the password.
  api("GET", "?action=session").then(function (r) {
    if (r.code === 200 && r.data.csrf) {
      csrf = r.data.csrf;
      loadList();
    } else showLogin();
  }, showLogin);
})();
