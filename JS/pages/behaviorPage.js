// ./JS/pages/behaviorPage.js
import { state } from "../core/app.js";

export const BehaviorPage = {
  id: "behavior",
  title: "Gasten Gedrag",
  template: () => `
    <header class="top-bar">
      <div class="header-flex">
        <button class="back-btn" data-nav="home"><i class="fa-solid fa-chevron-left"></i></button>
        <h1>Gasten Gedrag</h1>
      </div>
    </header>

    <div class="container">
      <div class="panel">
        <h3 class="panel-title">Lead Time (Dagen voor aankomst)</h3>
        <canvas id="chartLeadTime"></canvas>
      </div>
      <div class="panel">
        <h3 class="panel-title">Gezinsverdeling</h3>
        <canvas id="chartGuestPie"></canvas>
      </div>
    </div>
  `,
  init: async () => {
    // renderGedragCharts is available in this scope
    renderGedragCharts();
  }
};

/**
 * Render functies voor de Gedrag-pagina.
 * Momenteel nog placeholders — voeg hier later je charts toe.
 */
export function renderGedragCharts() {
  if (!state.rawRows?.length) return;
  console.log("[Gedrag] renderGedragCharts aangeroepen — nog niet geïmplementeerd.");
}
