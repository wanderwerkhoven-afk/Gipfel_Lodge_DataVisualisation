/*-- =============================================================================
     =============================================================================

       ###     ###      #########      #####       #####    ############
       ###     ###    #############    ######     ######    ############
       ###########    ###       ###    ### ###   ### ###    ###
       ###########    ###       ###    ###  ### ###  ###    ##########
       ###     ###    ###       ###    ###   #####   ###    ##########
       ###     ###    ###       ###    ###    ###    ###    ###
       ###     ###    #############    ###    ###    ###    ############   ####
       ###     ###      #########      ###    ###    ###    ############   ####

     =============================================================================
     ======================================================================== --*/

// ./JS/charts/home.js
import { CONFIG, state } from "../state.js";
import { getRowsForYear } from "../data.js";

/* ============================================================
 * HOME KPI CARDS
 * ============================================================ */

export function renderHomeKPIsForYear(yearOrAll) {
  if (!state.rawRows || state.rawRows.length === 0) return;

  const rows =
    yearOrAll === "ALL" || yearOrAll == null
      ? state.rawRows
      : getRowsForYear(yearOrAll);

  renderHomeKPIs(rows);
}

function renderHomeKPIs(allRows) {
  if (!allRows || allRows.length === 0) return;

  const platformRows = allRows.filter((r) => !r.__owner);
  const ownerRows    = allRows.filter((r) => r.__owner);

  const bookings      = platformRows.length;
  const ownerBookings = ownerRows.length;

  const nights      = platformRows.reduce((s, r) => s + (r.__nights || 0), 0);
  const ownerNights = ownerRows.reduce((s, r) => s + (r.__nights || 0), 0);

  const totalOccupied = nights + ownerNights;

  // ALL -> kan meerdere jaren bevatten, jaarselect -> meestal 1 jaar
  const yearsInData = Math.max(1, getUniqueYearsCount(allRows));
  const totalDays   = yearsInData * CONFIG.DAYS_IN_YEAR;

  const occupancyPct = totalDays > 0 ? totalOccupied / totalDays : 0;

  const grossRevenue = platformRows.reduce((s, r) => s + (r.__gross || 0), 0);
  const netRevenue   = platformRows.reduce((s, r) => s + (r.__net || 0), 0);

  setText("kpiBookings", bookings);
  setText("kpiNights", nights);
  setText("kpiOwnerBookings", ownerBookings);
  setText("kpiOwnerNights", ownerNights);

  setText("kpiNightsFree", Math.max(0, totalDays - totalOccupied));
  setText("kpiOccupancyPct", (occupancyPct * 100).toFixed(1) + "%");

  setText("kpiGrossRevenue", fmtEUR(grossRevenue));
  setText("kpiGrossRevPerNight", fmtEUR(nights > 0 ? grossRevenue / nights : 0));

  setText("kpiNetRevenue", fmtEUR(netRevenue));
  setText("kpiNetRevPerNight", fmtEUR(nights > 0 ? netRevenue / nights : 0));
}






/* ============================================================
 * HOME: Booking Cards Carousel (swipeable: verleden / nu / toekomst)
 * + Pager: rail + ticks + knob (platgeslagen draaiknop)
 * ============================================================ */

export function renderHomeBookingCarousel(allRows) {
  // --- DOM refs ---
  const carousel  = document.getElementById("bookingCarousel");
  const track     = document.getElementById("bookingCarouselTrack");

  // (oude dots blijven bestaan, maar worden vervangen door knob/ticks)
  const dotsWrap  = document.getElementById("bookingCarouselDots");

  const prevBtn   = document.getElementById("bookingPrevBtn");
  const nextBtn   = document.getElementById("bookingNextBtn");

  // nieuwe pager elementen
  const knob      = document.getElementById("bookingKnob");
  const ticksWrap = document.getElementById("bookingTicks");

  if (!carousel || !track) return;

  if (!allRows || allRows.length === 0) {
    carousel.style.display = "none";
    return;
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const get = (row, keys, fallback = null) => {
    for (const k of keys) {
      if (row && row[k] != null && row[k] !== "") return row[k];
    }
    return fallback;
  };

  const coerceDate = (v) => {
    if (!v) return null;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

    if (typeof v === "string") {
      const m = v.match(/(\d{2})-(\d{2})-(\d{4})/);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const fmtRange = (a, b) => {
    const aStr = a.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
    const bStr = b.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return `${aStr} → ${bStr}`;
  };

  const fmtEUR = (value) => {
    const n = Number(value) || 0;
    return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
  };

  const normalizePhone = (v) => {
    if (v == null || v === "") return "";
    if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
    return String(v).replace(/[^\d+]/g, "");
  };

  // ------------------------------------------------------------
  // 1) Normalize rows (matchend met jouw Excel headers)
  // ------------------------------------------------------------
  const rows = allRows
    .map((r) => {
      const aankomst = coerceDate(get(r, ["__aankomst", "Aankomst"]));
      const vertrek  = coerceDate(get(r, ["__vertrek", "Vertrek"]));
      const nights   = Number(get(r, ["__nights", "Nachten"], 0)) || 0;

      const guest = String(get(r, ["__guest", "__gast", "Gast", "Naam"], "Onbekende gast"));
      const owner = !!get(r, ["__owner"], false);

      const bookingRaw = String(get(r, ["__bookingRaw", "Boeking"], ""));
      const source = bookingRaw.includes("|")
        ? bookingRaw.split("|")[1].trim()
        : (owner ? "Huiseigenaar" : "");

      const adults = Number(get(r, ["__adults", "Volw.", "Volwassenen"], 0)) || 0;
      const kids   = Number(get(r, ["__kids", "Knd.", "Kinderen"], 0)) || 0;
      const babies = Number(get(r, ["__babies", "Bab.", "Baby"], 0)) || 0;

      const phone = normalizePhone(get(r, ["__phone", "Telefoon", "Phone", "Tel"], ""));
      const email = String(get(r, ["__email", "E-mailadres", "Email", "E-mail", "Mail"], "") || "").trim();

      const countryCode = String(get(r, ["__countryCode", "Land", "Landcode", "Country code", "CC"], "") || "")
        .trim()
        .toUpperCase();

      const gross = Number(get(r, ["__gross", "Inkomsten", "Bruto", "Gross"], 0)) || 0;
      const net   = Number(get(r, ["__net", "Netto", "Net"], 0)) || 0;

      return {
        aankomst,
        vertrek,
        nights,
        guest,
        owner,
        source,
        adults,
        kids,
        babies,
        phone,
        email,
        countryCode,
        gross,
        net,
      };
    })
    .filter((x) => x.aankomst && x.vertrek)
    .sort((a, b) => a.aankomst - b.aankomst);

  if (!rows.length) {
    carousel.style.display = "none";
    return;
  }

  // ------------------------------------------------------------
  // 2) start index: NU (als aanwezig), anders eerst VOLGENDE
  // ------------------------------------------------------------
  const now        = startOfDay(new Date());
  const currentIdx = rows.findIndex((r) => r.aankomst <= now && now < r.vertrek);
  const nextIdx    = rows.findIndex((r) => r.aankomst > now);
  const startIndex = currentIdx !== -1 ? currentIdx : (nextIdx !== -1 ? nextIdx : 0);

  // ------------------------------------------------------------
  // 2b) Pager (dots/knob) helpers
  // ------------------------------------------------------------

  // (oude dots helper blijft bestaan; wordt nog aangeroepen maar is optioneel)
  const setActiveDot = (idx) => {
    if (!dotsWrap) return;
    [...dotsWrap.children].forEach((d, i) => d.classList.toggle("is-active", i === idx));
  };

  const updateKnob = (idx) => {
    if (!knob) return;

    const rail = knob.closest(".booking-scrollbar__rail");
    if (!rail) return;

    const railRect = rail.getBoundingClientRect();
    const padding = 14; // moet matchen met CSS ticks padding
    const usable = Math.max(0, railRect.width - padding * 2);

    const maxIdx = Math.max(1, rows.length - 1);
    const t = idx / maxIdx; // 0..1
    const x = padding + usable * t;

    knob.style.left = `${x}px`;
  };

  // ------------------------------------------------------------
  // 2c) Scroll helpers
  // ------------------------------------------------------------
  const scrollToIndex = (idx, smooth = true) => {
    const slides = track.querySelectorAll(".booking-slide");
    if (!slides[idx]) return;

    // inline: "start" past beter bij jouw full-page swipe CSS (100vw slides)
    slides[idx].scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      inline: "start",
      block: "nearest",
    });

    // update pagers
    setActiveDot(idx);  // dots blijven werken als je ze nog gebruikt
    updateKnob(idx);    // nieuwe knob
  };

  const getClosestIndex = () => {
    const slides = [...track.querySelectorAll(".booking-slide")];
    if (!slides.length) return 0;

    const trackRect = track.getBoundingClientRect();
    const center = trackRect.left + trackRect.width / 2;

    let bestIdx = 0;
    let bestDist = Infinity;

    slides.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const c = r.left + r.width / 2;
      const dist = Math.abs(center - c);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });

    return bestIdx;
  };

  // ------------------------------------------------------------
  // 3) render
  // ------------------------------------------------------------
  track.innerHTML = "";

  // dots: blijven bestaan, maar mogen leeg blijven als je overgaat op knob
  if (dotsWrap) dotsWrap.innerHTML = "";

  // ticks bouwen voor knob-rail
  if (ticksWrap) {
    ticksWrap.innerHTML = "";
    rows.forEach(() => {
      const t = document.createElement("div");
      t.className = "booking-tick";
      ticksWrap.appendChild(t);
    });
  }

  rows.forEach((picked, idx) => {
    const isNow  = picked.aankomst <= now && now < picked.vertrek;
    const isNext = !isNow && picked.aankomst > now;

    const statusText  = isNow ? "NU" : (isNext ? "VOLGENDE" : "VERLEDEN");
    const statusClass = isNow ? "badge--now" : (isNext ? "badge--next" : "badge--muted");

    // breakdown: alleen >0
    const breakdownParts = [];
    if ((picked.adults || 0) > 0) breakdownParts.push(`${picked.adults} volwassenen`);
    if ((picked.kids   || 0) > 0) breakdownParts.push(`${picked.kids} kinderen`);
    if ((picked.babies || 0) > 0) breakdownParts.push(`${picked.babies} baby`);
    const breakdown = breakdownParts.length ? `(${breakdownParts.join(", ")})` : "—";

    const totalGuests = (picked.adults || 0) + (picked.kids || 0) + (picked.babies || 0);

    const sourceParts = [];
    if (picked.owner) sourceParts.push("Huiseigenaar");
    if (picked.source && !picked.owner) sourceParts.push(picked.source);
    const sourceText = sourceParts.join(" • ");

    const cc = (picked.countryCode || "").trim().toUpperCase();
    const flagUrl = cc ? `https://flagcdn.com/w40/${cc.toLowerCase()}.png` : "";

    const amount = (picked.gross && picked.gross !== 0) ? picked.gross : picked.net;

    const slide = document.createElement("div");
    slide.className = "booking-slide";

    slide.innerHTML = `
      <div class="chart-panel booking-card booking-card--v2">

        <div class="booking-card__header">
          <h3 class="booking-card__title">Boeking</h3>
          <div class="booking-card__badges">
            <span class="badge ${statusClass}">${statusText}</span>
            ${sourceText ? `<span class="badge badge--muted ${picked.owner ? "badge--owner" : ""}">${sourceText}</span>` : ""}
          </div>
        </div>

        <div class="booking-card__divider"></div>

        <div class="booking-card__top">
          <div class="booking-card__left">
            <div class="booking-card__guest">${picked.guest || "—"}</div>

            <div class="booking-card__row booking-card__row--strong">
              <i class="fa-solid fa-user"></i>
              <span><strong>${totalGuests || "—"}</strong> gasten</span>
            </div>

            <div class="booking-card__sub">${breakdown}</div>
          </div>

          <div class="booking-card__country">
            ${flagUrl ? `<img class="booking-card__flag" src="${flagUrl}" alt="Flag" />` : ""}
            <div class="booking-card__countryCode">${cc || "—"}</div>
          </div>
        </div>

        <div class="booking-card__rows">
          <div class="booking-card__row">
            <i class="fa-regular fa-calendar"></i>
            <span>${fmtRange(picked.aankomst, picked.vertrek)}</span>
          </div>

          <div class="booking-card__row">
            <i class="fa-regular fa-moon"></i>
            <span>${picked.nights || 0} nachten</span>
          </div>

          ${picked.phone ? `
            <div class="booking-card__row">
              <i class="fa-solid fa-phone"></i>
              <a class="booking-card__link" href="tel:${picked.phone.replace(/\s+/g, "")}">${picked.phone}</a>
            </div>` : ""}

          ${picked.email ? `
            <div class="booking-card__row">
              <i class="fa-regular fa-envelope"></i>
              <a class="booking-card__link" href="mailto:${picked.email}">${picked.email}</a>
            </div>` : ""}
        </div>

        <div class="booking-card__divider booking-card__divider--bottom"></div>

        <div class="booking-card__price">${fmtEUR(amount)}</div>
      </div>
    `;

    track.appendChild(slide);

    // oude dots blijven werken als je ze nog gebruikt (optioneel)
    if (dotsWrap) {
      const dot = document.createElement("div");
      dot.className = "booking-dot" + (idx === startIndex ? " is-active" : "");
      dot.addEventListener("click", () => scrollToIndex(idx));
      dotsWrap.appendChild(dot);
    }
  });

  // ------------------------------------------------------------
  // 4) show + scroll to start
  // ------------------------------------------------------------
  carousel.style.display = "block";
  requestAnimationFrame(() => {
    scrollToIndex(startIndex, false);
    updateKnob(startIndex);
  });

  // ------------------------------------------------------------
  // 5) nav buttons (desktop)
  // ------------------------------------------------------------
  if (prevBtn) prevBtn.onclick = () => scrollToIndex(Math.max(0, getClosestIndex() - 1));
  if (nextBtn) nextBtn.onclick = () => scrollToIndex(Math.min(rows.length - 1, getClosestIndex() + 1));

  // ------------------------------------------------------------
  // 6) update pager on swipe/scroll
  // ------------------------------------------------------------
  let raf = null;
  track.addEventListener("scroll", () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const idx = getClosestIndex();
      setActiveDot(idx);   // blijft veilig (als dotsWrap bestaat)
      updateKnob(idx);     // nieuwe knob
    });
  });

    // ------------------------------------------------------------
  // 7) Draggable pager knob (slepen = naar page snappen)
  // ------------------------------------------------------------
  const rail = knob ? knob.closest(".booking-scrollbar__rail") : null;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const indexFromClientX = (clientX) => {
    if (!rail) return 0;

    const rect = rail.getBoundingClientRect();
    const padding = 14; // moet matchen met CSS ticks padding
    const usable = Math.max(1, rect.width - padding * 2);

    const x = clamp(clientX - rect.left - padding, 0, usable);
    const t = x / usable; // 0..1

    const maxIdx = Math.max(1, rows.length - 1);
    return Math.round(t * maxIdx);
  };

  let isDragging = false;
  let dragRaf = null;
  let lastIdx = startIndex;

  const onPointerMove = (e) => {
    if (!isDragging) return;

    const idx = indexFromClientX(e.clientX);
    lastIdx = idx;

    // Update knob soepel tijdens slepen (zonder elke pixel te scrollen)
    if (dragRaf) cancelAnimationFrame(dragRaf);
    dragRaf = requestAnimationFrame(() => updateKnob(idx));
  };

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;

    // release capture (veilig)
    try {
      if (knob && e?.pointerId != null) knob.releasePointerCapture(e.pointerId);
    } catch (_) {}

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);

    scrollToIndex(lastIdx, true);
  };

    const startDrag = (e) => {
    if (!rail || !knob) return;

    isDragging = true;

    // ✅ super belangrijk: pointer capture zodat je de knob "vast" houdt
    try {
      knob.setPointerCapture(e.pointerId);
    } catch (_) {}

    // voorkom dat de pagina scrollt tijdens drag
    e.preventDefault();

    lastIdx = indexFromClientX(e.clientX);
    updateKnob(lastIdx);

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: false });
    window.addEventListener("pointercancel", onPointerUp, { passive: false });
  };

  // Slepen op knob
  if (knob) {
    knob.addEventListener("pointerdown", startDrag, { passive: false });
  }

  // Klik/tap op rail = spring naar page
  if (rail) {
    rail.addEventListener("pointerdown", (e) => {
      // ✅ belangrijk: als je op de knob (of iets erin) klikt, niet jumpen
      if (e.target.closest && e.target.closest("#bookingKnob")) return;

      const idx = indexFromClientX(e.clientX);
      scrollToIndex(idx, true);
    }, { passive: true });
  }

}


/* ============================================================
 * HOME: Omzet per maand (BAR)
 * ============================================================ */

export function renderHomeRevenueChart() {
  if (!state.rawRows || state.rawRows.length === 0) return;

  const yearRows = getRowsForYear(state.currentYear);

  const monthlyData = {}; // monthIndex => {gross, net}
  yearRows.forEach((row) => {
    const m = row.__aankomst.getMonth();
    if (!monthlyData[m]) monthlyData[m] = { gross: 0, net: 0 };
    monthlyData[m].gross += row.__gross || 0;
    monthlyData[m].net += row.__net || 0;
  });

  // ✅ Altijd alle maanden (0..11), ook als er geen boekingen zijn
  let monthIndices = Array.from({ length: 12 }, (_, i) => i);

  // Seizoensfilter (toont nog steeds de maanden van dat seizoen, ook als ze 0 zijn)
  if (state.currentSeason !== "all") {
    const allowed = CONFIG.SEASON_MAP[state.currentSeason] || [];
    monthIndices = monthIndices.filter((m) => allowed.includes(m));
  }

  const labels = monthIndices.map((m) =>
    new Date(state.currentYear, m, 1)
      .toLocaleString("nl-NL", { month: "short" })
      .toUpperCase()
  );

  // ✅ Default 0 voor maanden zonder data
  const values = monthIndices.map((m) => {
    const entry = monthlyData[m];
    if (!entry) return 0;
    return entry[state.currentMode] ?? 0;
  });

  const canvas = document.getElementById("chartHomeRevenue");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // Gebruik een unieke key zodat later andere pagina’s ook chart keys kunnen hebben
  if (state.charts?.homeRevenueBar) state.charts.homeRevenueBar.destroy();

  state.charts.homeRevenueBar = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: "#3b82f6", borderRadius: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#8b949e", font: { size: 13 } },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: "#8b949e",
            font: { size: 13 },
            autoSkip: false,
            maxRotation: 45,
            minRotation: 45,
            padding: 8,
          },
        },
      },

    },
  });
}


/* ============================================================
 * HOME: Cumulatieve omzet (LINE, stepped)
 * ============================================================ */

export function renderHomeCumulativeRevenueChartForYear(yearOrAll) {
  if (!state.rawRows || state.rawRows.length === 0) return;

  const rows =
    yearOrAll === "ALL" || yearOrAll == null
      ? state.rawRows
      : getRowsForYear(yearOrAll);

  renderHomeCumulativeRevenueChart(rows);
}


function renderHomeCumulativeRevenueChart(rows) {
  const canvas = document.getElementById("chartCumulative");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const data = aggCumulativeDaily(rows);

  if (state.charts?.homeCumulativeRevenue) state.charts.homeCumulativeRevenue.destroy();

  setScrollableChartWidth(data.labels.length);

  state.charts.homeCumulativeRevenue = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [
        {
          label: "Cumulatieve omzet",
          data: data.values,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.12)",
          fill: true,
          stepped: true,
          borderWidth: 3,
          tension: 0,

          // alleen punten op boekingsdagen
          pointRadius: (c) => (data.pointsMeta[c.dataIndex]?.isBooking ? 8 : 0),
          pointHoverRadius: 10,
          pointBackgroundColor: (c) => {
            const meta = data.pointsMeta[c.dataIndex];
            if (!meta?.isBooking) return "rgba(0,0,0,0)";
            return meta.isOwner ? "#ff8a2a" : "#ffffff";
          },
          pointBorderColor: "rgba(0,0,0,0)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 20, top: 10 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,

          // ✅ precieze hover: alleen bij punten
          mode: "nearest",
          intersect: true,

          // ✅ styling
          backgroundColor: "rgba(11,18,37,0.95)",
          borderColor: "rgba(255,255,255,0.10)",
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,

          titleColor: "#ffffff",
          bodyColor: "#d1d5db",
          titleFont: { size: 13, weight: "600" },
          bodyFont: { size: 12 },

          displayColors: false,

          callbacks: {
            title: (items) => {
              const meta = data.pointsMeta[items[0].dataIndex];
              return meta?.date ?? "";
            },
            label: (item) => {
              const meta = data.pointsMeta[item.dataIndex];
              if (!meta?.isBooking) return "";

              const lines = [
                `Omzet boeking: ${fmtEUR(meta.amount)}`,
                `Cumulatief: ${fmtEUR(item.raw)}`,
                `Nachten: ${meta.nights}`,
              ];

              if (meta.isOwner) lines.push("Type: Huiseigenaar");
              return lines;
            },
          },
        },

      },
      scales: {
        x: {
          type: "time",
          time: { unit: "month", displayFormats: { month: "MMM yyyy" } },
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#8b949e", font: { size: 13 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },

          // ✅ we verbergen de y ticks in de chart zelf
          ticks: { display: false },
          border: { display: false },
        },
      },
    },
  });

  // ✅ NA layout: sticky y-as labels (DOM) bijwerken
  requestAnimationFrame(() => {
    renderStickyYAxisLabelsFromChart(state.charts.homeCumulativeRevenue);
  });
}


/* ============================================================
 * Helpers (Home)
 * ============================================================ */

function getUniqueYearsCount(rows) {
  const years = new Set(rows.map((r) => r.__aankomst?.getFullYear()).filter((y) => Number.isFinite(y)));
  return years.size || 1;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function fmtEUR(n) {
  const val = Number(n);
  if (!Number.isFinite(val)) return "€ 0,00";
  return val.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

function renderStickyYAxisLabelsFromChart(chart) {
  const wrap = document.getElementById("cumYAxis");
  if (!wrap || !chart?.scales?.y) return;

  const yScale = chart.scales.y;

  // ✅ omkeren: boven = max, onder = 0
  const ticks = [...(yScale.ticks || [])].reverse();

  wrap.innerHTML = "";
  ticks.forEach((t) => {
    const span = document.createElement("span");
    span.textContent = "€" + Number(t.value).toLocaleString("nl-NL");
    wrap.appendChild(span);
  });
}



function setScrollableChartWidth(pointsCount) {
  const inner = document.getElementById("cumScrollInner");
  if (!inner) return;
  inner.style.minWidth = Math.max(1000, pointsCount * 5) + "px";
}

function aggCumulativeDaily(rows) {
  if (!rows || rows.length === 0) return { labels: [], values: [], pointsMeta: [] };

  const sorted = [...rows].sort((a, b) => a.__aankomst - b.__aankomst);
  const start = new Date(sorted[0].__aankomst);
  const end = new Date(sorted[sorted.length - 1].__aankomst);

  const byDay = new Map();

  for (const r of sorted) {
    const d = r.__aankomst;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const amount = state.currentMode === "gross" ? (r.__gross || 0) : (r.__net || 0);
    const nights = r.__nights || 0;

    const prev = byDay.get(key) || { amount: 0, nights: 0, hasBooking: false, isOwner: false };
    byDay.set(key, {
      amount: prev.amount + amount,
      nights: prev.nights + nights,
      hasBooking: true,
      isOwner: prev.isOwner || !!r.__owner,
    });
  }

  const labels = [];
  const values = [];
  const pointsMeta = [];

  let sum = 0;
  const iter = new Date(start);

  while (iter <= end) {
    const key = `${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, "0")}-${String(iter.getDate()).padStart(2, "0")}`;
    const info = byDay.get(key);

    if (info?.hasBooking) {
      sum += info.amount;
      pointsMeta.push({
        isBooking: true,
        amount: info.amount,
        nights: info.nights,
        date: iter.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }),
        isOwner: !!info.isOwner,
      });
    } else {
      pointsMeta.push(null);
    }

    labels.push(new Date(iter));
    values.push(sum);
    iter.setDate(iter.getDate() + 1);
  }

  return { labels, values, pointsMeta };
}
