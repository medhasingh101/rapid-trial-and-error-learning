(function () {
  var pages = Array.prototype.slice.call(document.querySelectorAll(".page[data-page]"));
  var total = pages.length;
  var tabs = document.querySelectorAll(".tab[data-goto]");
  var pagerPrev = document.querySelector("#pager-prev");
  var pagerNext = document.querySelector("#pager-next");
  var pagerDots = document.querySelector("#pager-dots");
  var scrollFill = document.querySelector("#scroll-fill");

  var currentIndex = 0;
  var wheelLock = false;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wheelCooldown = reduceMotion ? 320 : 620;
  var EDGE = 56;

  function resolveHashTarget(hashId) {
    if (!hashId) return null;

    var el = document.getElementById(hashId);
    if (!el) return null;

    var pageEl = el.closest ? el.closest(".page[data-page]") : null;
    if (!pageEl) return null;

    var idx = parseInt(pageEl.getAttribute("data-page"), 10);
    if (isNaN(idx)) return null;

    return { el: el, pageEl: pageEl, index: idx };
  }

  function getPageIndexFromHash() {
    var h = (window.location.hash || "").replace(/^#/, "");
    if (!h) return 0;
    var i = pages.findIndex(function (p) {
      return p.id === h;
    });
    if (i >= 0) return i;

    var target = resolveHashTarget(h);
    return target ? target.index : 0;
  }

  function setScrollProgress() {
    if (!scrollFill || total < 1) return;
    var el = pages[currentIndex];
    if (!el) return;

    var sh = el.scrollHeight;
    var ch = el.clientHeight;
    var maxScroll = Math.max(0, sh - ch);
    var pageScrollRatio = maxScroll > 0 ? el.scrollTop / maxScroll : 1;
    var segment = 100 / total;
    var pct = currentIndex * segment + pageScrollRatio * segment;
    scrollFill.style.width = Math.min(100, Math.max(0, pct)) + "%";
  }

  function updatePagerUi() {
    tabs.forEach(function (tab) {
      var idx = parseInt(tab.getAttribute("data-goto"), 10);
      var on = idx === currentIndex;
      tab.classList.toggle("is-active", on);
      tab.setAttribute("aria-current", on ? "page" : "false");
    });

    if (pagerDots) {
      var dots = pagerDots.querySelectorAll(".pager-dot");
      dots.forEach(function (dot, i) {
        dot.setAttribute("aria-current", i === currentIndex ? "true" : "false");
      });
    }

    if (pagerPrev) pagerPrev.disabled = currentIndex <= 0;
    if (pagerNext) pagerNext.disabled = currentIndex >= total - 1;

    if (pages[currentIndex] && pages[currentIndex].id) {
      window.history.replaceState(null, "", "#" + pages[currentIndex].id);
    }
  }

  function goToPage(index) {
    if (index < 0 || index >= total) return;
    currentIndex = index;
    pages.forEach(function (p, i) {
      var active = i === currentIndex;
      p.classList.toggle("is-active", active);
      p.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) p.scrollTop = 0;
    });
    updatePagerUi();
    setScrollProgress();
  }

  function lockWheel() {
    wheelLock = true;
    window.setTimeout(function () {
      wheelLock = false;
    }, wheelCooldown);
  }

  function handleWheel(e) {
    if (wheelLock) return;
    var t = e.target;
    if (t && t.closest && t.closest("input, textarea, select")) return;

    // Let horizontal scroll regions behave normally.
    if (t && t.closest && t.closest(".h-scroll")) {
      var hs = t.closest(".h-scroll");
      if (hs && hs.scrollWidth > hs.clientWidth) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      }
    }

    var el = pages[currentIndex];
    if (!el) return;

    var st = el.scrollTop;
    var ch = el.clientHeight;
    var sh = el.scrollHeight;
    var atBottom = st + ch >= sh - EDGE;
    var atTop = st <= EDGE;
    var noOverflow = sh <= ch + 4;

    if (e.deltaY > 0) {
      if ((noOverflow || atBottom) && currentIndex < total - 1) {
        e.preventDefault();
        lockWheel();
        goToPage(currentIndex + 1);
      }
    } else if (e.deltaY < 0) {
      if ((noOverflow || atTop) && currentIndex > 0) {
        e.preventDefault();
        lockWheel();
        goToPage(currentIndex - 1);
      }
    }
  }

  function buildDots() {
    if (!pagerDots) return;
    pagerDots.innerHTML = "";
    pages.forEach(function (p, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pager-dot";
      btn.addEventListener("click", function () {
        goToPage(i);
      });
      btn.setAttribute("aria-label", "Go to " + (p.id || "section " + (i + 1)));
      pagerDots.appendChild(btn);
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var idx = parseInt(tab.getAttribute("data-goto"), 10);
      if (!isNaN(idx)) goToPage(idx);
    });
  });

  if (pagerPrev) {
    pagerPrev.addEventListener("click", function () {
      goToPage(currentIndex - 1);
    });
  }
  if (pagerNext) {
    pagerNext.addEventListener("click", function () {
      goToPage(currentIndex + 1);
    });
  }

  window.addEventListener("keydown", function (e) {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      goToPage(currentIndex + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      goToPage(currentIndex - 1);
    }
  });

  window.addEventListener("hashchange", function () {
    var h = (window.location.hash || "").replace(/^#/, "");
    if (!h) {
      goToPage(0);
      return;
    }

    // If the hash matches a page id, treat it as page navigation.
    var i = pages.findIndex(function (p) {
      return p.id === h;
    });
    if (i >= 0) {
      goToPage(i);
      return;
    }

    // Otherwise, treat it as an in-page anchor within one of the pages.
    var target = resolveHashTarget(h);
    if (!target) {
      goToPage(0);
      return;
    }

    goToPage(target.index);
    window.setTimeout(function () {
      // If the anchor lives inside a <details>, open it.
      if (target.el && target.el.closest) {
        var details = target.el.closest("details.drop");
        if (details) details.open = true;
      }
      target.el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 220);
  });

  pages.forEach(function (p) {
    p.addEventListener("scroll", setScrollProgress, { passive: true });
  });

  document.addEventListener("wheel", handleWheel, { passive: false });

  // -----------------------------
  // Paper Visual Block behaviors
  // -----------------------------
  function setupPaperVisualBlocks() {
    // Caption toggle: translated <-> original
    var toggles = document.querySelectorAll("[data-pv-toggle-original]");
    toggles.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var block = btn.closest(".pv-block");
        if (!block) return;
        var translated = block.querySelector(".pv-caption-translated");
        var original = block.querySelector(".pv-caption-original");
        if (!translated || !original) return;

        var showingOriginal = !original.hidden;
        if (showingOriginal) {
          original.hidden = true;
          translated.hidden = false;
          btn.textContent = "Show original caption";
          btn.setAttribute("aria-expanded", "false");
        } else {
          original.hidden = false;
          translated.hidden = true;
          btn.textContent = "Show translated caption";
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    // Hero demo buttons (scroll to a visual)
    var demoScrollers = document.querySelectorAll("[data-scroll-to]");
    demoScrollers.forEach(function (b) {
      b.addEventListener("click", function () {
        var sel = b.getAttribute("data-scroll-to");
        if (!sel) return;
        var target = document.querySelector(sel);
        if (!target) return;
        var pageEl = target.closest(".page[data-page]");
        if (!pageEl) {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        var idx = parseInt(pageEl.getAttribute("data-page"), 10);
        if (!isNaN(idx)) goToPage(idx);
        // Small delay so the page container switches first.
        window.setTimeout(function () {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 220);
      });
    });

    // Tool-use icons
    document.querySelectorAll(".pv-tooluse-icon").forEach(function (btn) {
      var block = btn.closest(".pv-block");
      var note = block ? block.querySelector(".pv-tooluse-note") : null;
      function apply() {
        if (!note) return;
        var text = btn.getAttribute("data-note") || " ";
        note.textContent = text;
      }
      btn.addEventListener("pointerenter", apply);
      btn.addEventListener("focus", apply);
      btn.addEventListener("click", apply);
    });

    // Levels grid
    document.querySelectorAll(".pv-level, .pv-level-image").forEach(function (btn) {
      var block = btn.closest(".pv-block");
      var detail = block ? block.querySelector(".pv-level-detail") : null;
      function apply() {
        if (!detail) return;
        detail.textContent = btn.getAttribute("data-detail") || "";
      }
      btn.addEventListener("pointerenter", apply);
      btn.addEventListener("focus", apply);
      btn.addEventListener("click", apply);
    });

    // SSUP steps
    document.querySelectorAll(".pv-ssup-step").forEach(function (btn) {
      var block = btn.closest(".pv-block");
      var detailEl = block ? block.querySelector(".pv-ssup-detail") : null;
      function apply() {
        if (!block) return;
        var steps = block.querySelectorAll(".pv-ssup-step");
        steps.forEach(function (s) {
          s.classList.toggle("is-active", s === btn);
        });
        if (detailEl) {
          detailEl.textContent = btn.getAttribute("data-detail") || "";
        }
      }
      btn.addEventListener("click", apply);
      btn.addEventListener("focus", apply);
    });

    // Trial steps
    document.querySelectorAll(".pv-trial-step").forEach(function (btn) {
      var block = btn.closest(".pv-block");
      var detailEl = block ? block.querySelector(".pv-trial-detail") : null;
      function apply() {
        if (!block) return;
        var steps = block.querySelectorAll(".pv-trial-step");
        steps.forEach(function (s) {
          s.classList.toggle("is-active", s === btn);
        });
        if (detailEl) detailEl.textContent = btn.getAttribute("data-detail") || "";
      }
      btn.addEventListener("click", apply);
      btn.addEventListener("focus", apply);
    });

    // Mind/world mode toggle
    document.querySelectorAll(".pv-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var block = btn.closest(".pv-block");
        if (!block) return;
        var mode = btn.getAttribute("data-mode");
        if (!mode) return;

        var controls = block.querySelectorAll(".pv-mode-btn");
        controls.forEach(function (c) {
          c.classList.toggle("is-active", c === btn);
        });

        var layers = block.querySelectorAll(".pv-mode-layer[data-mode-layer]");
        layers.forEach(function (layer) {
          var lm = layer.getAttribute("data-mode-layer");
          layer.hidden = lm !== mode;
        });
      });
    });

    // Results overlays + key stats overlays
    document.querySelectorAll(".pv-block .pv-results").forEach(function (block) {
      var viewBtns = block.querySelectorAll(".pv-view-btn[data-view]");
      var pvBlock = block.closest(".pv-block");
      viewBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var view = btn.getAttribute("data-view");
          if (!view) return;
          viewBtns.forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
          var overlays = block.querySelectorAll(".pv-results-overlay[data-view]");
          overlays.forEach(function (ov) {
            ov.hidden = ov.getAttribute("data-view") !== view;
          });

          if (pvBlock) {
            var panels = pvBlock.querySelectorAll(".pv-results-panel[data-view]");
            panels.forEach(function (panel) {
              panel.hidden = panel.getAttribute("data-view") !== view;
            });
          }
        });
      });
    });

    // Learning curves visibility (fig 6A)
    document.querySelectorAll(".pv-block .pv-curves").forEach(function (block) {
      var curveButtons = block.querySelectorAll(".pv-view-btn[data-curves]");
      if (!curveButtons.length) return;

      var curves = block.querySelectorAll(".pv-curve[data-curve]");
      function setCurves(view) {
        curves.forEach(function (c) {
          var which = c.getAttribute("data-curve");
          var visible = false;
          if (view === "both") visible = true;
          if (view === "human") visible = which === "human";
          if (view === "model") visible = which === "model";
          c.hidden = !visible;
        });
      }

      curveButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var view = btn.getAttribute("data-curves");
          if (!view) return;
          curveButtons.forEach(function (b) {
            b.classList.toggle("is-active", b === btn);
          });
          setCurves(view);
        });
      });
      // Initial sync for accessibility.
      var active = block.querySelector(".pv-view-btn.is-active[data-curves]");
      if (active) setCurves(active.getAttribute("data-curves"));
    });

    // Cluster hover/click
    document.querySelectorAll(".pv-cluster-dot").forEach(function (dot) {
      var block = dot.closest(".pv-block");
      var detail = block ? block.querySelector(".pv-cluster-detail") : null;
      function apply() {
        if (!detail) return;
        detail.textContent = dot.getAttribute("data-detail") || "";
      }
      dot.addEventListener("pointerenter", apply);
      dot.addEventListener("focus", apply);
      dot.addEventListener("click", apply);
    });

    // Limitations demo reveal
    document.querySelectorAll("[data-pv-demo-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pv = btn.closest(".pv-block");
        var reveal = pv ? pv.querySelector(".pv-demo-reveal") : null;
        if (!reveal) return;
        var nowHidden = reveal.hidden;
        reveal.hidden = !nowHidden;
        btn.textContent = nowHidden ? "Hide failure cases" : "Run demo: show failure cases";
      });
    });

    // Future filter grid
    document.querySelectorAll(".pv-block[data-interaction='futureFilter']").forEach(function (block) {
      var controls = block.querySelectorAll(".pv-future-btn[data-filter]");
      var items = block.querySelectorAll(".pv-future-item");
      var detail = block.querySelector(".pv-future-detail");

      function applyFilter(filter) {
        items.forEach(function (it) {
          var tags = (it.getAttribute("data-filter-tags") || "").split(/\s+/);
          if (filter === "all") {
            it.hidden = false;
            return;
          }
          it.hidden = tags.indexOf(filter) === -1;
        });
      }

      controls.forEach(function (btn) {
        btn.addEventListener("click", function () {
          controls.forEach(function (c) {
            c.classList.toggle("is-active", c === btn);
          });
          var filter = btn.getAttribute("data-filter");
          applyFilter(filter);
          if (detail) detail.textContent = "Showing: " + filter;
        });
      });

      items.forEach(function (it) {
        it.addEventListener("pointerenter", function () {
          if (!detail) return;
          detail.textContent = it.getAttribute("data-detail") || "";
        });
        it.addEventListener("focus", function () {
          if (!detail) return;
          detail.textContent = it.getAttribute("data-detail") || "";
        });
        it.addEventListener("click", function () {
          if (!detail) return;
          detail.textContent = it.getAttribute("data-detail") || "";
        });
      });

      // Initial
      var active = block.querySelector(".pv-future-btn.is-active[data-filter]");
      if (active) applyFilter(active.getAttribute("data-filter"));
    });
  }

  function setupCTA() {
    var btn = document.querySelector("#cta-copy-takeaway");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var text =
        "Take-home message (placeholder): Replace this with your own final takeaway in 1-2 sentences.";
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        alert(text);
        return;
      }
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = "Copied (placeholder)";
        window.setTimeout(function () {
          btn.textContent = "Copy your take-home (placeholder)";
        }, 1200);
      });
    });
  }

  function setupGlossaryTooltips() {
    var terms = document.querySelectorAll(".gloss[data-def]");
    if (!terms.length) return;

    var tip = document.createElement("div");
    tip.className = "gloss-tip";
    tip.hidden = true;
    document.body.appendChild(tip);

    var activeEl = null;

    function hide() {
      activeEl = null;
      tip.hidden = true;
      tip.textContent = "";
    }

    function showFor(el) {
      var def = el.getAttribute("data-def");
      if (!def) return;
      activeEl = el;
      tip.textContent = def;
      tip.hidden = false;
      position();
    }

    function position() {
      if (!activeEl || tip.hidden) return;
      var r = activeEl.getBoundingClientRect();

      // Prefer above; fall back below.
      var gap = 10;
      var left = Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(12, r.left));
      var top = r.top - tip.offsetHeight - gap;
      if (top < 12) top = r.bottom + gap;
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }

    terms.forEach(function (el) {
      el.addEventListener("pointerenter", function () {
        showFor(el);
      });
      el.addEventListener("pointerleave", hide);
      el.addEventListener("focus", function () {
        showFor(el);
      });
      el.addEventListener("blur", hide);
      el.addEventListener("click", function (e) {
        // Allow tap to toggle on touch.
        if (activeEl === el && !tip.hidden) {
          hide();
          return;
        }
        showFor(el);
        e.preventDefault();
      });
    });

    window.addEventListener("scroll", position, { passive: true });
    window.addEventListener("resize", position, { passive: true });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
    });
    document.addEventListener("pointerdown", function (e) {
      if (!activeEl) return;
      if (e.target === activeEl || tip.contains(e.target)) return;
      hide();
    });
  }

  function setupExpandableSectionNav() {
    // Make the pill nav open the matching <details> section.
    document.querySelectorAll(".vnav-link[href^=\"#\"]").forEach(function (a) {
      a.addEventListener("click", function () {
        var hash = (a.getAttribute("href") || "").replace(/^#/, "");
        if (!hash) return;
        var el = document.getElementById(hash);
        if (!el) return;
        if (el.closest) {
          var details = el.closest("details.drop");
          if (details) details.open = true;
        }
      });
    });
  }

  // Build UI
  buildDots();
  goToPage(getPageIndexFromHash());

  window.addEventListener("load", function () {
    goToPage(getPageIndexFromHash());
    setupPaperVisualBlocks();
    setupExpandableSectionNav();
    setupGlossaryTooltips();
    setupCTA();
  });
})();
