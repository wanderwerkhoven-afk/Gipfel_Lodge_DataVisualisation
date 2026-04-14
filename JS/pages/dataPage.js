import { state } from "../core/app.js";
import { 
  euro, 
  fmtDateNL, 
  renderSimpleTable 
} from "../core/ui-helpers.js";

export const DataPage = {
  id: "data",
  title: "Data",
  template: () => `
    <header class="top-bar">
      <div class="header-flex">
        <div class="header-titles">
          <h1>Data & Beheer</h1>
          <p class="subtitle">Importeer en doorzoek boekingen</p>
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

      <section class="content-section">
        <div class="search-panel">
          <div class="search-box">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="dataSearchInput" placeholder="Zoek op gast, boeking of land..." />
          </div>
          <div id="dataCount" class="data-count"></div>
        </div>

        <div id="dataTableWrap" class="table-wrap"></div>
      </section>
    </div>
  `,
  init: async () => {
    renderDataTable();
    setupSearch();
  }
};

function setupSearch() {
  const input = document.getElementById("dataSearchInput");
  if (!input) return;

  input.addEventListener("input", () => {
    state.dataSearchQuery = input.value.toLowerCase();
    renderDataTable();
  });
}

/**
 * Renders the interactive data table
 */
export function renderDataTable() {
  const container = document.getElementById("dataTableWrap");
  const countEl = document.getElementById("dataCount");
  if (!container) return;

  if (!state.rawRows || state.rawRows.length === 0) {
    container.innerHTML = `<div class="empty-state">Geen data geladen. Gebruik de upload knop erboven.</div>`;
    if (countEl) countEl.textContent = "";
    return;
  }

  const query = state.dataSearchQuery || "";
  const filtered = state.rawRows.filter(r => {
    const searchString = `${r.__guest} ${r.__bookingRaw} ${r.__countryCode} ${r.__email}`.toLowerCase();
    return searchString.includes(query);
  });

  if (countEl) countEl.textContent = `${filtered.length} boekingen gevonden`;

  const headers = [
    "Boeking", "Geboekt op", "Accommodatie", "Code",
    "Gast", "Email", "Telefoon", "Land",
    "Aankomst", "Vertrek", "Nachten",
    "Volw.", "Kind.", "Baby's", "Totaal", "Hsd.",
    "Bruto", "Netto", "Type", "Opmerking"
  ];

  const rows = filtered.map(r => [
    r.__bookingRaw        || "—",
    fmtDateNL(r.__bookedAt),
    r.__accomName         || "—",
    r.__accomCode         || "—",
    r.__guest             || "—",
    r.__email             || "—",
    r.__phone             || "—",
    r.__countryCode       || "—",
    fmtDateNL(r.__aankomst),
    fmtDateNL(r.__vertrek),
    r.__nights            ?? "—",
    r.__adults            ?? "—",
    r.__kids              ?? "—",
    r.__babies            ?? "—",
    r.__totalGuests       ?? "—",
    r.__pets              ?? "—",
    euro(r.__gross),
    euro(r.__net),
    r.__owner ? "🏠 Eigenaar" : "🌍 Platform",
    r.__note              || "—"
  ]);

  renderSimpleTable({
    container,
    headers,
    rows
  });
}
