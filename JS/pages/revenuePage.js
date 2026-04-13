// ./JS/pages/revenuePage.js
import { state } from "../core/app.js";

export const RevenuePage = {
  id: "revenue",
  title: "Omzet",
  template: () => `
    <header class="top-bar">
      <div class="header-flex">
        <button class="back-btn" data-nav="home"><i class="fa-solid fa-chevron-left"></i></button>
        <h1>Omzet & Prijs</h1>
      </div>
    </header>

    <div class="container">
      <div class="panel">
        <h3 class="panel-title">Omzet per kanaal</h3>
        <canvas id="chartRevenueChannel"></canvas>
      </div>
    </div>
  `,
  init: async () => {
    // Placeholder logic for revenue charts
    console.log("[Revenue] Initializing revenue charts...");
  }
};
