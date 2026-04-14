import { state } from "../core/app.js";
import { getYears, getRowsForYear } from "../core/dataManager.js";
import { 
  withPreservedScroll, 
  wireCustomYearSelect, 
  CHART_COLORS, 
  CHART_PALETTE,
  diffDays
} from "../core/ui-helpers.js";

export const BehaviorPage = {
  id: "behavior",
  title: "Gedrag",
  template: () => `
    <header class="top-bar">
      <div class="header-flex">
        <div class="header-titles">
          <h1>Gasten & Gedrag</h1>
          <p class="subtitle">Analyse van patronen</p>
        </div>
        <div class="topbar__controls">
          <label class="action-btn" for="fileInputOcc">
            <i class="fa-solid fa-file-import"></i>
            <input id="fileInputOcc" class="excel-upload" type="file" accept=".xlsx,.xls" hidden />
          </label>
        </div>
      </div>
    </header>

    <div class="container slide-up">
      <!-- DASHBOARD HEADER -->
      <div class="kpi-header">
        <div class="kpi-header__left">
          <h3 class="kpi-header__title">Gedrag Dashboard</h3>
          <p class="kpi-header__subtitle">Inzichten per boekingsjaar</p>
        </div>

        <div class="year-select-container">
          <div class="custom-select custom-select-behave" id="behaveYearSelectContainer">
            <div class="select-trigger">
              <span id="behaveSelectedYear">—</span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="select-options" id="behaveYearOptions"></div>
            <input type="hidden" id="behaveYearValue" value="">
          </div>
        </div>
      </div>
      <!-- KPI Row -->
      <section class="cards-grid behavior-kpis">
        <div class="kpi-card">
          <span class="label">Gem. Lead Time</span>
          <span id="behKpiLeadTime" class="value">—</span>
          <span class="sub-label">Dagen vooraf geboekt</span>
        </div>
        <div class="kpi-card">
          <span class="label">Gem. Verblijf</span>
          <span id="behKpiStay" class="value">—</span>
          <span class="sub-label">Nachten per boeking</span>
        </div>
        <div class="kpi-card">
          <span class="label">Gasten Selectie</span>
          <span id="behKpiGuestMix" class="value">—</span>
          <span class="sub-label">Gem. personen</span>
        </div>
      </section>

      <div class="dashboard-grid-2">
        <div class="chart-panel">
          <h3 class="panel-title">Wanneer wordt er geboekt? (Lead Time)</h3>
          <div class="chart-container">
            <canvas id="chartLeadTimeDist"></canvas>
          </div>
        </div>

        <div class="chart-panel">
          <h3 class="panel-title">Herkomst Gasten (Land)</h3>
          <div class="chart-container-sq">
            <canvas id="chartOriginCountry"></canvas>
          </div>
        </div>
      </div>

      <div class="dashboard-grid-2">
        <div class="chart-panel">
          <h3 class="panel-title">Gezinsverdeling Boekingen</h3>
          <div class="chart-container-sq">
            <canvas id="chartGuestComposition"></canvas>
          </div>
        </div>

        <div class="chart-panel">
          <h3 class="panel-title">Verblijfsduur Frequentie</h3>
          <div class="chart-container">
            <canvas id="chartStayDurationDist"></canvas>
          </div>
        </div>
      </div>
    </div>
  `,
  init: async () => {
    setupBehaviorYearSelect();
    renderBehaviorCharts();
  }
};

function setupBehaviorYearSelect() {
  const years = getYears();
  const availableYears = years.length > 0 ? years : [state.currentYear || new Date().getFullYear()];

  wireCustomYearSelect({
    containerId: "behaveYearSelectContainer",
    displayId: "behaveSelectedYear",
    optionsId: "behaveYearOptions",
    hiddenId: "behaveYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.behaviorYear ?? "ALL",
    set: (y) => (state.behaviorYear = y),
    onChange: () => withPreservedScroll(renderBehaviorCharts),
  });
}

/**
 * Main render function for Behavior visuals
 */
export async function renderBehaviorCharts() {
  const targetYear = state.behaviorYear ?? "ALL";
  const allRows = targetYear === "ALL" ? state.rawRows : getRowsForYear(targetYear);
  if (!allRows.length) return;

  // 1. Calculate KPIs
  let totalLeadTime = 0;
  let leadTimeCount = 0;
  let totalNights = 0;
  let totalGuests = 0;

  allRows.forEach(r => {
    if (r.__bookedAt && r.__aankomst) {
      const lt = diffDays(r.__bookedAt, r.__aankomst);
      totalLeadTime += lt;
      leadTimeCount++;
    }
    totalNights += (r.__nights || 0);
    totalGuests += (r.__totalGuests || 0);
  });

  const avgLeadTime = leadTimeCount > 0 ? totalLeadTime / leadTimeCount : 0;
  const avgStay = allRows.length > 0 ? totalNights / allRows.length : 0;
  const avgGuests = allRows.length > 0 ? totalGuests / allRows.length : 0;

  document.getElementById("behKpiLeadTime").textContent = Math.round(avgLeadTime) + "d";
  document.getElementById("behKpiStay").textContent = avgStay.toFixed(1) + "n";
  document.getElementById("behKpiGuestMix").textContent = avgGuests.toFixed(1) + "p";

  // 2. Lead Time Dist (Bar)
  renderLeadTimeChart(allRows);

  // 3. Origin Country (Doughnut)
  renderOriginChart(allRows);

  // 4. Guest Composition (Stacked Bar)
  renderGuestCompChart(allRows);

  // 5. Stay Duration (Bar)
  renderStayDurationChart(allRows);
}

function renderLeadTimeChart(rows) {
  const canvas = document.getElementById("chartLeadTimeDist");
  if (!canvas) return;

  const buckets = { "0-7d": 0, "1-2w": 0, "2-4w": 0, "1-2m": 0, "2m+": 0 };
  rows.forEach(r => {
    if (!r.__bookedAt || !r.__aankomst) return;
    const lt = diffDays(r.__bookedAt, r.__aankomst);
    if (lt <= 7) buckets["0-7d"]++;
    else if (lt <= 14) buckets["1-2w"]++;
    else if (lt <= 30) buckets["2-4w"]++;
    else if (lt <= 60) buckets["1-2m"]++;
    else buckets["2m+"]++;
  });

  if (state.charts.behLeadTime) state.charts.behLeadTime.destroy();

  state.charts.behLeadTime = new Chart(canvas, {
    type: "bar",
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        label: "Boekingen",
        data: Object.values(buckets),
        backgroundColor: CHART_COLORS.blue,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: CHART_COLORS.border }, ticks: { color: CHART_COLORS.text } },
        x: { grid: { display: false }, ticks: { color: CHART_COLORS.text } }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function renderOriginChart(rows) {
  const canvas = document.getElementById("chartOriginCountry");
  if (!canvas) return;

  const countryMap = {};
  rows.forEach(r => {
    const c = r.__countryCode || "Unknown";
    countryMap[c] = (countryMap[c] || 0) + 1;
  });

  const sorted = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const labels = sorted.map(s => s[0]);
  const data = sorted.map(s => s[1]);

  if (state.charts.behOrigin) state.charts.behOrigin.destroy();

  state.charts.behOrigin = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_PALETTE,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: { position: "bottom", labels: { color: CHART_COLORS.text, usePointStyle: true } }
      }
    }
  });
}

function renderGuestCompChart(rows) {
  const canvas = document.getElementById("chartGuestComposition");
  if (!canvas) return;

  // Categoriseer elke boeking in één van de drie typen
  let adultsOnly = 0;
  let withKids = 0;
  let withBabies = 0;

  rows.forEach(r => {
    const kids   = r.__kids   || 0;
    const babies = r.__babies || 0;
    if (babies > 0)      withBabies++;
    else if (kids > 0)   withKids++;
    else                 adultsOnly++;
  });

  const total = adultsOnly + withKids + withBabies;
  if (total === 0) return;

  const pct = (n) => Math.round((n / total) * 100);

  if (state.charts.behGuestComp) state.charts.behGuestComp.destroy();

  state.charts.behGuestComp = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: [
        `Alleen volwassenen (${pct(adultsOnly)}%)`,
        `Met kinderen (${pct(withKids)}%)`,
        `Met baby's (${pct(withBabies)}%)`
      ],
      datasets: [{
        data: [adultsOnly, withKids, withBabies],
        backgroundColor: [CHART_COLORS.blue, CHART_COLORS.orange, CHART_COLORS.green],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: CHART_COLORS.text, usePointStyle: true, padding: 16, font: { size: 13 } }
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const val = item.raw;
              const perc = pct(val);
              return ` ${val} boekingen (${perc}%)`;
            }
          }
        }
      }
    }
  });
}

function renderStayDurationChart(rows) {
  const canvas = document.getElementById("chartStayDurationDist");
  if (!canvas) return;

  const durationMap = {}; // nights -> count
  rows.forEach(r => {
    const n = r.__nights || 0;
    if (n > 0) durationMap[n] = (durationMap[n] || 0) + 1;
  });

  const sortedNights = Object.keys(durationMap).map(Number).sort((a, b) => a - b).slice(0, 14); // up to 14 nights
  const labels = sortedNights.map(n => n + "n");
  const data = sortedNights.map(n => durationMap[n]);

  if (state.charts.behStay) state.charts.behStay.destroy();

  state.charts.behStay = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Aantal verblijven",
        data,
        backgroundColor: CHART_COLORS.purple,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: CHART_COLORS.border }, ticks: { color: CHART_COLORS.text } },
        x: { grid: { display: false }, ticks: { color: CHART_COLORS.text } }
      },
      plugins: { legend: { display: false } }
    }
  });
}
