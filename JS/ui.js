// ./JS/ui.js
import { state, setState } from "./core/app.js";
import { handleExcelUpload, saveToLocalStorage, loadFromLocalStorage } from "./core/dataManager.js";
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

  // 1. Herstel data uit localStorage (datum-objecten worden gedeserialiseerd door loadFromLocalStorage)
  const storedRows = loadFromLocalStorage();
  if (storedRows && storedRows.length) {
    setState({ rawRows: storedRows });

    // Zet standaard jaarselectie op basis van de data
    const years = [...new Set(storedRows.map(r => r.__aankomst.getFullYear()))].sort((a, b) => b - a);
    if (years.length) {
      if (!state.currentYear || !years.includes(state.currentYear)) state.currentYear = years[0];
      if (!state.kpiYear || !years.includes(state.kpiYear)) state.kpiYear = years[0];
    }
  }

  // 2. Initialize Router
  router = new Router(routes, "app-content");
  router.init();

  // 3. Initialize Global UI (delegated events)
  initGlobalUI();

  // 4. Global event bindings
  bindGlobalEvents();

  // 5. Register Service Worker for offline capability
  registerServiceWorker();
});

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          console.log("🚀 Service Worker geregistreerd voor offline gebruik.");
          
          // Optioneel: checken op updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  console.log("Nieuwe versie beschikbaar, herlaad de pagina.");
                  // Je zou hier een melding kunnen tonen aan de gebruiker
                } else {
                  console.log("App is nu offline beschikbaar!");
                }
              }
            };
          };
        })
        .catch((err) => console.warn("SW registration failed:", err));
    });
  }
}

function bindGlobalEvents() {
    // Gebruik event delegation op document zodat dynamisch ingevoegde upload-inputs
    // (door de router) ook worden afgevangen, ongeacht wanneer ze in de DOM worden gezet.
    document.addEventListener("change", (e) => {
        const input = e.target.closest(".excel-upload");
        if (!input || !input.files?.[0]) return;

        handleExcelUpload(input.files[0], ({ rows }) => {
            // handleExcelUpload zet rawRows al in state; hier slaan we op en herlaadden we de pagina
            saveToLocalStorage(rows);

            withPreservedScroll(() => {
                if (router.currentPage && router.currentPage.init) {
                    router.currentPage.init();
                }
            });
        });

        // Reset input zodat dezelfde file opnieuw geüpload kan worden
        input.value = "";
    });
}