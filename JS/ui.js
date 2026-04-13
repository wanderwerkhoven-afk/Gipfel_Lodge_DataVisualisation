// ./JS/ui.js
import { state, setState } from "./core/app.js";
import { bindFileUploads, saveToLocalStorage, loadFromLocalStorage } from "./core/dataManager.js";
import Router from "./core/router.js";
import { initGlobalUI, withPreservedScroll, ensureScrollState } from "./core/ui-helpers.js";

// Import Page Modules
import { HomePage } from "./pages/homePage.js";
import { OccupancyPage } from "./pages/occupancyPage.js";
import { RevenuePage } from "./pages/revenuePage.js";
import { BehaviorPage } from "./pages/behaviorPage.js";
import { DataPage } from "./pages/dataPage.js";

/* ============================================================
 * ROUTER SETUP
 * ============================================================ */

const routes = [
  HomePage,
  OccupancyPage,
  RevenuePage,
  BehaviorPage,
  DataPage
];

let router;

/* ============================================================
 * BOOT
 * ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  ensureScrollState();

  // Initialize Router
  router = new Router(routes, "app-content");
  router.init();

  // Initialize Global UI (delegated events)
  initGlobalUI();

  // Global event bindings
  bindGlobalEvents();

  // First data load
  const storedRows = loadFromLocalStorage();
  if (storedRows && storedRows.length) {
    setState({ rawRows: storedRows });
  }
});

function bindGlobalEvents() {
    // We bind file uploads globally because the input can be in the header (shared)
    // or on the data page.
    bindFileUploads(".excel-upload", ({ rows }) => {
        saveToLocalStorage(rows);
        withPreservedScroll(() => {
          // Re-initialize current page logic with new data
          if (router.currentPage && router.currentPage.init) {
              router.currentPage.init();
          }
        });
      });
}