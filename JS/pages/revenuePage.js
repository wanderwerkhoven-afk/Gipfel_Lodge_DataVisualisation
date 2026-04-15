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

      <div class="dashboard-grid-2">
        <div class="chart-panel">
          <h3 class="panel-title">Omzet per Maand (Platformen)</h3>
          <div class="chart-container">
            <canvas id="chartMonthlyRevenueStack"></canvas>
          </div>
        </div>

        <div class="chart-panel">
          <h3 class="panel-title">Prijs per nacht (ADR)</h3>
          <div class="chart-container">
            <canvas id="chartADRTrend"></canvas>
          </div>
        </div>
      </div>

      <div class="dashboard-grid-2">
        <div class="chart-panel">
          <div class="panel-header" style="margin-bottom: 10px;">
            <h3 class="panel-title" style="margin:0;">Omzet vs Bezetting</h3>
          </div>
          <div class="chart-container" style="height: 320px;">
            <canvas id="chartRevenueVsOccupancy"></canvas>
          </div>
          <div style="text-align: center; font-size: 11px; color: var(--text-muted); opacity: 0.7; margin-top: 10px;">
            💡 Inzicht in dynamic pricing: Hoge bezetting met lage prijs (rechtsonder) of lage bezetting met hoge prijs (linksboven).
          </div>
        </div>

        <div class="chart-panel">
          <div class="panel-header" style="margin-bottom: 10px;">
            <h3 class="panel-title" style="margin:0;">Pricing Heatmap</h3>
          </div>
          <div id="revenueHeatmapWrapper" style="display: flex; flex-direction: column; width: 100%; height: 320px;"></div>
          <div style="text-align: center; font-size: 11px; color: var(--text-muted); opacity: 0.7; margin-top: 10px;">
            💡 Inzicht: Spot dure weekenden en zwakke doordeweekse dalperiodes. Kleur = Gemiddelde prijs per nacht.
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

  // 2. Omzet per maand (Stacked per platform)
  renderMonthlyPlatformStackChart(allRows);

  // 3. Prijs per nacht (ADR Line Chart)
  renderADRTrendChart(allRows);

  // 4. Omzet vs Bezetting (Scatter Plot)
  renderRevenueVsOccupancyScatter(allRows, targetYear);

  // 5. Heatmap (Prijs per nacht per Weekdag vs Maand)
  renderPricingHeatmap(allRows, targetYear);
}

// Helper om platform naam te bepalen
function getPlatform(raw, isOwner) {
  if (isOwner) {
    if (String(raw).toLowerCase().includes("huiseigenaar")) return "Huiseigenaar (0)";
    return "Eigen";
  }
  const s = String(raw).toLowerCase();
  if (s.includes("booking.com")) return "Booking.com";
  if (s.includes("airbnb")) return "Airbnb";
  if (s.includes("villa for you")) return "Villa for You";
  return "Overig";
}

function renderMonthlyPlatformStackChart(rows) {
  const canvas = document.getElementById("chartMonthlyRevenueStack");
  if (!canvas) return;

  const platforms = ["Booking.com", "Airbnb", "Villa for You", "Eigen", "Huiseigenaar (0)", "Overig"];
  const colors = {
    "Booking.com": "#003580", // true booking blue
    "Airbnb": "#FF5A5F",      // true airbnb red
    "Villa for You": "#10b981", // green
    "Eigen": "#f59e0b",
    "Huiseigenaar (0)": "rgba(255, 255, 255, 0.2)",
    "Overig": "rgba(255, 255, 255, 0.5)"
  };

  const monthlyData = platforms.reduce((acc, p) => {
    acc[p] = new Array(12).fill(0);
    return acc;
  }, {});

  rows.forEach(r => {
    const m = r.__aankomst.getMonth();
    const plat = getPlatform(r.__bookingRaw, r.__owner);
    monthlyData[plat][m] += r.__gross || 0;
  });

  const labels = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  
  const datasets = platforms.map(p => ({
    label: p,
    data: monthlyData[p],
    backgroundColor: colors[p],
    borderRadius: 4
  }));

  if (state.charts.revMonthly) state.charts.revMonthly.destroy();
  state.charts.revMonthly = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: CHART_COLORS.text } },
        y: { stacked: true, grid: { color: CHART_COLORS.border }, ticks: { color: CHART_COLORS.text, callback: (v) => "€" + v } }
      },
      plugins: {
        legend: { position: "top", labels: { color: CHART_COLORS.text, usePointStyle: true, boxWidth: 8 } },
        tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${euro(item.raw)}` } }
      }
    }
  });
}

function renderADRTrendChart(rows) {
  const canvas = document.getElementById("chartADRTrend");
  if (!canvas) return;

  const monthlyData = Array(12).fill(0).map(() => ({ gross: 0, nights: 0 }));
  rows.forEach(r => {
    // Only count generating nights towards ADR to prevent owner stays dropping the rate
    if (r.__owner) return;
    const m = r.__aankomst.getMonth();
    monthlyData[m].gross += (r.__gross || 0);
    monthlyData[m].nights += (r.__nights || 0);
  });

  const adrByMonth = monthlyData.map(d => d.nights > 0 ? d.gross / d.nights : 0);
  const labels = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

  if (state.charts.revADR) state.charts.revADR.destroy();
  state.charts.revADR = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Prijs per nacht",
        data: adrByMonth,
        borderColor: CHART_COLORS.blue,
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: CHART_COLORS.blue
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: CHART_COLORS.border }, ticks: { color: CHART_COLORS.text, callback: (v) => "€" + v } },
        x: { grid: { display: false }, ticks: { color: CHART_COLORS.text } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => `Gem. Prijs: ${euro(item.raw)}` } }
      }
    }
  });
}

function renderRevenueVsOccupancyScatter(rows, targetYear) {
  const canvas = document.getElementById("chartRevenueVsOccupancy");
  if (!canvas) return;

  // Calculate actual total days per month depending on selected year
  const totalDaysPerMonth = new Array(12).fill(0);
  let yearsToProcess = [];
  if (targetYear === "ALL") {
    const foundRows = state.rawRows || [];
    const foundYears = new Set(foundRows.map(r => r.__aankomst.getFullYear()));
    yearsToProcess = foundYears.size > 0 ? Array.from(foundYears) : [state.currentYear || new Date().getFullYear()];
  } else {
    yearsToProcess = [Number(targetYear)];
  }

  yearsToProcess.forEach(y => {
    for (let m = 0; m < 12; m++) totalDaysPerMonth[m] += new Date(y, m + 1, 0).getDate();
  });

  const monthlyGross = new Array(12).fill(0);
  const monthlyRentedNights = new Array(12).fill(0);

  rows.forEach(r => {
    if (r.__owner) return; // Bezetting voor omzet berekening telt enkel betalende gasten
    const m = r.__aankomst.getMonth();
    monthlyGross[m] += (r.__gross || 0);
    monthlyRentedNights[m] += (r.__nights || 0);
  });

  const labels = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
  const scatterData = [];
  for (let m = 0; m < 12; m++) {
    const occPercent = totalDaysPerMonth[m] > 0 ? (monthlyRentedNights[m] / totalDaysPerMonth[m]) * 100 : 0;
    scatterData.push({ x: occPercent, y: monthlyGross[m], monthName: labels[m] });
  }

  if (state.charts.revScatter) state.charts.revScatter.destroy();
  state.charts.revScatter = new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Maanden",
        data: scatterData,
        backgroundColor: CHART_COLORS.orange,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Bezetting (%)", color: CHART_COLORS.text },
          grid: { color: CHART_COLORS.border },
          ticks: { color: CHART_COLORS.text, callback: v => v + "%" },
          min: 0, max: 100
        },
        y: {
          title: { display: true, text: "Omzet (€)", color: CHART_COLORS.text },
          grid: { color: CHART_COLORS.border },
          ticks: { color: CHART_COLORS.text, callback: v => "€" + v },
          beginAtZero: true
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw;
              return `${d.monthName}: ${d.x.toFixed(1)}% bezetting, ${euro(d.y)} omzet`;
            }
          }
        }
      }
    }
  });
}

function renderPricingHeatmap(rows, targetYear) {
  const wrap = document.getElementById("revenueHeatmapWrapper");
  if (!wrap) return;

  let yearsToProcess = [];
  if (targetYear === "ALL") {
    const foundRows = state.rawRows || [];
    const foundYears = new Set(foundRows.map(r => r.__aankomst.getFullYear()));
    yearsToProcess = foundYears.size > 0 ? Array.from(foundYears).sort((a,b) => a-b) : [state.currentYear || new Date().getFullYear()];
  } else {
    yearsToProcess = [Number(targetYear)];
  }

  let tp = document.getElementById("revTooltip");
  if (!tp) {
    tp = document.createElement("div");
    tp.id = "revTooltip";
    tp.className = "occ-tooltip";
    tp.style.display = "none";
    document.body.appendChild(tp);
  }
  
  window.showRevTooltip = (e, dateStr, tooltipText) => {
    const tpEl = document.getElementById("revTooltip");
    if(!tpEl) return;
    tpEl.innerHTML = `<div class="tooltip-content"><div class="tt-line-title">${dateStr}</div><div class="tt-line-pricing">${tooltipText}</div></div>`;
    tpEl.style.display = "block";
    
    // Clear inherited bottom/right and width constraints from standard occ-tooltip
    tpEl.style.right = "auto";
    tpEl.style.bottom = "auto";
    tpEl.style.width = "auto";
    tpEl.style.minWidth = "160px";
    tpEl.style.transform = "none";
    
    let x = e.clientX + 15;
    let y = e.clientY + 15;
    const r = tpEl.getBoundingClientRect();
    if(x + r.width > window.innerWidth) x = e.clientX - r.width - 15;
    if(y + r.height > window.innerHeight) y = e.clientY - r.height - 15;
    tpEl.style.left = x + "px";
    tpEl.style.top = y + "px";
  };
  
  window.hideRevTooltip = () => {
    const tpEl = document.getElementById("revTooltip");
    if(tpEl) tpEl.style.display = "none";
  };
  
  window.moveRevTooltip = (e) => {
    const tpEl = document.getElementById("revTooltip");
    if(!tpEl || tpEl.style.display === "none") return;
    let x = e.clientX + 15;
    let y = e.clientY + 15;
    const r = tpEl.getBoundingClientRect();
    if(x + r.width > window.innerWidth) x = e.clientX - r.width - 15;
    if(y + r.height > window.innerHeight) y = e.clientY - r.height - 15;
    tpEl.style.left = x + "px";
    tpEl.style.top = y + "px";
  };

  const rawPricing = state.pricingByDate || {};
  
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  const targetKeys = Object.keys(rawPricing);
  
  if (targetKeys.length === 0) {
    wrap.innerHTML = `<div style="text-align:center; padding: 30px; font-size: 13px; color: var(--text-muted);">
       Geen actuele prijsdata gevonden.<br> Upload een pricing Excel sheet in de Data pagina.
       </div>`;
    return;
  }

  targetKeys.forEach(iso => {
    const pr = rawPricing[iso]?.dagprijs;
    if (pr > 0 && pr < minPrice) minPrice = pr;
    if (pr > 0 && pr > maxPrice) maxPrice = pr;
  });

  if (minPrice === Infinity) { minPrice = 0; maxPrice = 100; }
  if (minPrice === maxPrice) maxPrice = minPrice + 1;

  let html = `<div style="display: flex; overflow-x: auto; gap: 24px; padding-bottom: 15px; flex: 1; align-items: start;">`;

  const dows = ["MA", "DI", "WO", "DO", "VR", "ZA", "ZO"];
  
  yearsToProcess.forEach(year => {
    for (let m = 0; m < 12; m++) {
      html += `<div style="min-width: 200px;">`;
      const monthName = new Date(year, m, 1).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
      html += `<h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--text); padding-left: 2px;">${monthName}</h4>`;
      
      html += `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; margin-bottom: 5px;">`;
      dows.forEach(d => {
        html += `<div style="font-size: 10px; color: var(--text-muted); font-weight: bold;">${d}</div>`;
      });
      html += `</div>`;
      
      html += `<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;">`;
      
      const firstDay = new Date(year, m, 1);
      const lastDay = new Date(year, m + 1, 0);
      let jsDay = firstDay.getDay(); // 0=Zo
      let emptyCells = jsDay === 0 ? 6 : jsDay - 1;
      
      for (let i = 0; i < emptyCells; i++) {
        html += `<div></div>`;
      }
      
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const curDate = new Date(year, m, d);
        // Correct for timezone offset to get correct YYYY-MM-DD local time
        const localDate = new Date(Date.UTC(year, m, d));
        const curIso = localDate.toISOString().split("T")[0];
        
        let bg = "rgba(255,255,255,0.03)";
        let tooltip = "Geen data";
        let cellColor = "var(--text-muted)";
        
        if (rawPricing[curIso]) {
          const adr = rawPricing[curIso].dagprijs;
          if (adr > 0) {
            const intensity = (adr - minPrice) / (maxPrice - minPrice);
            const hue = 45 + (intensity * 105); // 45 (Helder Geel) tot 150 (Zeer Groen)
            const light = 55 - (intensity * 35); // 55% light naar 20% dark
            
            bg = `hsl(${hue}, 100%, ${light}%)`;
            tooltip = `€${Math.round(adr)} per nacht`;
            cellColor = intensity > 0.5 ? "#ffffff" : "#000000";
          }
        }
        
        const titleStr = curDate.toLocaleDateString("nl-NL");
        html += `<div style="aspect-ratio: 1; display:flex; align-items:center; justify-content:center; background:${bg}; border-radius:4px; font-size: 11px; color: ${cellColor}; cursor: pointer; font-weight: 500;" 
                  onmouseover="this.style.opacity=0.7; window.showRevTooltip(event, '${titleStr}', '${tooltip}')"
                  onmousemove="window.moveRevTooltip(event)"
                  onmouseout="this.style.opacity=1; window.hideRevTooltip()"
                  >${d}</div>`;
      }
      
      html += `</div></div>`;
    }
  });

  html += `</div>`;
  html += `
    <div class="color-scale-legend" style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; width: 100%;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; color: var(--text-muted); font-weight: 500;">
        <span>Goedkoop (€${Math.round(minPrice)})</span>
        <span>Duur (€${Math.round(maxPrice)})</span>
      </div>
      <div style="height: 30px; width: 100%; border-radius: 8px; background: linear-gradient(to right, hsl(45, 100%, 55%), hsl(150, 100%, 20%)); box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);"></div>
    </div>
  `;
  
  wrap.innerHTML = html;
}
