import { state, setState } from "./core/app.js";
import { bindFileUploads, getYears, saveToLocalStorage, loadFromLocalStorage } from "./core/dataManager.js";
import Router from "./core/router.js";

// Import Page Modules
import { HomePage } from "./pages/homePage.js";
import { OccupancyPage } from "./pages/occupancyPage.js";
import { RevenuePage } from "./pages/revenuePage.js";
import { BehaviorPage } from "./pages/behaviorPage.js";
import { DataPage } from "./pages/dataPage.js";

import {
  renderHomeKPIsForYear,
  renderHomeBookingCarousel,
  renderHomeRevenueChart,
  renderHomeCumulativeRevenueChartForYear,
  renderBezettingCharts,
  renderGedragCharts,
  renderDataVisCharts,
} from "./components/charts/index.js";

/* ============================================================
 * ROUTER SETUP
 * ============================================================ */

const routes = [
  HomePage,
  OccupancyPage,
  RevenuePage,
  BehaviorPage,
  DataPage
];

let router;

/* ============================================================
 * SCROLL PRESERVATION
 * ============================================================ */

function ensureScrollState() {
  state.scroll ??= { windowY: 0, containers: {} };
  state.scroll.containers ??= {};
}

function saveScrollPositions() {
  ensureScrollState();
  state.scroll.windowY = window.scrollY;

  document.querySelectorAll("[data-scroll-key]").forEach((el) => {
    const key = el.dataset.scrollKey;
    state.scroll.containers[key] = { x: el.scrollLeft, y: el.scrollTop };
  });
}

function restoreScrollPositions() {
  ensureScrollState();
  window.scrollTo({ top: state.scroll.windowY || 0, behavior: "auto" });

  document.querySelectorAll("[data-scroll-key]").forEach((el) => {
    const key = el.dataset.scrollKey;
    const saved = state.scroll.containers[key];
    if (saved) {
      el.scrollLeft = saved.x || 0;
      el.scrollTop = saved.y || 0;
    }
  });
}

export function withPreservedScroll(fn) {
  saveScrollPositions();
  fn?.();
  requestAnimationFrame(() => requestAnimationFrame(restoreScrollPositions));
}

/* ============================================================
 * BOOT
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  ensureScrollState();

  // Initialiseren van de router
  router = new Router(routes, "app-content");
  router.init();

  // Global event bindings
  bindGlobalEvents();

  // Eerste data load
  const storedRows = loadFromLocalStorage();
  if (storedRows && storedRows.length) {
    setState({ rawRows: storedRows });
    const years = getYears(storedRows);
    setupYearSelects(years);
  } else {
    setupYearSelects();
  }
});

function bindGlobalEvents() {
    // We bind file uploads globally because the input can be in the header (shared)
    // or on the data page.
    bindFileUploads(".excel-upload", ({ rows, years }) => {
        saveToLocalStorage(rows);
        withPreservedScroll(() => {
          setupYearSelects(years);
          // Refresh current page logic
          if (router.currentPage && router.currentPage.init) {
              router.currentPage.init();
          }
        });
      });

      // Delegate global UI events
      document.addEventListener("click", (e) => {
          // Custom select toggles (delegated)
          const select = e.target.closest(".custom-select");
          if (select && e.target.closest(".select-trigger")) {
              toggleCustomSelect(select);
              e.stopPropagation();
          } else {
              closeAllCustomSelects();
          }
      });
}

function toggleCustomSelect(container) {
    const isOpen = container.classList.contains("open");
    closeAllCustomSelects();
    if (!isOpen) {
        container.classList.add("open");
        container.querySelector(".select-options")?.classList.add("show");
    }
}

function closeAllCustomSelects() {
    document.querySelectorAll(".custom-select").forEach((c) => {
        c.classList.remove("open");
        c.querySelector(".select-options")?.classList.remove("show");
      });
}

/* ============================================================
 * PAGE RENDERS (Exposed for Modules)
 * ============================================================ */

export function renderHomePage() {
  const kpiYear = state.kpiYear ?? "ALL";
  renderHomeKPIsForYear(kpiYear);

  renderHomeBookingCarousel(state.rawRows);
  renderHomeRevenueChart();

  const y = state.cumulativeYear ?? state.currentYear;
  if (y != null) renderHomeCumulativeRevenueChartForYear(y);

  // Bind home-specific buttons (re-binding necessary because DOM swapped)
  bindSeasonButtons();
  bindModeButtons();
}

/* ============================================================
 * SHARED COMPONENT LOGIC
 * ============================================================ */

export function setupYearSelects(years = getYears()) {
  const availableYears = years.length > 0 ? years : [state.currentYear || new Date().getFullYear()];

  wireCustomYearSelect({
    containerId: "yearSelectContainerKpi",
    displayId: "selectedYearDisplayKpi",
    optionsId: "yearOptionsKpi",
    hiddenId: "yearValueKpi",
    years: ["ALL", ...availableYears],
    get: () => state.kpiYear ?? "ALL",
    set: (y) => (state.kpiYear = y),
    onChange: () => withPreservedScroll(() => renderHomeKPIsForYear(state.kpiYear ?? "ALL")),
  });

  wireCustomYearSelect({
    containerId: "yearSelectContainer",
    displayId: "selectedYearDisplay",
    optionsId: "yearOptions",
    hiddenId: "yearValue",
    years: availableYears,
    get: () => state.currentYear,
    set: (y) => (state.currentYear = y),
    onChange: () => {
        if (router.currentPage?.id === 'home') withPreservedScroll(renderHomePage);
    },
  });

  wireCustomYearSelect({
    containerId: "cumulativeYearSelectContainer",
    displayId: "cumulativeYearDisplay",
    optionsId: "cumulativeYearOptions",
    hiddenId: "cumulativeYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.cumulativeYear ?? "ALL",
    set: (y) => (state.cumulativeYear = y),
    onChange: () =>
      withPreservedScroll(() => renderHomeCumulativeRevenueChartForYear(state.cumulativeYear ?? "ALL")),
  });

  wireCustomYearSelect({
    containerId: "occYearSelectContainer",
    displayId: "occSelectedYear",
    optionsId: "occYearOptions",
    hiddenId: "occYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.occupancyYear ?? "ALL",
    set: (y) => (state.occupancyYear = y),
    onChange: () => {
      if (router.currentPage?.id === "occupancy") withPreservedScroll(renderBezettingCharts);
    },
  });

  wireCustomYearSelect({
    containerId: "occTrendYearSelectContainer",
    displayId: "occTrendYearDisplay",
    optionsId: "occTrendYearOptions",
    hiddenId: "occTrendYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.occTrendYear ?? "ALL",
    set: (y) => (state.occTrendYear = y),
    onChange: () => {
      if (router.currentPage?.id === "occupancy") withPreservedScroll(renderBezettingCharts);
    },
  });
}

function wireCustomYearSelect({ containerId, displayId, optionsId, hiddenId, years, get, set, onChange }) {
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
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      display.textContent = String(year);
      hidden.value = String(year);
      set(year);
      container.classList.remove("open");
      options.classList.remove("show");
      onChange?.();
    });
    options.appendChild(div);
  });

  const initial = get();
  display.textContent = String(initial);
  hidden.value = String(initial);
}

function bindSeasonButtons() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.currentSeason = btn.dataset.season;
      if (router.currentPage?.id === "home") withPreservedScroll(renderHomeRevenueChart);
    };
  });
}

function bindModeButtons() {
  const gross = document.getElementById("btnGross");
  const net = document.getElementById("btnNet");
  if (!gross || !net) return;

  gross.onclick = () => {
    gross.classList.add("active");
    net.classList.remove("active");
    state.currentMode = "gross";
    if (router.currentPage?.id === "home") withPreservedScroll(renderHomePage);
  };

  net.onclick = () => {
    net.classList.add("active");
    gross.classList.remove("active");
    state.currentMode = "net";
    if (router.currentPage?.id === "home") withPreservedScroll(renderHomePage);
  };
}