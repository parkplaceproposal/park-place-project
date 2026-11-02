(function () {
  "use strict";

  var data = window.PROPOSAL || { levels: [] };
  var levels = data.levels || [];
  var IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg|avif)$/i;
  var PDF_EXT = /\.pdf$/i;
  var OPEN_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
    '<path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5"/></svg>';

  var state = { level: null, mode: "views", view: 0 };

  var el = {
    title: document.getElementById("project-title"),
    nav: document.getElementById("level-nav"),
    levelTitle: document.getElementById("level-title"),
    tabViews: document.getElementById("tab-views"),
    modeSwitch: document.querySelector(".segmented"),
    tabPlan: document.getElementById("tab-plan"),
    panel: document.getElementById("panel"),
  };

  if (data.title) {
    el.title.textContent = data.title;
    document.title = data.title;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Turn any Kuula link (post / share / collection) into an embed URL with fullscreen on. */
  function kuulaEmbed(raw) {
    var url;
    try { url = new URL(String(raw).trim()); } catch (e) { return null; }
    if (!/(^|\.)kuula\.co$/i.test(url.hostname)) return url.href;

    var parts = url.pathname.split("/").filter(Boolean);
    var path;
    if (parts[0] === "share" && parts[1] === "collection" && parts[2]) {
      path = "/share/collection/" + parts[2];
    } else if ((parts[0] === "share" || parts[0] === "post") && parts[1]) {
      path = "/share/" + parts[1];
    } else {
      path = url.pathname;
    }

    var params = new URLSearchParams(url.search);
    var defaults = { logo: "1", info: "1", fs: "1", vr: "0", sd: "1", thumbs: "1" };
    Object.keys(defaults).forEach(function (k) {
      if (!params.has(k)) params.set(k, defaults[k]);
    });
    params.set("fs", "1"); // always allow fullscreen
    return "https://kuula.co" + path + "?" + params.toString();
  }

  function planPath(file) {
    file = String(file).trim();
    if (/^(https?:)?\/\//i.test(file) || file.indexOf("floorplans/") === 0) return file;
    return "floorplans/" + file.split("/").map(encodeURIComponent).join("/");
  }

  function comingSoon(what) {
    return (
      '<div class="coming-soon"><div>' +
      "<h3>Coming soon</h3>" +
      "<p>The " + esc(what) + " for this level will be added shortly.</p>" +
      "</div></div>"
    );
  }

  function getLevel(id) {
    for (var i = 0; i < levels.length; i++) if (levels[i].id === id) return levels[i];
    return null;
  }

  function hasPin(v) {
    return !!(v && v.pin && isFinite(v.pin.x) && isFinite(v.pin.y));
  }

  function validViews(level) {
    return (level.views || []).filter(function (v) { return v && v.url && kuulaEmbed(v.url); });
  }

  /* ---------- Rendering ---------- */

  function renderNav() {
    el.nav.innerHTML = levels
      .map(function (l) {
        return (
          (l.planOnly ? '<span class="level-nav__sep" aria-hidden="true"></span>' : "") +
          '<button type="button" class="level-btn' + (l.planOnly ? " level-btn--extra" : "") + '" role="tab" data-level="' + esc(l.id) + '"' +
          ' aria-selected="' + (l.id === state.level) + '">' + esc(l.name) + "</button>"
        );
      })
      .join("");
  }

  function tourInner(src, name, levelName) {
    return window.PREVIEW_NO_EMBED
      ? '<div class="tour-fallback"><p>' + esc(name) + '</p>' +
        '<a class="tour-fallback__btn" href="' + esc(src) + '" target="_blank" rel="noopener">Open 3D view ' + OPEN_ICON + '</a>' +
        '<small>In this preview, 3D views open in a new tab. On the published website they play right here.</small></div>'
      : '<iframe src="' + esc(src) + '" title="' + esc(levelName + " \u2013 " + name) + '"' +
        ' allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"' +
        ' allowfullscreen scrolling="no"></iframe>';
  }

  /* ---------- Full-screen 3D viewer (opened from floor plan pins) ---------- */

  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6 6 18"/></svg>';
  var modal = null, modalReturnFocus = null, modalState = null, modalTimer = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "tour-modal";
    modal.hidden = true;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "tour-modal-title");
    modal.innerHTML =
      '<div class="tour-modal__backdrop" data-close></div>' +
      '<div class="tour-modal__dialog">' +
      '<div class="tour-modal__bar">' +
      '<div class="tour-modal__heading"><span class="tour-modal__level"></span><h3 id="tour-modal-title"></h3></div>' +
      '<button type="button" class="tour-modal__close" data-close aria-label="Close 3D view">' + CLOSE_ICON + "</button>" +
      "</div>" +
      '<div class="tour-modal__stage"></div>' +
      "</div>";
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) closeTour();
    });
    document.addEventListener("keydown", function (e) {
      if (!modalState) return;
      if (e.key === "Escape") closeTour();
      else if (e.key === "Tab") {
        // keep keyboard focus inside the viewer
        var f = modal.querySelectorAll("button, a[href], iframe");
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    return modal;
  }

  function showTour(index) {
    var level = modalState.level, views = validViews(level);
    var v = views[index];
    if (!v) return;
    modalState.index = index;
    var name = v.name || "View " + (index + 1);
    modal.querySelector(".tour-modal__level").textContent = level.name;
    modal.querySelector("#tour-modal-title").textContent = name;
    // Each pin shows only its own render (no browsing to other views from here)
    var src = kuulaEmbed(v.url).replace(/([?&])thumbs=1/, "$1thumbs=0");
    modal.querySelector(".tour-modal__stage").innerHTML = tourInner(src, name, level.name);
  }

  function openTour(level, index, trigger) {
    ensureModal();
    clearTimeout(modalTimer);
    modalReturnFocus = trigger || document.activeElement;
    modalState = { level: level, index: index };
    showTour(index);
    modal.hidden = false;
    document.documentElement.classList.add("tour-open");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { modal.classList.add("is-open"); });
    });
    modal.querySelector(".tour-modal__close").focus({ preventScroll: true });
  }

  function closeTour() {
    if (!modalState) return;
    modalState = null;
    modal.classList.remove("is-open");
    document.documentElement.classList.remove("tour-open");
    modalTimer = setTimeout(function () {
      modal.hidden = true;
      modal.querySelector(".tour-modal__stage").innerHTML = ""; // stop the 3D view
    }, 280);
    if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus({ preventScroll: true });
  }

  function renderViews(level) {
    var views = validViews(level);
    if (!views.length) return comingSoon("3D views");

    if (state.view >= views.length) state.view = 0;
    var current = views[state.view];
    var html = "";

    if (views.length > 1) {
      html += '<div class="view-switch" role="group" aria-label="3D views">';
      views.forEach(function (v, i) {
        html +=
          '<button type="button" class="view-btn" data-view="' + i + '" aria-pressed="' + (i === state.view) + '">' +
          esc(v.name || "View " + (i + 1)) + "</button>";
      });
      html += "</div>";
    }

    var src = kuulaEmbed(current.url);
    var name = current.name || level.name + " 3D view";
    var inner = tourInner(src, name, level.name);
    html +=
      '<div class="frame">' +
      '<div class="tour">' + inner + "</div>" +
      '<div class="caption"><span><strong>' + esc(name) + "</strong> \u00b7 Drag to look around</span>" +
      '<span class="caption__links">' +
      (hasPin(current) && level.floorPlan ? '<button type="button" class="link-btn" data-goto-plan>See on floor plan</button>' : "") +
      '<a class="open-link" href="' + esc(src) + '" target="_blank" rel="noopener">Open in new tab ' + OPEN_ICON + "</a>" +
      "</span></div></div>";
    return html;
  }

  function renderPlan(level) {
    var file = level.floorPlan && String(level.floorPlan).trim();
    if (!file) return comingSoon("floor plan");

    var path = planPath(file);
    var full = level.floorPlanFull ? planPath(level.floorPlanFull) : path;
    var alt = level.planOnly ? level.name : level.name + " floor plan";
    var bare = file.split("?")[0].split("#")[0];
    var body;
    var pins = level.planOnly ? [] : validViews(level)
      .map(function (v, i) { return { view: v, index: i }; })
      .filter(function (p) { return hasPin(p.view); });

    if (PDF_EXT.test(bare)) {
      body = '<iframe class="plan-pdf" src="' + esc(path) + '#view=FitH" title="' + esc(alt) + '"></iframe>';
    } else if (IMAGE_EXT.test(bare) && pins.length) {
      // Floor plan with clickable pins where each 3D view was taken
      body =
        '<div class="plan-pins"><div class="plan-stage">' +
        '<img src="' + esc(path) + '" alt="' + esc(alt) + '">' +
        pins.map(function (p) {
          var x = Math.min(100, Math.max(0, +p.view.pin.x)), y = Math.min(100, Math.max(0, +p.view.pin.y));
          var label = p.view.name || "View " + (p.index + 1);
          return (
            '<button type="button" class="pin' + (x > 70 ? " pin--left" : "") + '" data-pin-view="' + p.index + '"' +
            ' style="left:' + x + '%;top:' + y + '%" aria-label="Open 3D view: ' + esc(label) + '">' +
            '<span class="pin__dot" aria-hidden="true"></span><span class="pin__label">' + esc(label) + "</span></button>"
          );
        }).join("") +
        "</div></div>";
    } else if (IMAGE_EXT.test(bare)) {
      body =
        '<a class="plan-img-link" href="' + esc(full) + '" target="_blank" rel="noopener" title="Open full size">' +
        '<img src="' + esc(path) + '" alt="' + esc(alt) + '"></a>';
    } else {
      body = "";
    }

    return (
      '<div class="frame">' + body +
      '<div class="caption"><span><strong>' + esc(alt) + "</strong>" +
      (PDF_EXT.test(bare) ? " \u00b7 PDF" : pins.length && IMAGE_EXT.test(bare) ? " \u00b7 Tap a red pin to step inside" : body ? " \u00b7 Tap image to enlarge" : "") + "</span>" +
      '<a class="open-link" href="' + esc(full) + '" target="_blank" rel="noopener">Open full size ' + OPEN_ICON + "</a>" +
      "</div></div>"
    );
  }

  function render() {
    var level = getLevel(state.level);
    if (!level) return;

    Array.prototype.forEach.call(el.nav.querySelectorAll(".level-btn"), function (b) {
      b.setAttribute("aria-selected", String(b.getAttribute("data-level") === state.level));
    });
    el.levelTitle.textContent = level.name;
    // Plan-only sections (e.g. Site Plan) have no 3D views, so hide the switch
    var planOnly = !!level.planOnly;
    el.modeSwitch.hidden = planOnly;
    var mode = planOnly ? "plan" : state.mode;
    el.tabViews.setAttribute("aria-selected", String(mode === "views"));
    el.tabPlan.setAttribute("aria-selected", String(mode === "plan"));
    el.panel.innerHTML = mode === "plan" ? renderPlan(level) : renderViews(level);
    var stageImg = el.panel.querySelector(".plan-stage img");
    if (stageImg) {
      var setRatio = function () {
        if (stageImg.naturalWidth && stageImg.naturalHeight)
          stageImg.parentNode.style.setProperty("--plan-ratio", stageImg.naturalWidth / stageImg.naturalHeight);
      };
      if (stageImg.complete) setRatio(); else stageImg.addEventListener("load", setRatio);
    }
  }

  /* ---------- URL hash (e.g. #level-2/plan) so links can be shared ---------- */

  function readHash() {
    var parts = decodeURIComponent(location.hash.replace(/^#/, "")).split("--");
    var levelId = getLevel(parts[0]) ? parts[0] : null;
    return {
      level: levelId,
      mode: parts[1] === "plan" ? "plan" : "views",
      view: Math.max(0, (parseInt(parts[2], 10) || 1) - 1),
    };
  }

  function writeHash() {
    var lvl = getLevel(state.level);
    var mode = lvl && lvl.planOnly ? "plan" : state.mode;
    var h = "#" + state.level + "--" + mode + (mode === "views" && state.view ? "--" + (state.view + 1) : "");
    if (location.hash !== h) history.replaceState(null, "", h);
  }

  function update(patch) {
    for (var k in patch) state[k] = patch[k];
    render();
    writeHash();
  }

  /* ---------- Events ---------- */

  el.nav.addEventListener("click", function (e) {
    var b = e.target.closest(".level-btn");
    if (b) update({ level: b.getAttribute("data-level"), view: 0 });
  });
  el.tabViews.addEventListener("click", function () { update({ mode: "views" }); });
  el.tabPlan.addEventListener("click", function () { update({ mode: "plan" }); });
  el.panel.addEventListener("click", function (e) {
    var b = e.target.closest(".view-btn");
    if (b) return update({ view: parseInt(b.getAttribute("data-view"), 10) });
    var pin = e.target.closest("[data-pin-view]");
    if (pin) return openTour(getLevel(state.level), parseInt(pin.getAttribute("data-pin-view"), 10), pin);
    if (e.target.closest("[data-goto-plan]")) {
      update({ mode: "plan" });
      return scrollToContent();
    }
  });
  function scrollToContent() {
    var head = document.querySelector(".level-head");
    var nav = document.querySelector(".level-nav");
    if (!head) return;
    var top = head.getBoundingClientRect().top + window.pageYOffset - (nav ? nav.offsetHeight : 0) - 12;
    if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: "smooth" });
  }

  window.addEventListener("hashchange", function () {
    var h = readHash();
    if (h.level) { state.level = h.level; state.mode = h.mode; state.view = h.view; render(); }
  });

  /* ---------- Start ---------- */

  var fromHash = readHash();
  var fallback = getLevel(data.defaultLevel) ? data.defaultLevel : (getLevel("level-1") ? "level-1" : (levels[0] && levels[0].id));
  state.level = fromHash.level || fallback;
  state.mode = fromHash.level ? fromHash.mode : "views";
  state.view = fromHash.level ? fromHash.view : 0;

  renderNav();
  render();
})();
