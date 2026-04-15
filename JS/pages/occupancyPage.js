import { state } from "../core/app.js";
import { loadPricingYear, getYears } from "../core/dataManager.js";
import {
  withPreservedScroll,
  wireCustomYearSelect,
  euro,
  fmtDateNL,
  pad2,
  clamp,
  startOfDay,
  addDays,
  diffDays,
  startOfWeekMonday,
  endOfWeekSunday,
  intersectsYear,
  escapeHtml,
  toISODateLocal,
  CHART_COLORS
} from "../core/ui-helpers.js";

export const OccupancyPage = {
  id: "occupancy",
  title: "Bezetting",
  template: () => `
    <div class="container">
      <div class="kalender-header">
        <div class="kalender-header__left">
          <h3 class="kalender__title">Bezettingskalender</h3>
          <p class="kalender__subtitle">Swipe door de maanden</p>
        </div>

        <div class="year-select-container">
          <div class="custom-select custom-select-calender" id="occYearSelectContainer">
            <div class="select-trigger">
              <span id="occSelectedYear"></span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="select-options" id="occYearOptions"></div>
            <input type="hidden" id="occYearValue" value="">
          </div>
        </div>
      </div>

      <div class="panel">
        <div id="occCalendarCarousel" class="occ-carousel booking-carousel">
          <div id="occCalendarTrack" class="booking-carousel__track"></div>
        </div>

        <div class="occ-legend">
          <div class="occ-legend__item">
            <span class="dot dot-platform"></span>
            <span>Platform</span>
          </div>
          <div class="occ-legend__item">
            <span class="dot dot-owner"></span>
            <span>Eigen gebruik</span>
          </div>
        </div>
      </div>

      <div class="divider-horizontal"></div>

      <section class="content-section">
        <div class="chart-panel" style="padding-left: 0;">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-left: 14px;">
            <h3 class="panel-title" style="margin: 0;">Bezettingsanalyse (Week)</h3>
            <div class="year-select-container">
              <div class="custom-select custom-select-trend" id="occTrendYearSelectContainer">
                <div class="select-trigger">
                  <span id="occTrendYearDisplay">—</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </div>
                <div class="select-options" id="occTrendYearOptions"></div>
                <input type="hidden" id="occTrendYearValue" value="">
              </div>
            </div>
          </div>

          <div class="panel__body">
            <div class="chart-scroll" id="occTrendScrollWrapper">
              <div class="cum-y-axis" id="occTrendYAxis"></div>
              <div class="chart-scroll__inner" id="occTrendScrollInner">
                <canvas id="chartOccupancyTrend"></canvas>
              </div>
            </div>

            <div class="hint" style="margin-top: 15px;">
              <span class="hint-text">Scroll horizontaal voor details per week</span>
            </div>

            <div class="occ-legend" style="margin-top: 20px;">
              <div class="occ-legend__item">
                <span class="dot dot-platform"></span>
                <span>Bezet</span>
              </div>
              <div class="occ-legend__item">
                <span class="dot dot-owner"></span>
                <span>Eigen gebruik</span>
              </div>
              <div class="occ-legend__item">
                <span class="dot dot-free"></span>
                <span>Vrij</span>
              </div>
            </div>
          </div>
        </div>

        <div class="dashboard-grid-2">
          <div class="chart-panel">
          <div class="panel-header">
            <h3 class="panel-title">Bezettingsgraad per maand</h3>
            <div class="year-select-container">
              <div class="custom-select custom-select-trend" id="occMonthlyYearSelectContainer">
                <div class="select-trigger">
                  <span id="occMonthlyYearDisplay">—</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </div>
                <div class="select-options" id="occMonthlyYearOptions"></div>
                <input type="hidden" id="occMonthlyYearValue" value="">
              </div>
            </div>
          </div>

          <div class="panel__body">
            <div class="chart-container" style="height: 300px;">
              <canvas id="chartOccupancyMonthly"></canvas>
            </div>

            <div class="color-scale-legend" style="margin-top: 30px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: var(--text-muted); font-weight: 500;">
                <span>0% Bezetting</span>
                <span>100% Bezetting</span>
              </div>
              <div id="occLegendBar" style="height: 30px; width: 100%; border-radius: 8px; background: linear-gradient(to right, hsl(0, 100%, 50%) 0%, hsl(0, 100%, 50%) 20%, hsl(60, 100%, 50%) 60%, hsl(120, 100%, 50%) 100%); cursor: crosshair; position: relative;">
                <div id="occLegendMarker" style="position: absolute; top: 0; bottom: 0; width: 2px; background: white; display: none; pointer-events: none; box-shadow: 0 0 10px rgba(0,0,0,0.5); z-index: 5;">
                   <div id="occLegendLabel" style="position: absolute; top: -35px; left: 50%; transform: translateX(-50%); background: #1a1a1a; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; white-space: nowrap; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>
                </div>
              </div>
              <div style="margin-top: 15px; font-size: 11px; color: var(--text-muted); opacity: 0.7; text-align: center;">
                Lage bezetting (< 20%) behoeft extra marketing of prijsaanpassingen
              </div>
            </div>
          </div>
        </div>

        <div class="chart-panel">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h3 class="panel-title">Lengte van verblijf</h3>
            <div class="toggle-group" id="losToggleGroup">
              <button class="toggle-btn active" data-mode="count">Aantal</button>
              <button class="toggle-btn" data-mode="percent">%</button>
            </div>
          </div>
          <div class="panel__body">
            <div class="chart-container" style="height: 300px;">
              <canvas id="chartOccupancyLOS"></canvas>
            </div>
            <div class="occ-legend" style="margin-top: 20px; justify-content: center; gap: 20px;">
              <div class="occ-legend__item"><span class="dot" style="background:#3b82f6"></span><span>Regulier</span></div>
              <div class="occ-legend__item"><span class="dot" style="background:#f59e0b"></span><span>Populairst</span></div>
            </div>
          </div>
          </div>
        </div>
      </div>
      </section>
    </div>
  `,
  init: async () => {
    await renderBezettingCharts();
    setupOccupancyYearSelects();
    setupOccupancyLegendHover();
    setupLOSToggles();
  }
};

/**
 * Setup year selects specifically for the Occupancy page
 */
function setupOccupancyYearSelects() {
  const years = getYears();
  const availableYears = years.length > 0 ? years : [state.currentYear || new Date().getFullYear()];

  wireCustomYearSelect({
    containerId: "occYearSelectContainer",
    displayId: "occSelectedYear",
    optionsId: "occYearOptions",
    hiddenId: "occYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.occupancyYear ?? "ALL",
    set: (y) => (state.occupancyYear = y),
    onChange: () => withPreservedScroll(renderBezettingCharts),
  });

  wireCustomYearSelect({
    containerId: "occTrendYearSelectContainer",
    displayId: "occTrendYearDisplay",
    optionsId: "occTrendYearOptions",
    hiddenId: "occTrendYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.occTrendYear ?? "ALL",
    set: (y) => (state.occTrendYear = y),
    onChange: () => withPreservedScroll(renderBezettingCharts),
  });

  wireCustomYearSelect({
    containerId: "occMonthlyYearSelectContainer",
    displayId: "occMonthlyYearDisplay",
    optionsId: "occMonthlyYearOptions",
    hiddenId: "occMonthlyYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.occMonthlyYear ?? "ALL",
    set: (y) => (state.occMonthlyYear = y),
    onChange: () => withPreservedScroll(renderBezettingCharts),
  });
}

export async function renderBezettingCharts() {
  const rawData = state.rawRows || [];
  if (state.occupancyYear == null) state.occupancyYear = state.currentYear || new Date().getFullYear();
  if (state.occTrendYear == null) state.occTrendYear = "ALL";
  if (state.occMonthlyYear == null) state.occMonthlyYear = "ALL";
  if (state.occupancyMonth == null) state.occupancyMonth = new Date().getMonth();
  if (state.showPlatform == null) state.showPlatform = true;
  if (state.showOwner == null) state.showOwner = true;
  if (state.losMode == null) state.losMode = "count";

  // Reset sticky tooltip state on every page render
  isTooltipSticky = false;
  const existingTooltip = document.getElementById("occTooltip");
  if (existingTooltip) existingTooltip.style.display = "none";

  const allBookings = normalizeBookings(rawData);

  let yearsToRender;
  if (state.occupancyYear === "ALL") {
    const foundYears = new Set(
      allBookings.flatMap((b) => [b.start.getFullYear(), b.end.getFullYear()])
    );
    if (foundYears.size === 0) {
      yearsToRender = [state.currentYear || new Date().getFullYear()];
    } else {
      yearsToRender = Array.from(foundYears).sort((a, b) => a - b);
    }
  } else {
    yearsToRender = [Number(state.occupancyYear)];
  }

  const bookingsForView = allBookings.filter((b) =>
    yearsToRender.some((y) => intersectsYear(b, y))
  );

  await preloadPricingForYears(yearsToRender);

  if (bookingsForView.length === 0 && rawData.length > 0) {
    const track = document.getElementById("occCalendarTrack");
    if (track) {
      track.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-calendar-xmark" style="font-size: 48px; margin-bottom: 20px; opacity: 0.3;"></i>
          <p>Geen boekingen gevonden voor het jaar ${state.occupancyYear}.</p>
          <small>Probeer een ander jaar te selecteren of controleer de data op de Data-pagina.</small>
        </div>
      `;
    }
    return;
  }

  renderCalendarCarousel(bookingsForView, yearsToRender);
  renderOccupancyTrendChart(allBookings);
  renderMonthlyOccupancyChart(allBookings);
  renderLengthOfStayChart(allBookings);
}

const pricingCache = new Map();

async function preloadPricingForYears(yearList) {
  const years = Array.isArray(yearList) ? yearList : [Number(yearList)];
  const jobs = years.map(async (y) => {
    if (!Number.isFinite(Number(y))) return;
    const year = Number(y);
    if (pricingCache.has(year)) return;
    try {
      const rows = await loadPricingYear(year);
      const map = new Map(rows.map((r) => [String(r.datum), r]));
      pricingCache.set(year, map);
    } catch (err) {
      console.warn(`Pricing ontbreekt of faalt voor jaar ${year}`, err);
      pricingCache.set(year, new Map());
    }
  });
  await Promise.all(jobs);
}

function getPricingByISO(iso) {
  if (!iso) return null;
  const year = Number(String(iso).slice(0, 4));
  const map = pricingCache.get(year);
  if (!map) return null;
  return map.get(iso) ?? null;
}

function normalizeBookings(rows) {
  return rows.map((r) => ({
    start: startOfDay(r.__aankomst),
    end: startOfDay(r.__vertrek),
    nights: r.__nights,
    income: r.__gross,
    guest: r.__guest,
    channel: (r.__bookingRaw || "").includes("|")
      ? r.__bookingRaw.split("|")[1].trim()
      : (r.__bookingRaw || ""),
    bookingLabel: (r.__bookingRaw || ""),
    type: r.__owner ? "owner" : "platform",
    raw: r,
  })).filter(b => b.start && b.end);
}

function isOwnerBooking(r) {
  return r.__owner;
}

let occCarouselBound = false;

function renderCalendarCarousel(bookings, years) {
  const carousel = document.getElementById("occCalendarCarousel");
  const track = document.getElementById("occCalendarTrack");
  if (!carousel || !track) return;

  // Inject tooltip into body so position:fixed works regardless of page transforms
  let tooltip = document.getElementById("occTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "occTooltip";
    tooltip.className = "occ-tooltip";
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);
  }

  const showPlatform = !!state.showPlatform;
  const showOwner = !!state.showOwner;

  const filtered = bookings.filter((b) => {
    if (b.type === "platform" && !showPlatform) return false;
    if (b.type === "owner" && !showOwner) return false;
    return true;
  });

  track.innerHTML = "";
  const yearList = Array.isArray(years) ? [...years] : [Number(years)];
  yearList.sort((a, b) => a - b);

  let slideIndex = 0;
  yearList.forEach((year) => {
    for (let m = 0; m < 12; m++) {
      const slide = document.createElement("div");
      slide.className = "occ-month-slide";
      slide.dataset.slideIndex = String(slideIndex);

      const card = document.createElement("div");
      card.className = "occ-month-card";

      const nav = document.createElement("div");
      nav.className = "occ-card-nav";
      nav.innerHTML = `
        <button class="occ-nav-btn" data-dir="-1" aria-label="Vorige maand">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <button class="occ-nav-btn" data-dir="1" aria-label="Volgende maand">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      `;
      card.appendChild(nav);

      nav.querySelectorAll(".occ-nav-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault(); e.stopPropagation();
          const dir = Number(btn.dataset.dir || "0");
          const totalSlides = yearList.length * 12;
          const cur = clamp(Number(state.occupancySlideIndex ?? 0), 0, totalSlides - 1);
          const next = clamp(cur + dir, 0, totalSlides - 1);
          state.occupancySlideIndex = next;
          carousel.scrollTo({ left: carousel.clientWidth * next, behavior: "smooth" });
        });
      });

      const title = document.createElement("div");
      title.className = "occ-month-title";
      title.textContent = new Date(year, m, 1).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

      const grid = document.createElement("div");
      grid.className = "occ-month-grid";
      grid.dataset.year = String(year);
      grid.dataset.month = String(m);

      card.appendChild(title);
      card.appendChild(grid);
      slide.appendChild(card);
      track.appendChild(slide);

      renderSingleMonthGrid(grid, filtered, year, m, tooltip);
      slideIndex++;
    }
  });

  const isDesktop = window.innerWidth >= 1024;
  if (!isDesktop) {
    const totalSlides = yearList.length * 12;
    if (state.occupancySlideIndex == null) {
      state.occupancySlideIndex = clamp(new Date().getMonth(), 0, totalSlides - 1);
    }
    const activeSlide = clamp(Number(state.occupancySlideIndex), 0, totalSlides - 1);
    requestAnimationFrame(() => {
      carousel.scrollLeft = carousel.clientWidth * activeSlide;
    });
    bindCarouselSyncOnce(carousel, totalSlides);
  }
  carousel.addEventListener("scroll", () => hideTooltip(tooltip, true), { passive: true });
}

function renderSingleMonthGrid(gridEl, bookings, year, monthIdx, tooltip) {
  gridEl.innerHTML = "";
  const dows = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"];
  dows.forEach((t) => {
    const el = document.createElement("div"); el.className = "occ-month-dow"; el.textContent = t;
    gridEl.appendChild(el);
  });

  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd = new Date(year, monthIdx + 1, 1);
  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = endOfWeekSunday(addDays(monthEnd, -1));

  const days = [];
  for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) days.push(new Date(d));

  const cellByKey = new Map();
  const gridStartDay = startOfDay(gridStart);
  const gridEndEx = addDays(startOfDay(gridEnd), 1);
  const visibleBookings = bookings.filter((b) => b.start < gridEndEx && b.end > gridStartDay);

  const primaryBookingMap = new Map();
  visibleBookings.forEach((b) => {
    let curr = b.start < gridStartDay ? new Date(gridStartDay) : new Date(b.start);
    const end = b.end > gridEndEx ? new Date(gridEndEx) : new Date(b.end);
    while (curr < end) {
      primaryBookingMap.set(toISODateLocal(curr), b);
      curr.setDate(curr.getDate() + 1);
    }
  });

  const today = startOfDay(new Date());

  days.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "occ-month-cell";
    if (day.getMonth() !== monthIdx) cell.classList.add("is-outside");
    if (startOfDay(day) < today) cell.classList.add("is-past");
    const dayLabel = document.createElement("div");
    dayLabel.className = "occ-month-day"; dayLabel.textContent = String(day.getDate());
    cell.appendChild(dayLabel);
    const iso = toISODateLocal(day);
    const bookingOnThisDay = primaryBookingMap.get(iso);
    if (tooltip) {
      cell.addEventListener("mouseenter", (e) => {
        if (bookingOnThisDay) showBookingTooltip(e, bookingOnThisDay, iso, tooltip);
        else showDayTooltip(e, day, tooltip);
      });
      cell.addEventListener("mousemove", (e) => moveTooltip(e, tooltip));
      cell.addEventListener("mouseleave", () => hideTooltip(tooltip));
      cell.addEventListener("click", (e) => {
        e.stopPropagation();
        if (bookingOnThisDay) showBookingTooltip(e, bookingOnThisDay, iso, tooltip, true);
        else showDayTooltip(e, day, tooltip, true);
      });
    }
    gridEl.appendChild(cell);
    cellByKey.set(iso, cell);
  });

  function addFill(cell, kind, type, booking, dayISO) {
    if (!cell) return;
    const div = document.createElement("div");
    div.className = `occ-fill ${kind} ${type}`;
    div.style.pointerEvents = "auto";
    div.addEventListener("mouseenter", (e) => showBookingTooltip(e, booking, dayISO, tooltip));
    div.addEventListener("mousemove", (e) => moveTooltip(e, tooltip));
    div.addEventListener("mouseleave", () => hideTooltip(tooltip));
    div.addEventListener("click", (e) => { e.stopPropagation(); showBookingTooltip(e, booking, dayISO, tooltip, true); });
    cell.insertBefore(div, cell.firstChild);
  }

  visibleBookings.forEach((b) => {
    const typeClass = b.type === "owner" ? "owner" : "platform";
    const s = b.start < gridStartDay ? gridStartDay : b.start;
    const e = b.end > gridEndEx ? gridEndEx : b.end;
    if (e <= s) return;
    addFill(cellByKey.get(toISODateLocal(s)), "half-right", typeClass, b, toISODateLocal(s));
    addFill(cellByKey.get(toISODateLocal(e)), "half-left", typeClass, b, toISODateLocal(e));
    const nights = diffDays(s, e);
    for (let i = 1; i < nights; i++) {
      const d = addDays(s, i);
      addFill(cellByKey.get(toISODateLocal(d)), "full", typeClass, b, toISODateLocal(d));
    }
  });

  if (tooltip) document.addEventListener("click", () => hideTooltip(tooltip), { once: true });
}

function bindCarouselSyncOnce(carousel, totalSlides) {
  if (occCarouselBound) return;
  occCarouselBound = true;
  carousel.addEventListener("scroll", () => {
    const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
    state.occupancySlideIndex = clamp(idx, 0, (totalSlides ?? 12) - 1);
  }, { passive: true });
}

let isTooltipSticky = false;
function showBookingTooltip(e, b, dayISO, tooltipEl, forceSticky = false) { renderUnifiedTooltip(e, tooltipEl, b, dayISO, forceSticky); }
function showDayTooltip(e, dayDate, tooltipEl, forceSticky = false) { renderUnifiedTooltip(e, tooltipEl, null, toISODateLocal(dayDate), forceSticky); }

function renderUnifiedTooltip(e, tooltipEl, booking, dayISO, forceSticky = false) {
  if (!tooltipEl) return;
  if (isTooltipSticky && !forceSticky) return;
  if (forceSticky) isTooltipSticky = true;
  const p = getPricingByISO(dayISO);
  const title = booking ? escapeHtml(booking.guest || "Onbekende gast") : "Nog beschikbaar";
  let line2 = "";
  if (booking) {
    const startStr = booking.start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    const endStr = booking.end.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
    line2 = `<div class="tt-line-meta">${startStr}–${endStr} · ${booking.nights}n</div>`;
  }
  let line3 = "";
  if (booking && booking.income != null) {
    line3 = `<div class="tt-line-rent">Huur: ${euro(booking.income)}</div>`;
  }
  let line4 = "";
  if (p) {
    const dayP = p.dagprijs ?? p.day_price ?? p.dayPrice;
    const weekP = p.weekprijs ?? p.week_price ?? p.weekPrice;
    line4 = `<div class="tt-line-pricing">Dag: ${dayP != null ? euro(dayP) : "—"} · Week: ${weekP != null ? euro(weekP) : "—"}</div>`;
  } else {
    line4 = `<div class="tt-line-pricing opacity-50">Geen prijsdata beschikbaar</div>`;
  }

  tooltipEl.innerHTML = `
    <div class="tooltip-content ${isTooltipSticky ? "is-sticky" : ""}">
      <div class="tt-line-title">${title}</div>
      ${line2} ${line3} ${line4}
      <div class="tooltip-hint">${fmtDateNL(new Date(dayISO))}</div>
    </div>
  `;
  tooltipEl.style.display = "block";
  moveTooltip(e, tooltipEl, true);
}

function moveTooltip(e, tooltipEl, force = false) {
  if (!tooltipEl || (isTooltipSticky && !force)) return;
  tooltipEl.style.left = ""; tooltipEl.style.top = "";
}

function hideTooltip(tooltipEl, force = false) {
  if (!tooltipEl || (isTooltipSticky && !force)) return;
  if (force) isTooltipSticky = false;
  tooltipEl.style.display = "none";
}

document.addEventListener("click", () => {
  const tt = document.getElementById("occTooltip");
  if (tt) hideTooltip(tt, true);
});

/* =========================================================
   OCCUPANCY TREND CHART (WEEKLY STACKED)
   ========================================================= */

function renderOccupancyTrendChart(allBookings) {
  const canvas = document.getElementById("chartOccupancyTrend");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let startYear, endYear;
  if (state.occTrendYear === "ALL") {
    const years = allBookings.flatMap(b => [b.start.getFullYear(), b.end.getFullYear()]);
    startYear = years.length > 0 ? Math.min(...years) : state.currentYear;
    endYear = years.length > 0 ? Math.max(...years) : state.currentYear;
  } else {
    startYear = Number(state.occTrendYear);
    endYear = startYear;
  }

  // ISO Week Helper
  function getISOWeekInfo(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Move to Thursday
    const isoYear = d.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: isoYear, week: weekNum };
  }

  // ✅ Pre-map bookings by day for performance
  const dayTypeMap = new Map(); // ISO -> "platform" | "owner"
  allBookings.forEach(b => {
    let curr = new Date(b.start);
    while (curr < b.end) {
      const iso = toISODateLocal(curr);
      dayTypeMap.set(iso, b.type === "owner" ? "owner" : "platform");
      curr.setDate(curr.getDate() + 1);
    }
  });

  const labels = [];
  const platformNights = [];
  const ownerNights = [];
  const freeNights = [];

  // ✅ Chronologische iteratie: Start bij de Maandag van de week die Jan 1 van het startjaar bevat
  let currentMonday = startOfWeekMonday(new Date(startYear, 0, 1));
  const dateLimit = new Date(endYear + 1, 0, 1);

  while (currentMonday < dateLimit) {
    let p = 0; let o = 0;

    // Check 7 dagen van deze week
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentMonday, i);
      // Alleen tellen als de dag binnen ons bereik valt
      if (d.getFullYear() >= startYear && d.getFullYear() <= endYear) {
        const type = dayTypeMap.get(toISODateLocal(d));
        if (type === "owner") o++;
        else if (type === "platform") p++;
      }
    }

    const info = getISOWeekInfo(currentMonday);
    labels.push(`${info.year}-W${String(info.week).padStart(2, "0")}`);
    platformNights.push(p);
    ownerNights.push(o);
    freeNights.push(Math.max(0, 7 - (p + o)));

    currentMonday = addDays(currentMonday, 7);
  }

  if (state.charts.occTrend) state.charts.occTrend.destroy();

  setOccTrendChartWidth(labels.length);

  state.charts.occTrend = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        { label: "Bezet (nachten)", data: platformNights, backgroundColor: "#3b82f6", stack: "total" },
        { label: "Eigen gebruik (nachten)", data: ownerNights, backgroundColor: "#f59e0b", stack: "total" },
        { label: "Vrij (nachten)", data: freeNights, backgroundColor: "rgba(255, 255, 255, 0.05)", borderColor: "rgba(255, 255, 255, 0.1)", borderWidth: 1, stack: "total" }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: "rgba(255,255,255,0.5)", maxRotation: 45, minRotation: 45, autoSkip: false }
        },
        y: {
          stacked: true, beginAtZero: true, max: 7, grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { display: false }, border: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: { mode: "index", intersect: false, callbacks: { title: (items) => `Week: ${items[0].label}`, label: (item) => `${item.dataset.label}: ${item.raw} / 7` } }
      }
    }
  });

  requestAnimationFrame(() => renderOccTrendStickyYAxisLabels(state.charts.occTrend));
}

function setOccTrendChartWidth(weeksCount) {
  const inner = document.getElementById("occTrendScrollInner");
  if (!inner) return;
  inner.style.minWidth = Math.max(800, weeksCount * 25) + "px";
}

function renderOccTrendStickyYAxisLabels(chart) {
  const wrap = document.getElementById("occTrendYAxis");
  if (!wrap || !chart?.scales?.y) return;

  const { top, bottom } = chart.chartArea;
  const canvasHeight = chart.height;

  // Stel de padding in zodat de labels precies tussen top en bottom vallen
  wrap.style.paddingTop = `${top}px`;
  wrap.style.paddingBottom = `${canvasHeight - bottom}px`;
  wrap.style.height = `${canvasHeight}px`;

  const ticks = [...(chart.scales.y.ticks || [])].reverse();
  wrap.innerHTML = "";
  ticks.forEach((t) => {
    if (Number.isInteger(Number(t.value))) {
      const span = document.createElement("span");
      span.textContent = t.label || String(t.value);
      wrap.appendChild(span);
    }
  });
}

/**
 * Render the Monthly Occupancy Rate chart
 */
function renderMonthlyOccupancyChart(allBookings) {
  const canvas = document.getElementById("chartOccupancyMonthly");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const months = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  const yearsToProcess = [];
  if (state.occMonthlyYear === "ALL") {
    const foundYears = new Set(allBookings.flatMap(b => [b.start.getFullYear(), b.end.getFullYear()]));
    if (foundYears.size > 0) yearsToProcess.push(...Array.from(foundYears).sort((a, b) => a - b));
    else yearsToProcess.push(state.currentYear);
  } else {
    yearsToProcess.push(Number(state.occMonthlyYear));
  }

  // Calculate booked and total nights per month across all target years
  const bookedNightsPerMonth = new Array(12).fill(0);
  const totalNightsPerMonth = new Array(12).fill(0);

  yearsToProcess.forEach(year => {
    // Pre-calculate total nights in each month for this year
    for (let m = 0; m < 12; m++) {
      totalNightsPerMonth[m] += new Date(year, m + 1, 0).getDate();
    }

    // Filter bookings for this specific year
    const dayTypeMap = new Map();
    allBookings.forEach(b => {
      let curr = new Date(b.start);
      while (curr < b.end) {
        if (curr.getFullYear() === year) {
          const iso = toISODateLocal(curr);
          dayTypeMap.set(iso, b.type === "owner" ? "owner" : "platform");
        }
        curr.setDate(curr.getDate() + 1);
      }
    });

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, m, d);
        const iso = toISODateLocal(date);
        if (dayTypeMap.has(iso)) {
          bookedNightsPerMonth[m]++;
        }
      }
    }
  });

  const percentages = bookedNightsPerMonth.map((booked, i) => {
    const total = totalNightsPerMonth[i];
    return total > 0 ? Math.round((booked / total) * 100) : 0;
  });

  // Visually clamp bars to minimum 5% height
  const displayPercentages = percentages.map(v => Math.max(5, v));

  if (state.charts.occMonthly) state.charts.occMonthly.destroy();

  state.charts.occMonthly = new Chart(ctx, {
    type: "bar",
    data: {
      labels: months,
      datasets: [{
        label: "Bezettingsgraad (%)",
        data: displayPercentages,
        actualPercentages: percentages,
        backgroundColor: (ctx) => {
          const mIdx = ctx.dataIndex;
          const actualVal = ctx.dataset.actualPercentages ? ctx.dataset.actualPercentages[mIdx] : ctx.raw;
          let hue;
          if (actualVal < 20) {
            hue = 0; // Pure Red
          } else {
            hue = Math.round(((actualVal - 20) / 80) * 120);
          }
          return `hsl(${hue}, 100%, 50%)`;
        },
        borderRadius: 8,
        borderWidth: 0,
        maxBarThickness: 48,
        barPercentage: 0.85,
        categoryPercentage: 0.9
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "rgba(255,255,255,0.6)", font: { size: 12 } }
        },
        y: {
          beginAtZero: true,
          max: 100,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "rgba(255,255,255,0.6)",
            callback: (v) => v + "%",
            stepSize: 20
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const mIdx = item.dataIndex;
              // Show true percentage in hover
              const actual = item.dataset.actualPercentages[mIdx];
              return `Bezetting: ${actual}% (${bookedNightsPerMonth[mIdx]}/${totalNightsPerMonth[mIdx]} nachten)`;
            }
          }
        }
      }
    }
  });
}

/**
 * Setup hover interaction for the occupancy legend color bar
 */
function setupOccupancyLegendHover() {
  const bar = document.getElementById('occLegendBar');
  const marker = document.getElementById('occLegendMarker');
  const label = document.getElementById('occLegendLabel');
  if (!bar || !marker || !label) return;

  bar.addEventListener('mousemove', (e) => {
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const p = Math.max(0, Math.min(100, Math.round((x / rect.width) * 100)));

    marker.style.display = 'block';
    marker.style.left = `${x}px`;
    label.textContent = `${p}%`;
  });

  bar.addEventListener('mouseleave', () => {
    marker.style.display = 'none';
  });
}

/**
 * Setup toggles for the LOS chart
 */
function setupLOSToggles() {
  const container = document.getElementById("losToggleGroup");
  if (!container) return;
  
  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-btn");
    if (!btn) return;
    
    container.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    
    state.losMode = btn.dataset.mode;
    
    // Rerender specifically the LOS chart
    const rawData = state.rawRows || [];
    renderLengthOfStayChart(normalizeBookings(rawData));
  });
}

/**
 * Render the Length of Stay histogram
 */
function renderLengthOfStayChart(allBookings) {
  const canvas = document.getElementById("chartOccupancyLOS");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const durationMap = {};
  allBookings.forEach(b => {
    const n = b.nights;
    if (n > 0) durationMap[n] = (durationMap[n] || 0) + 1;
  });

  // Collect unique nights, sort ascending, take top N or reasonable range
  const sortedNights = Object.keys(durationMap).map(Number).sort((a, b) => a - b).slice(0, 15);
  const binLabels = sortedNights.map(n => n + "n");
  const binCounts = sortedNights.map(n => durationMap[n]);
  
  // Calculate revenue per night count for tooltips
  const binRevenue = sortedNights.map(n => {
    return allBookings
      .filter(b => b.nights === n)
      .reduce((sum, b) => sum + (b.income || 0), 0);
  });

  const totalBookings = allBookings.length;
  const percentages = binCounts.map(c => totalBookings > 0 ? (c / totalBookings) * 100 : 0);
  const mostCommonIdx = binCounts.indexOf(Math.max(...binCounts));
  const dataToDisplay = state.losMode === "percent" ? percentages : binCounts;

  if (state.charts.occLOS) state.charts.occLOS.destroy();

  state.charts.occLOS = new Chart(ctx, {
    type: "bar",
    data: {
      labels: binLabels,
      datasets: [{
        label: state.losMode === "percent" ? "Percentage (%)" : "Aantal boekingen",
        data: dataToDisplay,
        backgroundColor: (context) => {
          const idx = context.dataIndex;
          if (idx === mostCommonIdx && binCounts[idx] > 0) return "#f59e0b"; // Populairst highlight
          return "#3b82f6"; // Alle andere bars blauw
        },
        borderRadius: 8,
        maxBarThickness: 48,
        barPercentage: 0.85,
        categoryPercentage: 0.9
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { 
          grid: { display: false },
          ticks: { color: "rgba(255,255,255,0.6)", font: { size: 12 } },
          title: { display: true, text: "Nachten", color: "rgba(255,255,255,0.4)", font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { 
            color: "rgba(255,255,255,0.6)",
            callback: (v) => state.losMode === "percent" ? v + "%" : v
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a",
          titleColor: "#fff",
          bodyColor: "rgba(255,255,255,0.8)",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => {
              const label = items[0].label;
              return `${label} verblijf`;
            },
            label: (item) => {
              const idx = item.dataIndex;
              const count = binCounts[idx];
              const pct = percentages[idx].toFixed(1);
              const avgRev = count > 0 ? (binRevenue[idx] / count) : 0;
              
              const lines = [
                `Aantal: ${count} boekingen`,
                `Aandeel: ${pct}%`
              ];
              if (avgRev > 0) lines.push(`Gem. Omzet: ${euro(avgRev)}`);
              return lines;
            }
          }
        }
      }
    }
  });
}
