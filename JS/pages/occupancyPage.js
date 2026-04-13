// ./JS/pages/occupancyPage.js
import { state } from "../core/app.js";
import { loadPricingYear } from "../core/dataManager.js";

export const OccupancyPage = {
  id: "occupancy",
  title: "Bezetting",
  template: () => `
    <header class="top-bar">
      <div class="header-flex">
        <div class="header-titles">
          <h1>Bezetting & Gebruik</h1>
          <p class="subtitle">Data overzichtelijk gemaakt</p>
        </div>

        <div class="topbar__controls">
          <label class="action-btn" for="fileInputOcc">
            <i class="fa-solid fa-file-import"></i>
            <input id="fileInputOcc" class="excel-upload" type="file" accept=".xlsx,.xls" hidden />
          </label>
        </div>
      </div>
    </header>

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

        <div id="occTooltip" class="occ-tooltip" style="display:none;"></div>
      </div>

      <div class="divider-horizontal"></div>

      <section class="content-section">
        <div class="chart-panel" style="padding-left: 0;">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-left: 14px;">
            <h3 class="panel-title" style="margin: 0;">Bezettingsanalyse</h3>
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
      </section>
    </div>
  `,
  init: async () => {
    // renderBezettingCharts is already available in this scope
    renderBezettingCharts();
  }
};

/**
 * Entry: render occupancy page
 */
export async function renderBezettingCharts() {
  const rawData = state.rawRows || [];
  if (state.occupancyYear == null) state.occupancyYear = "ALL";
  if (state.occupancyMonth == null) state.occupancyMonth = new Date().getMonth();
  if (state.showPlatform == null) state.showPlatform = true;
  if (state.showOwner == null) state.showOwner = true;

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

  renderCalendarCarousel(bookingsForView, yearsToRender);
  renderOccupancyTrendChart(allBookings);
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
  return rows
    .map((r) => {
      const start = parseNLDate(r.__aankomst ?? r["Aankomst"]);
      const end = parseNLDate(r.__vertrek ?? r["Vertrek"]);
      if (!start || !end) return null;

      const nights =
        Number(r["Nachten"] ?? r.__nachten ?? diffDays(start, end)) ||
        diffDays(start, end);

      const income = parseMoney(r.__gross ?? r["Inkomsten"]);
      const bookingLabel = String(r["Boeking"] ?? "").trim();
      const guest = String(r["Gast"] ?? "").trim();
      const channel = bookingLabel.includes("|")
        ? bookingLabel.split("|")[1].trim()
        : bookingLabel;

      const type = isOwnerBooking(r) ? "owner" : "platform";

      return {
        start: startOfDay(start),
        end: startOfDay(end),
        nights,
        income,
        guest,
        channel,
        bookingLabel,
        type,
        raw: r,
      };
    })
    .filter(Boolean);
}

function isOwnerBooking(r) {
  const b = String(r["Boeking"] ?? "").toLowerCase();
  const inc = String(r["Inkomsten"] ?? "").trim();
  return b.includes("huiseigenaar") || inc === "-" || inc === "" || inc === "—";
}

let occCarouselBound = false;

function renderCalendarCarousel(bookings, years) {
  const carousel = document.getElementById("occCalendarCarousel");
  const track = document.getElementById("occCalendarTrack");
  const tooltip = document.getElementById("occTooltip");
  if (!carousel || !track) return;

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

  const totalSlides = yearList.length * 12;
  if (state.occupancySlideIndex == null) {
    state.occupancySlideIndex = clamp(new Date().getMonth(), 0, totalSlides - 1);
  }
  const activeSlide = clamp(Number(state.occupancySlideIndex), 0, totalSlides - 1);
  requestAnimationFrame(() => {
    carousel.scrollLeft = carousel.clientWidth * activeSlide;
  });

  bindCarouselSyncOnce(carousel, totalSlides);
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

  days.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "occ-month-cell";
    if (day.getMonth() !== monthIdx) cell.classList.add("is-outside");
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

  const targetYear = state.occTrendYear === "ALL" ? state.currentYear : Number(state.occTrendYear);

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

  // ✅ Chronologische iteratie: Start bij de Maandag van de week die Jan 1 bevat
  let currentMonday = startOfWeekMonday(new Date(targetYear, 0, 1));
  const yearEndLimit = new Date(targetYear + 1, 0, 1);

  while (currentMonday < yearEndLimit) {
    let p = 0; let o = 0;

    // Check 7 dagen van deze week
    for (let i = 0; i < 7; i++) {
      const d = addDays(currentMonday, i);
      // Alleen tellen als de dag in het doeljaar valt
      if (d.getFullYear() === targetYear) {
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

function parseNLDate(v) {
  if (!v || (v instanceof Date && !isNaN(v))) return v;
  const s = String(v).trim();
  if (!s) return null;
  const m = s.split(" ")[0].match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseMoney(v) {
  if (typeof v === "number") return v;
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "-" || s === "—") return null;
  const cleaned = s.replaceAll("€", "").replaceAll(".", "").replaceAll(",", ".").replace(/\s+/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function euro(x) {
  try { return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(x)); }
  catch { const n = Number(x); return Number.isFinite(n) ? `€${Math.round(n * 100) / 100}` : "—"; }
}

function pad2(n) { return String(n).padStart(2, "0"); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function diffDays(a, b) {
  const A = startOfDay(a).getTime(); const B = startOfDay(b).getTime();
  return Math.max(0, Math.round((B - A) / 86400000));
}
function fmtDateNL(d) { return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; }
function startOfWeekMonday(d) {
  const x = startOfDay(d); const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(x, diff);
}
function endOfWeekSunday(d) { return addDays(startOfWeekMonday(d), 6); }
function intersectsYear(b, year) { return b.start < new Date(year + 1, 0, 1) && b.end > new Date(year, 0, 1); }
function escapeHtml(str) {
  return String(str).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function toISODateLocal(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}