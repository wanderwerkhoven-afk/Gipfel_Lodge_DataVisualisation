import { state } from "../core/app.js";
import { getRowsForYear } from "../core/dataManager.js";

export function renderRevenueCharts() {
  if (!state.rawRows?.length) return;

  const rows = getRowsForYear(state.currentYear);
  renderRevenueByChannel(rows);
  renderGrossNetByMonth(rows);
  renderNightsByType(rows);
}

function renderRevenueByChannel(rows) {
  const canvas = document.getElementById("chartRevenueChannel");
  if (!canvas) return;

  const totals = new Map();
  rows.filter((r) => !r.__owner).forEach((r) => {
    const channel = r.__channel || "Onbekend";
    totals.set(channel, (totals.get(channel) || 0) + (r.__gross || 0));
  });

  const labels = [...totals.keys()];
  const data = [...totals.values()];

  resetChart("revenueByChannel");
  state.charts.revenueByChannel = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Bruto omzet",
        data,
        backgroundColor: "#3b82f6",
        borderRadius: 8,
      }],
    },
    options: baseMoneyOptions(),
  });
}

function renderGrossNetByMonth(rows) {
  const canvas = document.getElementById("chartRevenueMonthly");
  if (!canvas) return;

  const gross = Array(12).fill(0);
  const net = Array(12).fill(0);

  rows.filter((r) => !r.__owner).forEach((r) => {
    const m = r.__aankomst?.getMonth?.();
    if (m == null) return;
    gross[m] += r.__gross || 0;
    net[m] += r.__net || 0;
  });

  resetChart("revenueMonthly");
  state.charts.revenueMonthly = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: monthLabels(),
      datasets: [
        { label: "Bruto", data: gross, backgroundColor: "#3b82f6" },
        { label: "Netto", data: net, backgroundColor: "#22c55e" },
      ],
    },
    options: {
      ...baseMoneyOptions(),
      plugins: { legend: { labels: { color: "#d1d5db" } } },
    },
  });
}

function renderNightsByType(rows) {
  const canvas = document.getElementById("chartNightsType");
  if (!canvas) return;

  let ownerNights = 0;
  let platformNights = 0;

  rows.forEach((r) => {
    if (r.__owner) ownerNights += r.__nights || 0;
    else platformNights += r.__nights || 0;
  });

  resetChart("nightsByType");
  state.charts.nightsByType = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Platform", "Eigen gebruik"],
      datasets: [{ data: [platformNights, ownerNights], backgroundColor: ["#3b82f6", "#ff8a2a"] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { color: "#d1d5db" } } },
    },
  });
}

function baseMoneyOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: "#94a3b8",
          callback: (v) => `€ ${Number(v).toLocaleString("nl-NL")}`,
        },
        grid: { color: "rgba(255,255,255,0.08)" },
      },
      x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
    },
    plugins: { legend: { display: false } },
  };
}

function monthLabels() {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(state.currentYear, i, 1).toLocaleString("nl-NL", { month: "short" }).toUpperCase()
  );
}

function resetChart(key) {
  if (state.charts?.[key]) state.charts[key].destroy();
}
