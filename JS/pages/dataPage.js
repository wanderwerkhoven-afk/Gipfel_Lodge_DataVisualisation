import { state } from "../core/app.js";
import { getRowsForYear } from "../core/dataManager.js";

export function renderDataVisCharts() {
  const rows = state.rawRows || [];
  renderLog(rows);
  renderQualityCards(rows);
  renderDataTable(getRowsForYear(state.currentYear, rows));
  renderChannelQualityChart(rows);
}

function renderLog(rows) {
  const log = document.getElementById("log");
  if (!log) return;

  const owner = rows.filter((r) => r.__owner).length;
  const platform = rows.length - owner;
  const missingMail = rows.filter((r) => !r.__email).length;

  log.textContent = [
    `Rows ingeladen: ${rows.length}`,
    `Platform boekingen: ${platform}`,
    `Huiseigenaar boekingen: ${owner}`,
    `Ontbrekende e-mail: ${missingMail}`,
  ].join("\n");
}

function renderQualityCards(rows) {
  const target = document.getElementById("dataQualityCards");
  if (!target) return;

  const missingPhone = rows.filter((r) => !r.__phone).length;
  const missingCountry = rows.filter((r) => !r.__country).length;
  const missingLead = rows.filter((r) => !Number.isFinite(r.__leadTimeDays)).length;
  const invalidNights = rows.filter((r) => (r.__nights || 0) <= 0).length;

  const items = [
    ["Missende telefoon", missingPhone],
    ["Missend land", missingCountry],
    ["Geen lead time", missingLead],
    ["Ongeldige nachten", invalidNights],
  ];

  target.innerHTML = items
    .map(([label, value]) => `
      <div class="kpi-card">
        <span class="label">${label}</span>
        <span class="value">${value}</span>
      </div>
    `)
    .join("");
}

function renderDataTable(rows) {
  const wrap = document.getElementById("tableWrap");
  if (!wrap) return;

  if (!rows.length) {
    wrap.innerHTML = "<p class='subtitle'>Geen data geladen.</p>";
    return;
  }

  const headers = ["Boeking", "Kanaal", "Geboekt op", "Aankomst", "Vertrek", "Nachten", "Gast", "Land", "Inkomsten"];
  const body = rows
    .slice(0, 100)
    .map((r) => {
      const booked = fmtDate(r.__bookedOn);
      const arrival = fmtDate(r.__aankomst);
      const dep = fmtDate(r.__vertrek);
      return `
        <tr>
          <td>${escapeHtml(r.Boeking || "")}</td>
          <td>${escapeHtml(r.__channel || "")}</td>
          <td>${booked}</td>
          <td>${arrival}</td>
          <td>${dep}</td>
          <td>${r.__nights || 0}</td>
          <td>${escapeHtml(r.Gast || "")}</td>
          <td>${escapeHtml(r.__country || "")}</td>
          <td>${fmtMoney(r.__gross || 0)}</td>
        </tr>
      `;
    })
    .join("");

  wrap.innerHTML = `
    <table class="data-table">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderChannelQualityChart(rows) {
  const canvas = document.getElementById("chartDataChannel");
  if (!canvas) return;

  const channelStats = new Map();
  rows.forEach((r) => {
    const key = r.__channel || "Onbekend";
    const entry = channelStats.get(key) || { total: 0, missingEmail: 0 };
    entry.total += 1;
    if (!r.__email) entry.missingEmail += 1;
    channelStats.set(key, entry);
  });

  const labels = [...channelStats.keys()];
  const totals = labels.map((k) => channelStats.get(k).total);
  const missing = labels.map((k) => channelStats.get(k).missingEmail);

  if (state.charts?.dataChannel) state.charts.dataChannel.destroy();
  state.charts.dataChannel = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Boekingen", data: totals, backgroundColor: "#3b82f6" },
        { label: "Missende e-mail", data: missing, backgroundColor: "#ef4444" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: "#d1d5db" } } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,.08)" } },
        x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
      },
    },
  });
}

function fmtDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("nl-NL");
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
