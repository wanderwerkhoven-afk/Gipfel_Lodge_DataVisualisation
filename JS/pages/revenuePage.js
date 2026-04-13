import { state } from "../core/app.js";
import { getYears, getRowsForYear } from "../core/dataManager.js";
import { 
  withPreservedScroll, 
  wireCustomYearSelect, 
  euro, 
  CHART_COLORS, 
  CHART_PALETTE 
} from "../core/ui-helpers.js";

export const RevenuePage = {
  id: "revenue",
  title: "Omzet",
  template: () => `
    <header class="top-bar">
      <div class="header-flex">
        <div class="header-titles">
          <h1>Omzet & Prijs</h1>
          <p class="subtitle">Financiële inzichten</p>
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
          <h3 class="kpi-header__title">Omzet Dashboard</h3>
          <p class="kpi-header__subtitle">Analyse per boekingsjaar</p>
        </div>

        <div class="year-select-container">
          <div class="custom-select custom-select-rev" id="revYearSelectContainer">
            <div class="select-trigger">
              <span id="revSelectedYear">—</span>
              <i class="fa-solid fa-chevron-down"></i>
            </div>
            <div class="select-options" id="revYearOptions"></div>
            <input type="hidden" id="revYearValue" value="">
          </div>
        </div>
      </div>
      <!-- KPI Row -->
      <section class="cards-grid revenue-kpis">
        <div class="kpi-card">
          <span class="label">Totaal Bruto</span>
          <span id="revKpiTotalGross" class="value">—</span>
        </div>
        <div class="kpi-card">
          <span class="label">Gem. Nachtprijs (ADR)</span>
          <span id="revKpiADR" class="value">—</span>
        </div>
        <div class="kpi-card">
          <span class="label">Geschatte Uitbetaling</span>
          <span id="revKpiTotalNet" class="value">—</span>
        </div>
      </section>

      <div class="charts-masonry">
        <div class="chart-panel">
          <h3 class="panel-title">Kanaal Mix</h3>
          <div class="chart-container-sq">
            <canvas id="chartRevenueChannel"></canvas>
          </div>
        </div>

        <div class="chart-panel">
          <h3 class="panel-title">Prijsontwikkeling (ADR)</h3>
          <div class="chart-container">
            <canvas id="chartADRTrend"></canvas>
          </div>
        </div>

        <div class="chart-panel full-width">
          <h3 class="panel-title">Maandelijkse Omzet (Bruto vs Netto)</h3>
          <div class="chart-container">
            <canvas id="chartMonthlyRevenueStack"></canvas>
          </div>
        </div>
      </div>
    </div>
  `,
  init: async () => {
    setupRevenueYearSelect();
    renderRevenueCharts();
  }
};

function setupRevenueYearSelect() {
  const years = getYears();
  const availableYears = years.length > 0 ? years : [state.currentYear || new Date().getFullYear()];

  wireCustomYearSelect({
    containerId: "revYearSelectContainer",
    displayId: "revSelectedYear",
    optionsId: "revYearOptions",
    hiddenId: "revYearValue",
    years: ["ALL", ...availableYears],
    get: () => state.revenueYear ?? "ALL",
    set: (y) => (state.revenueYear = y),
    onChange: () => withPreservedScroll(renderRevenueCharts),
  });
}

/**
 * Main render function for Revenue visuals
 */
export async function renderRevenueCharts() {
  const targetYear = state.revenueYear ?? "ALL";
  const allRows = targetYear === "ALL" ? state.rawRows : getRowsForYear(targetYear);
  const platformRows = allRows.filter(r => !r.__owner);

  // 1. Calculate KPIs
  const totalGross = platformRows.reduce((s, r) => s + (r.__gross || 0), 0);
  const totalNet = platformRows.reduce((s, r) => s + (r.__net || 0), 0);
  const totalNights = platformRows.reduce((s, r) => s + (r.__nights || 0), 0);
  const avgADR = totalNights > 0 ? totalGross / totalNights : 0;

  document.getElementById("revKpiTotalGross").textContent = euro(totalGross);
  document.getElementById("revKpiADR").textContent = euro(avgADR);
  document.getElementById("revKpiTotalNet").textContent = euro(totalNet);

  // 2. Channel Distribution (Doughnut)
  renderChannelMixChart(platformRows);

  // 3. ADR Trend (Line)
  renderADRTrendChart(platformRows);

  // 4. Monthly Stacked (Bar)
  renderMonthlyStackChart(platformRows);
}

function renderChannelMixChart(rows) {
  const canvas = document.getElementById("chartRevenueChannel");
  if (!canvas) return;

  const channelMap = {};
  rows.forEach(r => {
    const raw = r.__bookingRaw || "";
    const name = raw.includes("|") ? raw.split("|")[1].trim() : "Direct / Overig";
    channelMap[name] = (channelMap[name] || 0) + r.__gross;
  });

  const labels = Object.keys(channelMap);
  const data = Object.values(channelMap);

  if (state.charts.revChannel) state.charts.revChannel.destroy();

  state.charts.revChannel = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_PALETTE,
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: CHART_COLORS.text, padding: 20, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.label}: ${euro(item.raw)}`
          }
        }
      }
    }
  });
}

function renderADRTrendChart(rows) {
  const canvas = document.getElementById("chartADRTrend");
  if (!canvas) return;

  const monthlyData = Array(12).fill(0).map(() => ({ gross: 0, nights: 0 }));
  rows.forEach(r => {
    const m = r.__aankomst.getMonth();
    monthlyData[m].gross += r.__gross;
    monthlyData[m].nights += r.__nights;
  });

  const adrByMonth = monthlyData.map(d => d.nights > 0 ? d.gross / d.nights : 0);
  const labels = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

  if (state.charts.revADR) state.charts.revADR.destroy();

  state.charts.revADR = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "ADR",
        data: adrByMonth,
        borderColor: CHART_COLORS.blue,
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: CHART_COLORS.blue
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: CHART_COLORS.border },
          ticks: { color: CHART_COLORS.text, callback: (v) => "€" + v }
        },
        x: { grid: { display: false }, ticks: { color: CHART_COLORS.text } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `Avg Price: ${euro(item.raw)}`
          }
        }
      }
    }
  });
}

function renderMonthlyStackChart(rows) {
  const canvas = document.getElementById("chartMonthlyRevenueStack");
  if (!canvas) return;

  const monthlyGross = Array(12).fill(0);
  const monthlyNet = Array(12).fill(0);

  rows.forEach(r => {
    const m = r.__aankomst.getMonth();
    monthlyGross[m] += r.__gross;
    monthlyNet[m] += r.__net;
  });

  const labels = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

  if (state.charts.revMonthly) state.charts.revMonthly.destroy();

  state.charts.revMonthly = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Netto",
          data: monthlyNet,
          backgroundColor: CHART_COLORS.green,
          borderRadius: 4
        },
        {
          label: "Commissie / Tax",
          data: monthlyGross.map((g, i) => g - monthlyNet[i]),
          backgroundColor: "rgba(255, 255, 255, 0.05)",
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: CHART_COLORS.text } },
        y: { stacked: true, grid: { color: CHART_COLORS.border }, ticks: { color: CHART_COLORS.text, callback: (v) => "€" + v } }
      },
      plugins: {
        legend: {
          position: "top",
          labels: { color: CHART_COLORS.text, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: (item) => `${item.dataset.label}: ${euro(item.raw)}`
          }
        }
      }
    }
  });
}
