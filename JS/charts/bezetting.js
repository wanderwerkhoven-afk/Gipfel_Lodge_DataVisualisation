// ./JS/charts/bezetting.js
import { state } from "../state.js";

/**
 * Entry: render occupancy page
 * - Year dropdown is handled in ui.js via wireCustomYearSelect()
 * - Here we only read state.occupancyYear ("ALL" or "2026") and render charts
 */
export function renderBezettingCharts() {
  if (!state.rawRows || !state.rawRows.length) return;

  // defaults
  if (state.occupancyYear == null) state.occupancyYear = "ALL";
  if (state.occupancyMonth == null) state.occupancyMonth = new Date().getMonth();
  if (state.showPlatform == null) state.showPlatform = true;
  if (state.showOwner == null) state.showOwner = true;

  // normalize once
  const allBookings = normalizeBookings(state.rawRows);

  // viewYear: if ALL -> use currentYear (or this year), else selected year
  let yearsToRender;

  if (state.occupancyYear === "ALL") {
    yearsToRender = Array.from(
      new Set(
        allBookings.flatMap((b) => [
          b.start.getFullYear(),
          b.end.getFullYear(),
        ])
      )
    )
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  } else {
    yearsToRender = [Number(state.occupancyYear)];
  }

  const bookingsForView = allBookings.filter((b) =>
    yearsToRender.some((y) => intersectsYear(b, y))
  );

  // ⬇️ belangrijk
  renderCalendarCarousel(bookingsForView, yearsToRender);
  renderWeekStack(bookingsForView, yearsToRender);


  // clamp in case something weird gets into the state
  const safeViewYear = Number.isFinite(viewYear) ? viewYear : new Date().getFullYear();

  // filter to view year window
  const bookingsForYear = allBookings.filter((b) => intersectsYear(b, safeViewYear));

  // 1) Calendar carousel (12 months)
  renderCalendarCarousel(bookingsForYear, safeViewYear);

  // 2) Week stacked chart
  renderWeekStack(bookingsForYear, safeViewYear);
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

      const nights = Number(r["Nachten"] ?? r.__nachten ?? diffDays(start, end)) || diffDays(start, end);
      const income = parseMoney(r["Inkomsten"]);

      const bookingLabel = String(r["Boeking"] ?? "").trim();
      const guest = String(r["Gast"] ?? "").trim();
      const channel = bookingLabel.includes("|") ? bookingLabel.split("|")[1].trim() : bookingLabel;

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
    // default: huidige maand van eerste jaar (of 0)
    state.occupancySlideIndex = clamp(new Date().getMonth(), 0, totalSlides - 1);
  }

  const activeSlide = clamp(Number(state.occupancySlideIndex), 0, totalSlides - 1);

  requestAnimationFrame(() => {
    carousel.scrollLeft = carousel.clientWidth * activeSlide;
  });

  bindCarouselSyncOnce(carousel, totalSlides);
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

  // Render day cells
  days.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "occ-month-cell";
    if (day.getMonth() !== monthIdx) cell.classList.add("is-outside");

    const dayLabel = document.createElement("div");
    dayLabel.className = "occ-month-day";
    dayLabel.textContent = String(day.getDate());
    cell.appendChild(dayLabel);

    gridEl.appendChild(cell);
    cellByKey.set(dayKey(day), cell);
  });

  // Apply fills from bookings (clipped to visible grid range)
  const gridStartDay = startOfDay(gridStart);
  const gridEndEx = addDays(startOfDay(gridEnd), 1);

  const visibleBookings = bookings.filter((b) => b.start < gridEndEx && b.end > gridStartDay);

  // helper to add a fill layer into a cell
  function addFill(cell, kind, type, booking) {
    if (!cell) return;

    const div = document.createElement("div");
    div.className = `occ-fill ${kind} ${type}`; // kind: full/half-left/half-right, type: platform/owner

    // tooltip on fill
    div.style.pointerEvents = "auto";
    div.addEventListener("mouseenter", (e) => showTooltip(e, booking, tooltip));
    div.addEventListener("mousemove", (e) => moveTooltip(e, tooltip));
    div.addEventListener("mouseleave", () => hideTooltip(tooltip));
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!tooltip) return;
      if (tooltip.style.display === "none") showTooltip(e, booking, tooltip);
      else hideTooltip(tooltip);
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
    addFill(cellByKey.get(dayKey(s)), "half-right", typeClass, b);

    // vertrek half-left (checkout day = e)
    addFill(cellByKey.get(dayKey(e)), "half-left", typeClass, b);

    // full days between
    const nights = diffDays(s, e);
    for (let i = 1; i < nights; i++) {
      const d = addDays(s, i);
      addFill(cellByKey.get(dayKey(d)), "full", typeClass, b);
    }
  });

  // click outside hides tooltip (per month render; once)
  if (tooltip) {
    document.addEventListener(
      "click",
      () => hideTooltip(tooltip),
      { once: true }
    );
  }
}

function dayKey(d) {
  const x = startOfDay(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

/* =========================================================
   Carousel sync (update state.occupancyMonth)
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
   2) WEEK STACKED BAR (0..7)
   ========================================================= */

function renderWeekStack(bookings, year) {
  const canvas = document.getElementById("chartWeekStack");
  if (!canvas) return;

  const showPlatform = !!state.showPlatform;
  const showOwner = !!state.showOwner;

  if (state.charts?.weekStack) state.charts.weekStack.destroy();

  const weeks = buildISOWeeksOfYear(year);
  const labels = weeks.map((w) => `${year}-W${pad2(w.week)}`);

  const platformNights = weeks.map(() => 0);
  const ownerNights = weeks.map(() => 0);

  bookings.forEach((b) => {
    if (b.type === "platform" && !showPlatform) return;
    if (b.type === "owner" && !showOwner) return;

    const s = b.start < yearStart ? yearStart : b.start;
    const e = b.end > yearEnd ? yearEnd : b.end;
    if (e <= s) return;

    const nights = diffDays(s, e);
    for (let i = 0; i < nights; i++) {
      const nightDate = addDays(s, i);
      const wk = isoWeekNumber(nightDate);
      const idx = weeks.findIndex((x) => x.week === wk);
      if (idx === -1) continue;
      if (b.type === "owner") ownerNights[idx] += 1;
      else platformNights[idx] += 1;
    }
  });

  const occupied = platformNights.map((v, i) => v + ownerNights[i]);
  const freeNights = occupied.map((v) => Math.max(0, 7 - v));

  const ctx = canvas.getContext("2d");
  state.charts.weekStack = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Platform (nachten)",
          data: platformNights,
          backgroundColor: "#2563eb", // blauw
          stack: "nights",
          borderRadius: 6,
        },
        {
          label: "Eigen gebruik (nachten)",
          data: ownerNights,
          backgroundColor: "#f59e0b", // oranje
          stack: "nights",
          borderRadius: 6,
        },
        {
          label: "Vrij (nachten)",
          data: freeNights,
          backgroundColor: "rgba(255,255,255,0.18)",
          stack: "nights",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: "rgba(255,255,255,0.7)" } },
        tooltip: {
          callbacks: {
            title: (items) => items?.[0]?.label ?? "",
            afterTitle: (items) => {
              const i = items?.[0]?.dataIndex ?? 0;
              const occ = occupied[i] ?? 0;
              const pct = Math.round((occ / 7) * 100);
              return `Bezet: ${occ}/7 (${pct}%)`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: "rgba(255,255,255,0.55)", maxRotation: 55, minRotation: 55 },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          max: 7,
          ticks: { stepSize: 1, color: "rgba(255,255,255,0.55)" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
}

/* =========================================================
   Tooltip helpers
   ========================================================= */

function showTooltip(e, b, tooltipEl) {
  if (!tooltipEl) return;

  const perNight = b.income && b.nights ? b.income / b.nights : null;

  tooltipEl.innerHTML = `
    <strong>${escapeHtml(b.guest || "Onbekende gast")}</strong>
    <div><b>Type:</b> ${b.type === "owner" ? "Eigen gebruik" : escapeHtml(b.channel || "Platform")}</div>
    <div><b>Periode:</b> ${fmtDateNL(b.start)} – ${fmtDateNL(b.end)}</div>
    <div><b>Nachten:</b> ${b.nights}</div>
    <div><b>€ / nacht:</b> ${perNight != null ? euro(perNight) : "—"}</div>
  `;

  tooltipEl.style.display = "block";
  moveTooltip(e, tooltipEl);
}

function moveTooltip(e, tooltipEl) {
  if (!tooltipEl) return;
  const pad = 12;
  tooltipEl.style.left = `${e.clientX + pad}px`;
  tooltipEl.style.top = `${e.clientY + pad}px`;
}

function hideTooltip(tooltipEl) {
  if (!tooltipEl) return;
  tooltipEl.style.display = "none";
}

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
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(x);
  } catch {
    return `€${Math.round(x * 100) / 100}`;
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

/* ================= ISO week helpers ================= */

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function buildISOWeeksOfYear(year) {
  const jan4 = new Date(year, 0, 4);
  let start = startOfWeekMonday(jan4);

  const weeks = [];
  for (let i = 0; i < 54; i++) {
    const wkStart = new Date(start);
    const wkEndEx = addDays(wkStart, 7);

    const thu = addDays(wkStart, 3);
    if (thu.getFullYear() === year) {
      weeks.push({ week: isoWeekNumber(wkStart), start: wkStart, endExclusive: wkEndEx });
    }

    start = wkEndEx;
    if (wkStart.getFullYear() > year + 1) break;
  }

  weeks.sort((a, b) => a.week - b.week);
  return weeks;
}
