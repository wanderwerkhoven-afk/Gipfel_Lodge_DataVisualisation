// ./JS/pages/occupancyPage.js
import { state } from "../core/app.js";
import { loadPricingYear } from "../core/dataManager.js";

/**
 * Entry: render occupancy page
 * - Year dropdown is handled in ui.js via wireCustomYearSelect()
 * - Here we only read state.occupancyYear ("ALL" or "2026") and render charts
 *
 * Pricing:
 * - JSON files expected at: /JSON/pricing_2026.json, /JSON/pricing_2027.json, ...
 * - We cache per year so "ALL" works across multiple years.
 */
export async function renderBezettingCharts() {
  // We halen de "if (!state.rawRows || !state.rawRows.length) return;" weg zodat we een lege kalender kunnen tonen.
  const rawData = state.rawRows || [];

  // defaults
  if (state.occupancyYear == null) state.occupancyYear = "ALL";
  if (state.occupancyMonth == null) state.occupancyMonth = new Date().getMonth();
  if (state.showPlatform == null) state.showPlatform = true;
  if (state.showOwner == null) state.showOwner = true;

  const allBookings = normalizeBookings(rawData);

  // Welke jaren tonen we in de kalender
  let yearsToRender;
  if (state.occupancyYear === "ALL") {
    const foundYears = new Set(
      allBookings.flatMap((b) => [b.start.getFullYear(), b.end.getFullYear()])
    );

    // Als er geen boekingen zijn, toon dan minimaal het huidige jaar
    if (foundYears.size === 0) {
      yearsToRender = [state.currentYear || new Date().getFullYear()];
    } else {
      yearsToRender = Array.from(foundYears).sort((a, b) => a - b);
    }
  } else {
    yearsToRender = [Number(state.occupancyYear)];
  }

  // Boekingen die in die jaren vallen
  const bookingsForView = allBookings.filter((b) =>
    yearsToRender.some((y) => intersectsYear(b, y))
  );

  // ✅ Preload pricing (per year) zodat tooltip meteen prijzen kan tonen
  await preloadPricingForYears(yearsToRender);

  // Render
  renderCalendarCarousel(bookingsForView, yearsToRender);
}

/* =========================================================
   Pricing cache (per year)
   ========================================================= */

const pricingCache = new Map(); // year -> Map(dateISO -> pricingRecord)

async function preloadPricingForYears(yearList) {
  const years = Array.isArray(yearList) ? yearList : [Number(yearList)];
  const jobs = years.map(async (y) => {
    if (!Number.isFinite(Number(y))) return;

    const year = Number(y);
    if (pricingCache.has(year)) return;

    try {
      const rows = await loadPricingYear(year); // fetch /JSON/pricing_${year}.json
      const map = new Map(rows.map((r) => [String(r.datum), r]));
      pricingCache.set(year, map);
    } catch (err) {
      console.warn(`Pricing ontbreekt of faalt voor jaar ${year}`, err);
      pricingCache.set(year, new Map()); // lege map zodat we niet blijven refetchen
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

/* =========================================================
   Booking normalization
   ========================================================= */

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
        end: startOfDay(end), // checkout day (exclusive)
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

/* =========================================================
   1) CALENDAR CAROUSEL (12 months)
   ========================================================= */

let occCarouselBound = false;

function renderCalendarCarousel(bookings, years) {
  const carousel = document.getElementById("occCalendarCarousel");
  const track = document.getElementById("occCalendarTrack");
  const tooltip = document.getElementById("occTooltip");
  if (!carousel || !track) return;

  const showPlatform = !!state.showPlatform;
  const showOwner = !!state.showOwner;

  // ✅ Filter ALLEEN op toggles (niet op jaar)
  const filtered = bookings.filter((b) => {
    if (b.type === "platform" && !showPlatform) return false;
    if (b.type === "owner" && !showOwner) return false;
    return true;
  });

  track.innerHTML = "";

  // ✅ Zorg dat years echt een array is (en gesorteerd)
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

      // nav buttons (corners)
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

      // bind nav buttons
      nav.querySelectorAll(".occ-nav-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const dir = Number(btn.dataset.dir || "0");
          const totalSlides = yearList.length * 12;

          const cur = clamp(
            Number(state.occupancySlideIndex ?? 0),
            0,
            totalSlides - 1
          );

          const next = clamp(cur + dir, 0, totalSlides - 1);
          state.occupancySlideIndex = next;

          carousel.scrollTo({
            left: carousel.clientWidth * next,
            behavior: "smooth",
          });
        });
      });

      // title
      const title = document.createElement("div");
      title.className = "occ-month-title";
      title.textContent = new Date(year, m, 1).toLocaleDateString("nl-NL", {
        month: "long",
        year: "numeric",
      });

      // grid
      const grid = document.createElement("div");
      grid.className = "occ-month-grid";
      grid.dataset.year = String(year);
      grid.dataset.month = String(m);

      card.appendChild(title);
      card.appendChild(grid);
      slide.appendChild(card);
      track.appendChild(slide);

      // ✅ render met jaar+maand (bookings al toggle-filtered)
      renderSingleMonthGrid(grid, filtered, year, m, tooltip);

      slideIndex++;
    }
  });

  // ✅ scroll naar juiste slideIndex (niet alleen maand 0-11)
  const totalSlides = yearList.length * 12;

  if (state.occupancySlideIndex == null) {
    // default: huidige maand (binnen totalSlides)
    state.occupancySlideIndex = clamp(new Date().getMonth(), 0, totalSlides - 1);
  }

  const activeSlide = clamp(Number(state.occupancySlideIndex), 0, totalSlides - 1);

  requestAnimationFrame(() => {
    carousel.scrollLeft = carousel.clientWidth * activeSlide;
  });

  bindCarouselSyncOnce(carousel, totalSlides);

  // ✅ Clear sticky tooltip on scroll
  carousel.addEventListener("scroll", () => hideTooltip(tooltip, true), { passive: true });
}

function renderSingleMonthGrid(gridEl, bookings, year, monthIdx, tooltip) {
  gridEl.innerHTML = "";

  // DOW header
  const dows = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"];
  dows.forEach((t) => {
    const el = document.createElement("div");
    el.className = "occ-month-dow";
    el.textContent = t;
    gridEl.appendChild(el);
  });

  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd = new Date(year, monthIdx + 1, 1);

  const gridStart = startOfWeekMonday(monthStart);
  const gridEnd = endOfWeekSunday(addDays(monthEnd, -1));

  const days = [];
  for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) days.push(new Date(d));

  // Map: dateKey -> cell element
  const cellByKey = new Map();

  // Apply fills from bookings (clipped to visible grid range)
  const gridStartDay = startOfDay(gridStart);
  const gridEndEx = addDays(startOfDay(gridEnd), 1);
  const visibleBookings = bookings.filter((b) => b.start < gridEndEx && b.end > gridStartDay);

  // Map: dateISO -> Booking (voor snelle lookup bij cell listeners)
  const primaryBookingMap = new Map();
  visibleBookings.forEach((b) => {
    // Vul de map voor elke dag van de boeking
    let curr = b.start < gridStartDay ? new Date(gridStartDay) : new Date(b.start);
    const end = b.end > gridEndEx ? new Date(gridEndEx) : new Date(b.end);
    while (curr < end) {
      primaryBookingMap.set(toISODateLocal(curr), b);
      curr.setDate(curr.getDate() + 1);
    }
  });

  // Render day cells
  days.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "occ-month-cell";
    if (day.getMonth() !== monthIdx) cell.classList.add("is-outside");

    const dayLabel = document.createElement("div");
    dayLabel.className = "occ-month-day";
    dayLabel.textContent = String(day.getDate());
    cell.appendChild(dayLabel);

    const iso = toISODateLocal(day);
    const bookingOnThisDay = primaryBookingMap.get(iso);

    // ✅ Hover/Click op dag (nu intelligent: boeking heeft voorrang)
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

  // helper to add a fill layer into a cell
  function addFill(cell, kind, type, booking, dayISO) {
    if (!cell) return;

    const div = document.createElement("div");
    div.className = `occ-fill ${kind} ${type}`; // kind: full/half-left/half-right, type: platform/owner

    // tooltip on fill (booking + pricing van die dag)
    div.style.pointerEvents = "auto";
    div.addEventListener("mouseenter", (e) => showBookingTooltip(e, booking, dayISO, tooltip));
    div.addEventListener("mousemove", (e) => moveTooltip(e, tooltip));
    div.addEventListener("mouseleave", () => hideTooltip(tooltip));
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      showBookingTooltip(e, booking, dayISO, tooltip, true); // true = force/sticky
    });

    // behind day number
    cell.insertBefore(div, cell.firstChild);
  }

  // Fill logic:
  // - Aankomstdag = half-right
  // - Vertrekdag  = half-left (checkout day)
  // - All nights in between = full
  visibleBookings.forEach((b) => {
    const typeClass = b.type === "owner" ? "owner" : "platform";

    const s = b.start < gridStartDay ? gridStartDay : b.start;
    const e = b.end > gridEndEx ? gridEndEx : b.end;
    if (e <= s) return;

    // aankomst half-right
    addFill(cellByKey.get(dayKey(s)), "half-right", typeClass, b, dayKey(s));

    // vertrek half-left (checkout day = e)
    addFill(cellByKey.get(dayKey(e)), "half-left", typeClass, b, dayKey(e));

    // full days between
    const nights = diffDays(s, e);
    for (let i = 1; i < nights; i++) {
      const d = addDays(s, i);
      addFill(cellByKey.get(dayKey(d)), "full", typeClass, b, dayKey(d));
    }
  });

  // click outside hides tooltip (per month render; once)
  if (tooltip) {
    document.addEventListener("click", () => hideTooltip(tooltip), { once: true });
  }
}

function dayKey(d) {
  // ✅ local-safe ISO (geen timezone shift)
  return toISODateLocal(d);
}

/* =========================================================
   Carousel sync (update state.occupancySlideIndex)
   ========================================================= */

function bindCarouselSyncOnce(carousel, totalSlides) {
  if (occCarouselBound) return;
  occCarouselBound = true;

  carousel.addEventListener(
    "scroll",
    () => {
      const idx = Math.round(carousel.scrollLeft / carousel.clientWidth);
      const slideIdx = clamp(idx, 0, (totalSlides ?? 12) - 1);
      state.occupancySlideIndex = slideIdx;
    },
    { passive: true }
  );
}

/* =========================================================
   Tooltip helpers (UNIFIED)
   ========================================================= */

let isTooltipSticky = false;

function showBookingTooltip(e, b, dayISO, tooltipEl, forceSticky = false) {
  renderUnifiedTooltip(e, tooltipEl, b, dayISO, forceSticky);
}

function showDayTooltip(e, dayDate, tooltipEl, forceSticky = false) {
  renderUnifiedTooltip(e, tooltipEl, null, toISODateLocal(dayDate), forceSticky);
}

function renderUnifiedTooltip(e, tooltipEl, booking, dayISO, forceSticky = false) {
  if (!tooltipEl) return;
  if (isTooltipSticky && !forceSticky) return;

  if (forceSticky) isTooltipSticky = true;

  const p = getPricingByISO(dayISO);

  // Lijn 1: Gast of Status
  const title = booking
    ? escapeHtml(booking.guest || "Onbekende gast")
    : "Nog beschikbaar";

  // Lijn 2: Periode + nachten (indien boeking)
  let line2 = "";
  if (booking) {
    const startStr = booking.start.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    const endStr = booking.end.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
    line2 = `<div class="tt-line-meta">${startStr}–${endStr} · ${booking.nights}n</div>`;
  } else {
    // Voor ongeboekte dagen tonen we geen meta-lijn meer (datum staat onderaan)
    line2 = "";
  }

  // Lijn 3: Huur (indien boeking)
  let line3 = "";
  if (booking && booking.income != null) {
    line3 = `<div class="tt-line-rent">Huur: ${euro(booking.income)}</div>`;
  }

  // Lijn 4: Pricing (Dag/Week)
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
      ${line2}
      ${line3}
      ${line4}
      <div class="tooltip-hint">${fmtDateNL(new Date(dayISO))}</div>
    </div>
  `;

  tooltipEl.style.display = "block";
  moveTooltip(e, tooltipEl, true);
}

function moveTooltip(e, tooltipEl, force = false) {
  if (!tooltipEl) return;
  if (isTooltipSticky && !force) return;

  // We negeren de muispositie (e) en gebruiken een vaste positie via CSS.
  // We hoeven hier dus geen inline styles voor left/top te zetten.
  tooltipEl.style.left = "";
  tooltipEl.style.top = "";
}

function hideTooltip(tooltipEl, force = false) {
  if (!tooltipEl) return;
  if (isTooltipSticky && !force) return;

  if (force) isTooltipSticky = false;
  tooltipEl.style.display = "none";
}

// Global click to clear sticky
document.addEventListener("click", () => {
  const tt = document.getElementById("occTooltip");
  if (tt) hideTooltip(tt, true);
});

/* =========================================================
   Date / money utils
   ========================================================= */

function parseNLDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v;

  const s = String(v).trim();
  if (!s) return null;

  const datePart = s.split(" ")[0];
  const m = datePart.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const yy = Number(m[3]);
    const d = new Date(yy, mm, dd);
    return isNaN(d) ? null : d;
  }

  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function parseMoney(v) {
  if (typeof v === "number") return v;
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s === "-" || s === "—") return null;

  const cleaned = s
    .replaceAll("€", "")
    .replaceAll(".", "")
    .replaceAll(",", ".")
    .replace(/\s+/g, "");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function euro(x) {
  try {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(x));
  } catch {
    const n = Number(x);
    return Number.isFinite(n) ? `€${Math.round(n * 100) / 100}` : "—";
  }
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function diffDays(a, b) {
  const A = startOfDay(a).getTime();
  const B = startOfDay(b).getTime();
  return Math.max(0, Math.round((B - A) / 86400000));
}

function fmtDateNL(d) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function startOfWeekMonday(d) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(x, diff);
}

function endOfWeekSunday(d) {
  const mon = startOfWeekMonday(d);
  return addDays(mon, 6);
}

function intersectsYear(b, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  return b.start < yearEnd && b.end > yearStart;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ✅ Local-safe ISO formatter (voorkomt timezone “day shift”)
function toISODateLocal(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}