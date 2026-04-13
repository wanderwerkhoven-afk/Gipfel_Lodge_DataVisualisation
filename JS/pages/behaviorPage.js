import { state } from "../core/app.js";
import { getRowsForYear } from "../core/dataManager.js";

export function renderGedragCharts() {
  if (!state.rawRows?.length) return;

  const rows = getRowsForYear(state.currentYear);
  renderLeadTimeHistogram(rows);
  renderGuestComposition(rows);
  renderCountryMix(rows);
}

function renderLeadTimeHistogram(rows) {
  const canvas = document.getElementById("chartLeadTime");
  if (!canvas) return;

  const buckets = {
    "0-7": 0,
    "8-30": 0,
    "31-90": 0,
    "90+": 0,
  };

  rows.forEach((r) => {
    const d = r.__leadTimeDays;
    if (d == null || !Number.isFinite(d)) return;
    if (d <= 7) buckets["0-7"] += 1;
    else if (d <= 30) buckets["8-30"] += 1;
    else if (d <= 90) buckets["31-90"] += 1;
    else buckets["90+"] += 1;
  });

  resetChart("leadTime");
  state.charts.leadTime = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: Object.keys(buckets),
      datasets: [{ label: "Aantal boekingen", data: Object.values(buckets), backgroundColor: "#8b5cf6" }],
    },
    options: barOptions(),
  });
}

function renderGuestComposition(rows) {
  const canvas = document.getElementById("chartGuestPie");
  if (!canvas) return;

  const adults = rows.reduce((s, r) => s + (r.__adults || 0), 0);
  const kids = rows.reduce((s, r) => s + (r.__kids || 0), 0);
  const babies = rows.reduce((s, r) => s + (r.__babies || 0), 0);

  resetChart("guestPie");
  state.charts.guestPie = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Volwassenen", "Kinderen", "Baby's"],
      datasets: [{ data: [adults, kids, babies], backgroundColor: ["#3b82f6", "#22c55e", "#f59e0b"] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: "#d1d5db" } } },
    },
  });
}

function renderCountryMix(rows) {
  const canvas = document.getElementById("chartCountryMix");
  if (!canvas) return;

  const totals = new Map();
  rows.forEach((r) => {
    const c = r.__country || "ONBEKEND";
    totals.set(c, (totals.get(c) || 0) + 1);
  });

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  resetChart("countryMix");
  state.charts.countryMix = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{ label: "Boekingen", data: sorted.map(([, v]) => v), backgroundColor: "#06b6d4" }],
    },
    options: barOptions(),
  });
}

function barOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,0.08)" } },
      x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
    },
  };
}

function resetChart(key) {
  if (state.charts?.[key]) state.charts[key].destroy();
}
