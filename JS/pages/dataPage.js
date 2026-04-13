// ./JS/pages/dataPage.js
import { state } from "../core/app.js";

export const DataPage = {
  id: "data",
  title: "Data Management",
  template: () => `
    <header class="top-bar">
      <div class="header-flex">
        <button class="back-btn" data-nav="home"><i class="fa-solid fa-chevron-left"></i></button>
        <h1>Data Management</h1>
      </div>
    </header>

    <div class="container">
      <div class="panel upload-zone">
        <h3 class="panel-title">Nieuwe data inladen</h3>
        <label class="upload-btn-full" for="fileInputData">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span>Selecteer Excel Bestand</span>
          <input id="fileInputData" class="excel-upload" type="file" accept=".xlsx,.xls,.csv" hidden />
        </label>
      </div>

      <div class="panel">
        <h3 class="panel-title">Systeem Log</h3>
        <pre id="log" class="log">Wachten op bestand...</pre>
      </div>

      <div id="tableWrap" class="table-wrap"></div>
    </div>
  `,
  init: async () => {
    // renderDataVisCharts is available in this scope
    renderDataVisCharts();
  }
};

/**
 * Render functies voor de Data-pagina.
 * Momenteel nog placeholders — voeg hier later je logica toe.
 */
export function renderDataVisCharts() {
    if (!state.rawRows?.length) return;
    console.log("[Data] renderDataVisCharts aangeroepen — nog niet geïmplementeerd.");
}
