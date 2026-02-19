// ./JS/ui.js
import { state } from "./state.js";
import { bindFileUploads, getYears } from "./data.js";

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

function withPreservedScroll(fn) {
  saveScrollPositions();
  fn?.();
  requestAnimationFrame(() => requestAnimationFrame(restoreScrollPositions));
}

/* ============================================================
 * BOOT
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  ensureScrollState();

  bindNavigation();

  bindFileUploads(".excel-upload", ({ years }) => {
    withPreservedScroll(() => {
      setupYearSelects(years);
      renderActivePage();
    });
  });

  bindCustomSelectToggles();
  bindSeasonButtons();
  bindModeButtons();
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
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById(`${pageId}-page`)?.classList.add("active");

    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    document.getElementById(`nav-${pageId}`)?.classList.add("active");

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
    case "behavior":
      if (typeof renderGedragCharts === "function") renderGedragCharts();
      break;
    case "data":
      if (typeof renderDataVisCharts === "function") renderDataVisCharts();
      break;
    case "revenue":
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
  wireCustomYearSelect({
    containerId: "yearSelectContainerKpi",
    displayId: "selectedYearDisplayKpi",
    optionsId: "yearOptionsKpi",
    hiddenId: "yearValueKpi",
    years: ["ALL", ...years],
    get: () => state.kpiYear ?? "ALL",
    set: (y) => (state.kpiYear = y),
    onChange: () => withPreservedScroll(() => renderHomeKPIsForYear(state.kpiYear ?? "ALL")),
  });

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

  wireCustomYearSelect({
    containerId: "cumulativeYearSelectContainer",
    displayId: "cumulativeYearDisplay",
    optionsId: "cumulativeYearOptions",
    hiddenId: "cumulativeYearValue",
    years: ["ALL", ...years],
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
    years: ["ALL", ...years],
    get: () => state.occupancyYear ?? "ALL",
    set: (y) => (state.occupancyYear = y),
    onChange: () => {
      if (getActivePageId() === "occupancy") withPreservedScroll(renderActivePage);
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
 * Custom select open/close
 * BELANGRIJK: dropdowns moeten class "custom-select" blijven houden.
 */
function bindCustomSelectToggles() {
  const selectContainers = document.querySelectorAll(".custom-select");
  if (!selectContainers.length) return;

  selectContainers.forEach((container) => {
    const trigger = container.querySelector(".select-trigger");
    const options = container.querySelector(".select-options");
    if (!trigger || !options) return;

    trigger.addEventListener("click", (e) => {
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