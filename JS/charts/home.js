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

export function renderHomeKPIs(allRows) {
  if (!allRows || allRows.length === 0) return;

  const platformRows = allRows.filter((r) => !r.__owner);
  const ownerRows = allRows.filter((r) => r.__owner);

  const bookings = platformRows.length;
  const ownerBookings = ownerRows.length;

  const nights = platformRows.reduce((s, r) => s + (r.__nights || 0), 0);
  const ownerNights = ownerRows.reduce((s, r) => s + (r.__nights || 0), 0);

  const totalOccupied = nights + ownerNights;

  const yearsInData = Math.max(1, getUniqueYearsCount(allRows));
  const totalDays = yearsInData * CONFIG.DAYS_IN_YEAR;

  const occupancyPct = totalDays > 0 ? totalOccupied / totalDays : 0;

  const grossRevenue = platformRows.reduce((s, r) => s + (r.__gross || 0), 0);
  const netRevenue = platformRows.reduce((s, r) => s + (r.__net || 0), 0);

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
          pointRadius: (c) => (data.pointsMeta[c.dataIndex]?.isBooking ? 6 : 0),
          pointHoverRadius: 8,
          hitRadius: 14,
          hoverRadius: 10,
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
