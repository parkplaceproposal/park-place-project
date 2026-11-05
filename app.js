(function () {
  "use strict";

  var data = window.PROPOSAL || { levels: [] };
  var levels = data.levels || [];
  var IMAGE_EXT = /\.(jpe?g|png|webp|gif|svg|avif)$/i;
  var PDF_EXT = /\.pdf$/i;
  var OPEN_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
    '<path d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5"/></svg>';
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6 6 18"/></svg>';
  var ARROW_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var ARROW_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  var state = { lobby: true, level: null, mode: "plan", view: 0 };

  var el = {
    title: document.getElementById("project-title"),
    lobby: document.getElementById("lobby"),
    explore: document.getElementById("explore"),
    house: document.getElementById("lobby-house"),
    nav: document.getElementById("level-nav"),
    levelTitle: document.getElementById("level-title"),
    panel: document.getElementById("panel"),
    pager: document.getElementById("level-pager"),
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

  function levelHref(id) {
    return "#" + id + "--plan";
  }

  /* ---------- Lobby: a house whose floors link to each level ---------- */

  function renderHouse() {
    var floors = levels.filter(function (l) { return !l.planOnly; });
    if (!floors.length) return;
    var below = floors[0] && /basement|cellar|lower/i.test(floors[0].id + floors[0].name) ? floors[0] : null;
    var rest = floors.filter(function (l) { return l !== below; });
    var roof = rest.length > 1 ? rest[rest.length - 1] : null;      // top floor sits in the roof
    var stack = rest.filter(function (l) { return l !== roof; }).reverse(); // top to bottom

    // Walls run from y=178 to y=352; split that space between the stacked floors
    var slots = [];
    if (roof) slots.push({ l: roof, x: 116, y: 112, w: 168, h: 54 });
    var top = 182, bottom = 344, gap = 8;
    var h = stack.length ? (bottom - top - gap * (stack.length - 1)) / stack.length : 0;
    stack.forEach(function (l, i) { slots.push({ l: l, x: 66, y: top + i * (h + gap), w: 268, h: h }); });
    if (below) slots.push({ l: below, x: 66, y: 370, w: 268, h: 62, below: true });

    var svg =
      '<svg class="house" viewBox="0 0 400 446" role="img" aria-labelledby="house-title">' +
      '<title id="house-title">Park Place, floor by floor</title>' +
      // chimney, roof, walls, floor line
      '<path class="house__line" d="M90 118V58h30v32"/>' +
      '<path class="house__line house__roof" d="M16 180 200 26l184 154"/>' +
      '<path class="house__line" d="M50 160v197M350 160v197M45 352h310"/>' +
      // ground and the three green steps from the logo
      '<path class="house__ground" d="M0 360h400"/>';

    slots.forEach(function (s) {
      var cy = s.y + s.h / 2;
      svg +=
        '<a class="floor' + (s.below ? " floor--below" : "") + '" href="' + levelHref(s.l.id) + '" aria-label="' + esc(s.l.name) + '">' +
        '<rect x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" rx="8"/>' +
        '<text class="floor__name" x="200" y="' + cy + '" dominant-baseline="central">' + esc(s.l.name) + "</text>" +
        '<path class="floor__arrow" d="M' + (s.x + s.w - 20) + " " + (cy - 7) + "l6 7-6 7" + '"/>' +
        "</a>";
    });
    svg += "</svg>";
    el.house.innerHTML = svg;
  }

  /* ---------- Level menu ---------- */

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

  // On phones the menu scrolls sideways: keep the current level in view
  function revealInNav(btn) {
    var list = el.nav;
    if (list.scrollWidth <= list.clientWidth) return;
    var left = btn.offsetLeft - list.offsetLeft, right = left + btn.offsetWidth;
    if (left < list.scrollLeft + 8) list.scrollLeft = Math.max(0, left - 16);
    else if (right > list.scrollLeft + list.clientWidth - 32) list.scrollLeft = Math.min(list.scrollWidth, right - list.clientWidth + 48);
    updateNavFade();
  }
  function updateNavFade() {
    var list = el.nav;
    list.classList.toggle("at-end", list.scrollLeft + list.clientWidth >= list.scrollWidth - 16);
  }
  el.nav.addEventListener("scroll", updateNavFade, { passive: true });
  window.addEventListener("resize", updateNavFade);

  /* ---------- 3D views ---------- */

  function tourInner(src, name, levelName) {
    return window.PREVIEW_NO_EMBED
      ? '<div class="tour-fallback"><p>' + esc(name) + '</p>' +
        '<a class="tour-fallback__btn" href="' + esc(src) + '" target="_blank" rel="noopener">Open 3D view ' + OPEN_ICON + '</a>' +
        '<small>In this preview, 3D views open in a new tab. On the published website they play right here.</small></div>'
      : '<iframe src="' + esc(src) + '" title="' + esc(levelName + " \u2013 " + name) + '"' +
        ' allow="xr-spatial-tracking; gyroscope; accelerometer; fullscreen"' +
        ' allowfullscreen scrolling="no"></iframe>';
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
    html +=
      '<div class="frame">' +
      '<div class="tour">' + tourInner(src, name, level.name) + "</div>" +
      '<div class="caption"><span><strong>' + esc(name) + "</strong> \u00b7 Drag to look around</span>" +
      '<span class="caption__links">' +
      (hasPin(current) && level.floorPlan ? '<button type="button" class="link-btn" data-goto-plan>See on floor plan</button>' : "") +
      '<a class="open-link" href="' + esc(src) + '" target="_blank" rel="noopener">Open in new tab ' + OPEN_ICON + "</a>" +
      "</span></div></div>";
    return html;
  }

  /* ---------- Full-screen 3D viewer (opened from floor plan pins) ---------- */

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

  function openTour(level, index, trigger) {
    var v = validViews(level)[index];
    if (!v) return;
    ensureModal();
    clearTimeout(modalTimer);
    modalReturnFocus = trigger || document.activeElement;
    modalState = { level: level, index: index };
    var name = v.name || "View " + (index + 1);
    modal.querySelector(".tour-modal__level").textContent = level.name;
    modal.querySelector("#tour-modal-title").textContent = name;
    // Each pin shows only its own render (no browsing to other views from here)
    var src = kuulaEmbed(v.url).replace(/([?&])thumbs=1/, "$1thumbs=0");
    modal.querySelector(".tour-modal__stage").innerHTML = tourInner(src, name, level.name);
    modal.hidden = false;
    document.documentElement.classList.add("tour-open");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { modal.classList.add("is-open"); });
    });
    modal.querySelector(".tour-modal__close").focus({ preventScroll: true });
  }

  // Front / rear renders on the lobby open as still images in the same viewer
  function openImage(name, src, trigger) {
    ensureModal();
    clearTimeout(modalTimer);
    modalReturnFocus = trigger || document.activeElement;
    modalState = { image: src };
    modal.querySelector(".tour-modal__level").textContent = "Exterior";
    modal.querySelector("#tour-modal-title").textContent = name;
    modal.querySelector(".tour-modal__stage").innerHTML =
      '<img class="tour-image" src="' + esc(src) + '" alt="' + esc(name + " of Park Place") + '">';
    modal.hidden = false;
    document.documentElement.classList.add("tour-open");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { modal.classList.add("is-open"); });
    });
    modal.querySelector(".tour-modal__close").focus({ preventScroll: true });
  }
  el.lobby.addEventListener("click", function (e) {
    var card = e.target.closest("[data-exterior]");
    if (card) openImage(card.getAttribute("data-exterior-name"), card.getAttribute("data-exterior"), card);
  });

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

  /* ---------- Floor plans (with zoom and pins) ---------- */

  function renderPlan(level) {
    var file = level.floorPlan && String(level.floorPlan).trim();
    if (!file) return comingSoon("floor plan");

    var path = planPath(file);
    var full = level.floorPlanFull ? planPath(level.floorPlanFull) : path;
    var alt = level.planOnly ? level.name : level.name + " floor plan";
    var bare = file.split("?")[0].split("#")[0];
    var pins = level.planOnly ? [] : validViews(level)
      .map(function (v, i) { return { view: v, index: i }; })
      .filter(function (p) { return hasPin(p.view); });
    var body, hint = "";

    if (PDF_EXT.test(bare)) {
      body = '<iframe class="plan-pdf" src="' + esc(path) + '#view=FitH" title="' + esc(alt) + '"></iframe>';
      hint = "PDF";
    } else if (IMAGE_EXT.test(bare)) {
      body =
        '<div class="plan-zoom">' +
        '<div class="plan-zoom__viewport">' +
        '<div class="plan-stage">' +
        '<img src="' + esc(path) + '" alt="' + esc(alt) + '" draggable="false">' +
        pins.map(function (p) {
          var x = Math.min(100, Math.max(0, +p.view.pin.x)), y = Math.min(100, Math.max(0, +p.view.pin.y));
          var label = p.view.name || "View " + (p.index + 1);
          return (
            '<button type="button" class="pin' + (x > 70 ? " pin--left" : "") + '" data-pin-view="' + p.index + '"' +
            ' style="left:' + x + '%;top:' + y + '%" aria-label="Open 3D view: ' + esc(label) + '">' +
            '<span class="pin__dot" aria-hidden="true"></span><span class="pin__label">' + esc(label) + "</span></button>"
          );
        }).join("") +
        "</div></div>" +
        '<div class="zoom-controls" role="group" aria-label="Zoom floor plan">' +
        '<button type="button" data-zoom="in" aria-label="Zoom in"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>' +
        '<button type="button" data-zoom="out" aria-label="Zoom out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>' +
        '<button type="button" data-zoom="reset" aria-label="Show whole plan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>' +
        "</div></div>";
      hint = pins.length ? "Tap a red pin to step inside" : "";
    } else {
      body = "";
    }

    return (
      '<div class="frame">' + body +
      '<div class="caption"><span><strong>' + esc(alt) + "</strong>" + (hint ? " \u00b7 " + esc(hint) : "") + "</span>" +
      '<a class="open-link" href="' + esc(full) + '" target="_blank" rel="noopener">Open full size ' + OPEN_ICON + "</a>" +
      "</div></div>"
    );
  }

  /* Pan & zoom for a floor plan: buttons, pinch, Ctrl/trackpad scroll, double-click, drag */
  function setupZoom(root) {
    var vp = root.querySelector(".plan-zoom__viewport");
    var stage = root.querySelector(".plan-stage");
    var img = stage.querySelector("img");
    var btnIn = root.querySelector('[data-zoom="in"]');
    var btnOut = root.querySelector('[data-zoom="out"]');
    var btnReset = root.querySelector('[data-zoom="reset"]');
    var MAX = 5, z = 1, tx = 0, ty = 0;
    var pts = {}, count = 0, start = null, moved = false, suppressClick = false;

    function setRatio() {
      if (img.naturalWidth && img.naturalHeight) vp.style.setProperty("--plan-ratio", img.naturalWidth / img.naturalHeight);
    }
    if (img.complete) setRatio(); else img.addEventListener("load", setRatio);

    function apply(animate) {
      var w = vp.clientWidth, h = vp.clientHeight;
      tx = Math.min(0, Math.max(w * (1 - z), tx));
      ty = Math.min(0, Math.max(h * (1 - z), ty));
      stage.classList.toggle("is-animating", !!animate);
      stage.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + z + ")";
      stage.style.setProperty("--z", z);
      vp.classList.toggle("is-zoomed", z > 1.001);
      btnOut.disabled = btnReset.disabled = z <= 1.001;
      btnIn.disabled = z >= MAX - 0.001;
    }
    function zoomAt(nz, cx, cy, animate) {
      nz = Math.min(MAX, Math.max(1, nz));
      var px = (cx - tx) / z, py = (cy - ty) / z;
      z = nz; tx = cx - px * z; ty = cy - py * z;
      apply(animate);
    }
    function local(e) {
      var r = vp.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function snapshot() {
      var ids = Object.keys(pts), a = pts[ids[0]], b = pts[ids[1]];
      start = { z: z, tx: tx, ty: ty, x: a.x, y: a.y };
      if (b) {
        start.dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        start.mx = (a.x + b.x) / 2; start.my = (a.y + b.y) / 2;
      }
    }

    btnIn.addEventListener("click", function () { zoomAt(z * 1.6, vp.clientWidth / 2, vp.clientHeight / 2, true); });
    btnOut.addEventListener("click", function () { zoomAt(z / 1.6, vp.clientWidth / 2, vp.clientHeight / 2, true); });
    btnReset.addEventListener("click", function () { z = 1; tx = ty = 0; apply(true); });

    vp.addEventListener("wheel", function (e) {
      if (!e.ctrlKey && !e.metaKey) return; // plain scrolling still scrolls the page
      e.preventDefault();
      var p = local(e);
      zoomAt(z * Math.exp(-e.deltaY * 0.01), p.x, p.y, false);
    }, { passive: false });

    vp.addEventListener("dblclick", function (e) {
      if (e.target.closest(".pin")) return;
      var p = local(e);
      if (z >= MAX * 0.7) { z = 1; tx = ty = 0; apply(true); }
      else zoomAt(z * 2, p.x, p.y, true);
    });

    vp.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pts[e.pointerId] = local(e);
      count = Object.keys(pts).length;
      if (count === 1) { moved = false; suppressClick = false; }
      snapshot();
    });
    vp.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      pts[e.pointerId] = local(e);
      var ids = Object.keys(pts);
      if (ids.length >= 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        var nz = Math.min(MAX, Math.max(1, start.z * dist / start.dist));
        var px = (start.mx - start.tx) / start.z, py = (start.my - start.ty) / start.z;
        z = nz; tx = mx - px * z; ty = my - py * z;
        moved = true;
        apply(false);
      } else if (z > 1.001) {
        var p = pts[ids[0]], dx = p.x - start.x, dy = p.y - start.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        if (!moved) { moved = true; try { vp.setPointerCapture(e.pointerId); } catch (err) {} }
        tx = start.tx + dx; ty = start.ty + dy;
        apply(false);
      }
    });
    function end(e) {
      if (!pts[e.pointerId]) return;
      delete pts[e.pointerId];
      if (moved) suppressClick = true;
      if (Object.keys(pts).length) snapshot();
    }
    vp.addEventListener("pointerup", end);
    vp.addEventListener("pointercancel", end);
    // A drag shouldn't count as a click on a pin
    vp.addEventListener("click", function (e) {
      if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; }
    }, true);

    window.addEventListener("resize", function () { if (document.body.contains(vp)) apply(false); });
    apply(false);
  }

  /* ---------- Previous / next level ---------- */

  function renderPager() {
    var i = -1;
    levels.forEach(function (l, k) { if (l.id === state.level) i = k; });
    var prev = levels[i - 1], next = levels[i + 1];
    el.pager.innerHTML =
      (prev
        ? '<button type="button" class="pager-btn pager-btn--prev" data-level="' + esc(prev.id) + '">' + ARROW_L +
          '<span><small>Previous</small><strong>' + esc(prev.name) + "</strong></span></button>"
        : '<span></span>') +
      (next
        ? '<button type="button" class="pager-btn pager-btn--next" data-level="' + esc(next.id) + '">' +
          '<span><small>Next</small><strong>' + esc(next.name) + "</strong></span>" + ARROW_R + "</button>"
        : '<span></span>');
  }

  /* ---------- Render ---------- */

  function render() {
    el.lobby.hidden = !state.lobby;
    el.explore.hidden = state.lobby;
    document.documentElement.classList.toggle("in-lobby", state.lobby);
    if (state.lobby) return;

    var level = getLevel(state.level);
    if (!level) return;

    Array.prototype.forEach.call(el.nav.querySelectorAll(".level-btn"), function (b) {
      var on = b.getAttribute("data-level") === state.level;
      b.setAttribute("aria-selected", String(on));
      if (on) revealInNav(b);
    });
    el.levelTitle.textContent = level.name;
    // Plan-only sections (e.g. Site Plan) have no 3D views, so hide the switch
    // Every level shows its floor plan; 3D views open from the pins
    var mode = "plan";
    el.panel.innerHTML = mode === "plan" ? renderPlan(level) : renderViews(level);
    var zoom = el.panel.querySelector(".plan-zoom");
    if (zoom) setupZoom(zoom);
    renderPager();
  }

  /* ---------- URL hash: (none) = lobby, #level-2--plan, #level-2--views--2 ---------- */

  function readHash() {
    var raw = decodeURIComponent(location.hash.replace(/^#/, ""));
    var parts = raw.split("--");
    var levelId = getLevel(parts[0]) ? parts[0] : null;
    return {
      lobby: !levelId,
      level: levelId,
      mode: parts[1] === "views" ? "views" : "plan",
      view: Math.max(0, (parseInt(parts[2], 10) || 1) - 1),
    };
  }

  function writeHash() {
    if (state.lobby) return;
    var lvl = getLevel(state.level);
    var h = "#" + state.level + "--plan";
    if (location.hash !== h) history.replaceState(null, "", h);
  }

  function update(patch) {
    state.lobby = false;
    for (var k in patch) state[k] = patch[k];
    render();
    writeHash();
  }

  function scrollToContent() {
    var head = document.querySelector(".level-head");
    var nav = document.querySelector(".level-nav");
    if (!head) return;
    var top = head.getBoundingClientRect().top + window.pageYOffset - (nav ? nav.offsetHeight : 0) - 12;
    if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: "smooth" });
  }

  function applyHash() {
    if (/^#lobby$/i.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
    var h = readHash();
    var wasLobby = state.lobby;
    state.lobby = h.lobby;
    if (!h.lobby) { state.level = h.level; state.mode = h.mode; state.view = h.view; }
    render();
    if (wasLobby !== state.lobby) window.scrollTo(0, 0);
  }

  /* ---------- Events ---------- */

  el.nav.addEventListener("click", function (e) {
    var b = e.target.closest(".level-btn");
    if (b) update({ level: b.getAttribute("data-level"), view: 0 });
  });
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
  el.pager.addEventListener("click", function (e) {
    var b = e.target.closest(".pager-btn");
    if (!b) return;
    update({ level: b.getAttribute("data-level"), view: 0 });
    scrollToContent();
  });
  window.addEventListener("hashchange", applyHash);
  window.addEventListener("popstate", applyHash);

  // The logo goes back to the lobby with a clean address (no "#..." at the end)
  var home = document.querySelector(".brand-home");
  if (home) home.addEventListener("click", function (e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; // let "open in new tab" work
    e.preventDefault();
    if (location.hash) history.pushState(null, "", location.pathname + location.search);
    applyHash();
  });

  /* ---------- Opening intro ---------- */
  // The logo and title start large in the middle of a white screen, then glide
  // up into the header while the lobby fades in. Any click, tap or key skips it.
  function runIntro() {
    var root = document.documentElement;
    var brand = document.querySelector(".site-header .wrap"); // logo + title, moved as one unit
    var logo = document.querySelector(".brand-logo");
    var h1 = document.getElementById("project-title");
    var inner = document.querySelector(".lobby__inner");
    var parts = [brand, inner];
    var timers = [], done = false;
    var skipEvents = ["pointerdown", "keydown", "wheel", "touchstart"];

    function finish() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      skipEvents.forEach(function (t) { window.removeEventListener(t, finish, true); });
      parts.forEach(function (e) { e.style.transition = "none"; e.style.transform = ""; e.style.opacity = ""; e.style.transformOrigin = ""; });
      root.classList.remove("intro", "intro-reveal");
      requestAnimationFrame(function () { parts.forEach(function (e) { e.style.transition = ""; }); });
    }
    skipEvents.forEach(function (t) { window.addEventListener(t, finish, true); });
    function at(ms, fn) { timers.push(setTimeout(function () { if (!done) fn(); }, ms)); }

    function start() {
      if (done) return;
      window.scrollTo(0, 0);
      // The visible group = logo + title words (not their wider boxes)
      var L = logo.getBoundingClientRect();
      var range = document.createRange();
      range.selectNodeContents(h1);
      var T = range.getBoundingClientRect();
      var B = brand.getBoundingClientRect();
      var gl = Math.min(L.left, T.left), gr = Math.max(L.right, T.right);
      var gt = Math.min(L.top, T.top), gb = Math.max(L.bottom, T.bottom);
      var gw = gr - gl, gh = gb - gt, cx = gl + gw / 2, cy = gt + gh / 2;
      var vw = window.innerWidth, vh = window.innerHeight;
      var s = Math.max(1, Math.min((vw * 0.84) / gw, (vh * 0.42) / gh, 2.2));
      var moveTo = "translate(" + (vw / 2 - cx) + "px," + (vh / 2 - cy) + "px) scale(";

      // 1. Centered and larger, fading in
      brand.style.transformOrigin = (cx - B.left) + "px " + (cy - B.top) + "px";
      brand.style.transition = "none";
      brand.style.transform = moveTo + s * 0.96 + ")";
      inner.style.transform = "translateY(18px)";
      void brand.offsetWidth;
      brand.style.transition = "opacity .7s ease, transform .9s cubic-bezier(.2,.8,.2,1)";
      brand.style.opacity = "1";
      brand.style.transform = moveTo + s + ")";

      // 2. Glide up into the header as one piece
      at(1300, function () {
        brand.style.transition = "transform 1.2s cubic-bezier(.65,0,.35,1)";
        brand.style.transform = "";
      });
      // 3. Reveal the lobby underneath
      at(2250, function () {
        root.classList.add("intro-reveal");
        inner.style.transition = "transform .9s cubic-bezier(.2,.8,.2,1)";
        inner.style.transform = "";
      });
      at(3150, finish);
    }

    // Wait for the fonts so the title is measured at its real size
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 800); })]).then(start);
  }

  /* ---------- Start ---------- */

  var first = levels.filter(function (l) { return !l.planOnly; });
  state.level = getLevel(data.defaultLevel) ? data.defaultLevel : (first[0] && first[0].id);
  // Old links ending in "#lobby" open the lobby with a clean address
  if (/^#lobby$/i.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  renderHouse();
  renderNav();
  applyHash();
  if (document.documentElement.classList.contains("intro")) {
    if (state.lobby) runIntro(); else document.documentElement.classList.remove("intro");
  }
})();
