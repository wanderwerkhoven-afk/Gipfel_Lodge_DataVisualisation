/* ============================================================
 * 1. CONFIG & STATE
 * ============================================================ */
const NET_FACTOR = 0.76;
const DAYS_IN_YEAR = 365;

let rawRows = [];
let myChart = null;             // Home revenue bar chart
let cumulativeChart = null;     // Cumulative line chart
let cumulativeYear = null; // los van currentYear


let currentYear = new Date().getFullYear();
let currentSeason = "all";
let currentMode = "gross";      // "gross" | "net"

const SEASON_MAP = {
  winter: [11, 0, 1, 2],
  spring: [3, 4],
  summer: [5, 6, 7],
  autumn: [8, 9, 10],
};


/* ============================================================
 * 2. INITIALISATIE
 * ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  navigateTo("home");

  // Upload
  const fileInput = document.getElementById("fileInput");
  if (fileInput) fileInput.addEventListener("change", handleFileUpload);

  // Custom dropdown open/dicht
  const selectTrigger = document.querySelector(".select-trigger");
  const optionsContainer = document.getElementById("yearOptions");

  if (selectTrigger && optionsContainer) {
    selectTrigger.addEventListener("click", (e) => {
      optionsContainer.classList.toggle("show");
      e.stopPropagation();
    });

    window.addEventListener("click", () => {
      optionsContainer.classList.remove("show");
    });
  }

  // Seizoen buttons
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const active = document.querySelector(".filter-btn.active");
      if (active) active.classList.remove("active");
      e.currentTarget.classList.add("active");
      currentSeason = e.currentTarget.dataset.season;
      updateChart();
    });
  });

  // Bruto/Netto toggle
  const btnGross = document.getElementById("btnGross");
  const btnNet = document.getElementById("btnNet");

  if (btnGross && btnNet) {
    btnGross.addEventListener("click", () => toggleMode("gross", btnGross));
    btnNet.addEventListener("click", () => toggleMode("net", btnNet));
  }
});


/* ============================================================
 * 3. UI LOGICA
 * ============================================================ */
function toggleMode(mode, el) {
  document.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
  el.classList.add("active");
  currentMode = mode;
  updateChart(); // dit rendert óók de cumulatieve grafiek opnieuw
}

function navigateTo(pageId) {
  document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
  const activePage = document.getElementById(pageId + "-page");
  if (activePage) activePage.classList.add("active");

  document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
  const activeNav = document.getElementById("nav-" + pageId);
  if (activeNav) activeNav.classList.add("active");

  window.scrollTo(0, 0);
}


/* ============================================================
 * 4. DATA PIPELINE & DROPDOWN
 * ============================================================ */
function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

    rawRows = normalizeRows(jsonData);
    populateCustomYearDropdown(rawRows);   // jouw bestaande custom jaar dropdown
    populateCumulativeYearSelect(rawRows); // ✅ nieuwe dropdown voor cumulatief
    renderKPIs(rawRows);
    updateChart();

    // KPI’s over alles (cumulatief)
    renderKPIs(rawRows);

    // Charts op filters
    updateChart();
  };

  reader.readAsArrayBuffer(file);

  // allow re-upload same file
  event.target.value = "";
}

function populateCustomYearDropdown(rows) {
  const years = [...new Set(rows.map((r) => r.__aankomst.getFullYear()))].sort((a, b) => b - a);

  const optionsContainer = document.getElementById("yearOptions");
  const display = document.getElementById("selectedYearDisplay");
  const hiddenInput = document.getElementById("yearValue");

  if (!optionsContainer || !display || !hiddenInput) return;

  optionsContainer.innerHTML = "";

  years.forEach((year) => {
    const div = document.createElement("div");
    div.className = "option";
    div.textContent = year;

    div.addEventListener("click", () => {
      display.textContent = year;
      hiddenInput.value = String(year);
      currentYear = year;
      optionsContainer.classList.remove("show");
      updateChart();
    });

    optionsContainer.appendChild(div);
  });

  if (years.length > 0) {
    display.textContent = years[0];
    hiddenInput.value = String(years[0]);
    currentYear = years[0];
  }
}

function populateCumulativeYearSelect(rows) {
  const select = document.getElementById("cumulativeYearSelect");
  if (!select) return;

  const years = [...new Set(rows.map(r => r.__aankomst.getFullYear()))].sort((a, b) => b - a);
  if (years.length === 0) return;

  // 1) Options vullen
  select.innerHTML = "";
  years.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = String(year);
    select.appendChild(opt);
  });

  // 2) Default jaar kiezen (als cumulatief nog niet gezet is)
  //    -> eerst cumulatieveYear behouden als die nog geldig is
  //    -> anders currentYear
  //    -> anders meest recente jaar
  if (typeof cumulativeYear !== "number" || !years.includes(cumulativeYear)) {
    cumulativeYear = years.includes(currentYear) ? currentYear : years[0];
  }

  select.value = String(cumulativeYear);

  // 3) Belangrijk: eerst listener resetten (zodat je geen dubbele handlers krijgt)
  select.onchange = null;

  // 4) Listener: alleen cumulatieve grafiek updaten
  select.addEventListener("change", () => {
    cumulativeYear = Number(select.value);
    renderCumulativeChart(getRowsForCumulative()); // alleen cumulatief
  });

  // 5) Meteen ook renderen (zodat hij na upload direct zichtbaar is)
  renderCumulativeChart(getRowsForCumulative());
}



function normalizeRows(rows) {
  return rows
    .map((r) => {
      const aankomst = toDate(r["Aankomst"]);
      if (!aankomst) return null;

      const owner = isOwnerBooking(r);
      const gross = owner ? 0 : (toNumber(r["Inkomsten"]) ?? 0);

      return {
        ...r,
        __aankomst: aankomst,
        __nights: toNumber(r["Nachten"]) ?? 0,
        __owner: owner,
        __gross: gross,
        __net: gross * NET_FACTOR,
      };
    })
    .filter(Boolean);
}

function isOwnerBooking(row) {
  const inc = row["Inkomsten"];
  if (typeof inc === "string" && inc.trim() === "-") return true;

  const boeking = String(row["Boeking"] || "").toLowerCase();
  return boeking.includes("huiseigenaar");
}


/* ============================================================
 * 5. KPI RENDERING (CUMULATIEF)
 * ============================================================ */
function renderKPIs(allRows) {
  const platformRows = allRows.filter((r) => !r.__owner);
  const ownerRows = allRows.filter((r) => r.__owner);

  const bookings = platformRows.length;
  const ownerBookings = ownerRows.length;

  const nights = platformRows.reduce((s, r) => s + (r.__nights || 0), 0);
  const ownerNights = ownerRows.reduce((s, r) => s + (r.__nights || 0), 0);

  const totalOccupied = nights + ownerNights;

  const yearsInData = Math.max(1, [...new Set(allRows.map((r) => r.__aankomst.getFullYear()))].length);
  const totalDays = yearsInData * DAYS_IN_YEAR;

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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}


/* ============================================================
 * 6. CHART LOGICA (REAGEERT OP FILTERS)
 * ============================================================ */
function updateChart() {
  if (!rawRows || rawRows.length === 0) return;

  // Jaarfilter
  const yearRows = rawRows.filter((r) => r.__aankomst.getFullYear() === currentYear);

  // Seizoensfilter (alleen nodig voor seizoensinzichten)
  let filteredRows = yearRows;
  if (currentSeason !== "all") {
    const allowed = SEASON_MAP[currentSeason] || [];
    filteredRows = yearRows.filter((r) => allowed.includes(r.__aankomst.getMonth()));
  }

  // --- HOME BAR: seizoensinzichten (maand omzet) ---
  const monthlyData = {}; // monthIndex => {gross, net}

  yearRows.forEach((row) => {
    const m = row.__aankomst.getMonth();
    if (!monthlyData[m]) monthlyData[m] = { gross: 0, net: 0 };
    monthlyData[m].gross += row.__gross;
    monthlyData[m].net += row.__net;
  });

  let monthIndices = Object.keys(monthlyData).map(Number).sort((a, b) => a - b);

  if (currentSeason !== "all") {
    const allowed = SEASON_MAP[currentSeason] || [];
    monthIndices = monthIndices.filter((m) => allowed.includes(m));
  }

  const labels = monthIndices.map((m) =>
    new Date(currentYear, m, 1).toLocaleString("nl-NL", { month: "short" }).toUpperCase()
  );
  const values = monthIndices.map((m) => monthlyData[m][currentMode]);

  const homeCanvas = document.getElementById("chartHomeRevenue");
  if (homeCanvas) {
    const ctx = homeCanvas.getContext("2d");
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: "#3b82f6",
            borderRadius: 6,
          },
        ],
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
            ticks: { color: "#8b949e", font: { size: 13 } },
          },
        },
      },
    });
  }

  // --- CUMULATIVE: meestal door het héle jaar (aanrader) ---
  // Wil je hem ook seizoens-gefilt? vervang yearRows -> filteredRows
  renderCumulativeChart(yearRows);
}


/* ============================================================
 * 7. HELPERS
 * ============================================================ */
function toNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s === "-") return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

  if (typeof v === "string") {
    const onlyDate = v.split(" ")[0].trim();
    const m = onlyDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      const yyyy = Number(m[3]);
      const d = new Date(yyyy, mm, dd);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function fmtEUR(n) {
  if (n == null || !Number.isFinite(n)) return "€ 0,00";
  return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

function getRowsForCumulative(){
  if (!rawRows?.length) return [];
  const y = cumulativeYear ?? currentYear;
  return rawRows.filter(r => r.__aankomst && r.__aankomst.getFullYear() === y);
}




/* ============================================================
 * 8. CUMULATIEVE GRAFIEK (SCROLLABLE)
 * ============================================================ */

/**
 * Agg: dagelijkse timeline + forward-fill.
 * Performance: we maken eerst een map dateKey -> totalAmount + nights
 */
function aggCumulativeDaily(rows) {
  if (!rows || rows.length === 0) return { labels: [], values: [], pointsMeta: [] };

  const sorted = [...rows].sort((a, b) => a.__aankomst - b.__aankomst);

  const start = new Date(sorted[0].__aankomst);
  const end = new Date(sorted[sorted.length - 1].__aankomst);

  // Map "YYYY-MM-DD" -> { amount, nights }
  const byDay = new Map();

  for (const r of sorted) {
    const d = r.__aankomst;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const amount = currentMode === "gross" ? (r.__gross || 0) : (r.__net || 0);
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

  let currentSum = 0;
  const iter = new Date(start);

  while (iter <= end) {
    const key = `${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, "0")}-${String(iter.getDate()).padStart(2, "0")}`;
    const dayInfo = byDay.get(key);

    if (dayInfo?.hasBooking) {
      currentSum += dayInfo.amount;
      pointsMeta.push({
        isBooking: true,
        amount: dayInfo.amount,
        nights: dayInfo.nights,
        date: iter.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }),
        isOwner: !!dayInfo.isOwner,
      });
    } else {
      pointsMeta.push(null);
    }

    labels.push(new Date(iter));
    values.push(currentSum);

    iter.setDate(iter.getDate() + 1);
  }

  return { labels, values, pointsMeta };
}

/**
 * Zet minWidth van de inner container zodat je horizontaal kunt scrollen.
 */
function setScrollableChartWidth(pointsCount) {
  const inner = document.getElementById("cumScrollInner");
  if (!inner) return;

  const width = Math.max(1000, pointsCount * 14); // 14px per dag is fijn op mobiel
  inner.style.minWidth = width + "px";
}

/**
 * Render Chart.js
 */
function renderCumulativeChart(rows) {
  const canvas = document.getElementById("chartCumulative");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const data = aggCumulativeDaily(rows);

  if (cumulativeChart) cumulativeChart.destroy();

  setScrollableChartWidth(data.labels.length);

  cumulativeChart = new Chart(ctx, {
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
          pointRadius: (context) => (data.pointsMeta[context.dataIndex]?.isBooking ? 4 : 0),
          pointHoverRadius: 6,
          pointBackgroundColor: (context) => {
            const meta = data.pointsMeta[context.dataIndex];
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
          mode: "index",
          intersect: false,
          callbacks: {
            title: (items) => {
              const meta = data.pointsMeta[items[0].dataIndex];
              return meta ? meta.date : items[0].label;
            },
            label: (item) => {
              const meta = data.pointsMeta[item.dataIndex];
              const lines = [`Cumulatief: ${fmtEUR(item.raw)}`];

              if (meta?.isBooking) {
                lines.unshift(`Omzet boeking: ${fmtEUR(meta.amount)}`);
                lines.push(`Nachten: ${meta.nights}`);
                if (meta.isOwner) lines.push("Type: Huiseigenaar");
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "month",
            displayFormats: { month: "MMM yyyy" },
          },
          grid: { color: "rgba(255,255,255,0.05)" }, // verticale month gridlines
          ticks: { color: "#8b949e", font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "#8b949e",
            font: { size: 11 },
            callback: (v) => "€" + Number(v).toLocaleString("nl-NL"),
          },
        },
      },
    },
  });
}
