// ./JS/ui.js
import { state } from "./state.js";
import { bindFileUploads, getYears } from "./data.js";

// ✅ Charts per pagina (barrel exports)
import {
  renderHomeKPIsForYear,
  renderHomeBookingCarousel,
  renderHomeRevenueChart,
  renderHomeCumulativeRevenueChartForYear,
  renderBezettingCharts,
  renderGedragCharts,
  renderDataVisCharts,
} from "./charts/index.js";

/* ============================================================
 * SCROLL PRESERVATION (voorkomt “verspringen” bij updates)
 * ============================================================ */

function ensureScrollState() {
  state.scroll ??= { windowY: 0, containers: {} };
  state.scroll.containers ??= {};
}

function saveScrollPositions() {
  ensureScrollState();

  // verticale pagina-scroll
  state.scroll.windowY = window.scrollY;

  // horizontale/verticale scroll van specifieke containers
  document.querySelectorAll("[data-scroll-key]").forEach((el) => {
    const key = el.dataset.scrollKey;
    state.scroll.containers[key] = {
      x: el.scrollLeft,
      y: el.scrollTop,
    };
  });
}

function restoreScrollPositions() {
  ensureScrollState();

  // herstel page-scroll
  window.scrollTo({ top: state.scroll.windowY || 0, behavior: "auto" });

  // herstel container scrolls
  document.querySelectorAll("[data-scroll-key]").forEach((el) => {
    const key = el.dataset.scrollKey;
    const saved = state.scroll.containers[key];
    if (saved) {
      el.scrollLeft = saved.x || 0;
      el.scrollTop = saved.y || 0;
    }
  });
}

// Handige wrapper zodat je dit niet vergeet
function withPreservedScroll(fn) {
  saveScrollPositions();
  fn?.();
  // 2 frames: 1) DOM update 2) charts/layout klaar
  requestAnimationFrame(() => requestAnimationFrame(restoreScrollPositions));
}

/* ============================================================
 * BOOT
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  ensureScrollState();

  // 1) Navigatie (bottom nav + back buttons)
  bindNavigation();

  // 2) Uploads — bindt op class .excel-upload
  bindFileUploads(".excel-upload", ({ years }) => {
    withPreservedScroll(() => {
      setupYearSelects(years);
      renderActivePage(); // render alleen de pagina die je nu ziet
    });
  });

  // 3) Dropdown toggles (open/dicht)
  bindCustomSelectToggles();

  // 4) Filters / toggles
  bindSeasonButtons();
  bindModeButtons();

  // 5) Bezetting toggles
  bindOccupancyToggles();
});

/* ============================================================
 * NAVIGATION
 * ============================================================ */

function bindNavigation() {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => navigateTo(el.dataset.nav));
  });
}

function navigateTo(pageId) {
  withPreservedScroll(() => {
    // Pages
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById(`${pageId}-page`)?.classList.add("active");

    // Bottom nav active state
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    document.getElementById(`nav-${pageId}`)?.classList.add("active");

    // Render alleen wat nodig is voor deze pagina
    renderActivePage();
  });
}

/* ============================================================
 * PAGE RENDER ROUTER
 * ============================================================ */

function getActivePageId() {
  const active = document.querySelector(".page.active");
  if (!active?.id) return "home";
  return active.id.replace("-page", "");
}

function renderActivePage() {
  if (!state.rawRows?.length) return;

  const page = getActivePageId();

  switch (page) {
    case "home":
      renderHomePage();
      break;

    case "occupancy":
      if (typeof renderBezettingCharts === "function") renderBezettingCharts();
      break;

    case "revenue":
      // (cumulatief staat nu op home)
      break;

    case "behavior":
      if (typeof renderGedragCharts === "function") renderGedragCharts();
      break;

    case "data":
      if (typeof renderDataVisCharts === "function") renderDataVisCharts();
      break;

    default:
      renderHomePage();
  }
}

function renderHomePage() {
  const kpiYear = state.kpiYear ?? "ALL";
  renderHomeKPIsForYear(kpiYear);

  renderHomeBookingCarousel(state.rawRows);
  renderHomeRevenueChart();

  const y = state.cumulativeYear ?? state.currentYear;
  if (y != null) renderHomeCumulativeRevenueChartForYear(y);
}

/* ============================================================
 * YEAR SELECTS (CUSTOM)
 * ============================================================ */

function setupYearSelects(years = getYears()) {
  // ✅ KPI dropdown (met ALL)
  wireCustomYearSelect({
    containerId: "yearSelectContainerKpi",
    displayId: "selectedYearDisplayKpi",
    optionsId: "yearOptionsKpi",
    hiddenId: "yearValueKpi",
    years: ["ALL", ...years],
    get: () => state.kpiYear ?? "ALL",
    set: (y) => (state.kpiYear = y),
    onChange: () =>
      withPreservedScroll(() => renderHomeKPIsForYear(state.kpiYear ?? "ALL")),
  });

  // ✅ HOME (Seizoensinzichten) dropdown
  wireCustomYearSelect({
    containerId: "yearSelectContainer",
    displayId: "selectedYearDisplay",
    optionsId: "yearOptions",
    hiddenId: "yearValue",
    years,
    get: () => state.currentYear,
    set: (y) => (state.currentYear = y),
    onChange: () => withPreservedScroll(renderActivePage),
  });

  // ✅ CUMULATIEF dropdown (met ALL)
  wireCustomYearSelect({
    containerId: "cumulativeYearSelectContainer",
    displayId: "cumulativeYearDisplay",
    optionsId: "cumulativeYearOptions",
    hiddenId: "cumulativeYearValue",
    years: ["ALL", ...years],
    get: () => state.cumulativeYear ?? "ALL",
    set: (y) => (state.cumulativeYear = y),
    onChange: () =>
      withPreservedScroll(() =>
        renderHomeCumulativeRevenueChartForYear(state.cumulativeYear ?? "ALL")
      ),
  });

  // ✅ OCCUPANCY dropdown (met ALL)
  wireCustomYearSelect({
    containerId: "occYearSelectContainer",
    displayId: "occSelectedYear",
    optionsId: "occYearOptions",
    hiddenId: "occYearValue",
    years: ["ALL", ...years],
    get: () => state.occupancyYear ?? "ALL",
    set: (y) => (state.occupancyYear = y),
    onChange: () => {
      if (getActivePageId() === "occupancy") withPreservedScroll(renderActivePage);
    },
  });
}

function wireCustomYearSelect({
  containerId,
  displayId,
  optionsId,
  hiddenId,
  years,
  get,
  set,
  onChange,
}) {
  const container = document.getElementById(containerId);
  const display = document.getElementById(displayId);
  const options = document.getElementById(optionsId);
  const hidden = document.getElementById(hiddenId);

  if (!container || !display || !options || !hidden) return;

  options.innerHTML = "";

  years.forEach((year) => {
    const div = document.createElement("div");
    div.className = "option";
    div.textContent = String(year);

    div.addEventListener("click", () => {
      display.textContent = String(year);
      hidden.value = String(year);
      set(year);

      options.classList.remove("show");
      container.classList.remove("open");

      onChange?.();
    });

    options.appendChild(div);
  });

  const initial = get();
  display.textContent = String(initial);
  hidden.value = String(initial);
}

/**
 * Custom select open/close.
 * Verwacht:
 * .custom-select
 *   .select-trigger
 *   .select-options
 *
 * ✅ Belangrijk: houd dus ALTIJD class "custom-select" op je dropdowns,
 * en voeg daarnaast je styling class toe (bv. "custom-select-kpi").
 */
function bindCustomSelectToggles() {
  const selectContainers = document.querySelectorAll(".custom-select");
  if (!selectContainers.length) return;

  selectContainers.forEach((container) => {
    const trigger = container.querySelector(".select-trigger");
    const options = container.querySelector(".select-options");
    if (!trigger || !options) return;

    trigger.addEventListener("click", (e) => {
      // close others
      selectContainers.forEach((c) => {
        if (c !== container) {
          c.classList.remove("open");
          c.querySelector(".select-options")?.classList.remove("show");
        }
      });

      container.classList.toggle("open");
      options.classList.toggle("show");
      e.stopPropagation();
    });
  });

  window.addEventListener("click", () => {
    document.querySelectorAll(".custom-select").forEach((c) => {
      c.classList.remove("open");
      c.querySelector(".select-options")?.classList.remove("show");
    });
  });
}

/* ============================================================
 * FILTERS / TOGGLES
 * ============================================================ */

function bindSeasonButtons() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.currentSeason = btn.dataset.season;

      if (getActivePageId() === "home") withPreservedScroll(renderHomeRevenueChart);
    });
  });
}

function bindModeButtons() {
  const gross = document.getElementById("btnGross");
  const net = document.getElementById("btnNet");
  if (!gross || !net) return;

  gross.addEventListener("click", () => {
    gross.classList.add("active");
    net.classList.remove("active");
    state.currentMode = "gross";

    if (getActivePageId() === "home") withPreservedScroll(renderHomePage);
    else withPreservedScroll(renderActivePage);
  });

  net.addEventListener("click", () => {
    net.classList.add("active");
    gross.classList.remove("active");
    state.currentMode = "net";

    if (getActivePageId() === "home") withPreservedScroll(renderHomePage);
    else withPreservedScroll(renderActivePage);
  });
}

function bindOccupancyToggles() {
  const tPlatform = document.getElementById("togglePlatform");
  const tOwner = document.getElementById("toggleOwner");

  if (tPlatform) {
    tPlatform.addEventListener("change", () => {
      state.showPlatform = !!tPlatform.checked;
      withPreservedScroll(renderActivePage);
    });
  }

  if (tOwner) {
    tOwner.addEventListener("change", () => {
      state.showOwner = !!tOwner.checked;
      withPreservedScroll(renderActivePage);
    });
  }
}
