// ./JS/ui.js
import { state, setState } from "./core/app.js";
import { handleExcelUpload, saveToLocalStorage, loadFromLocalStorage } from "./core/dataManager.js";
import { initGlobalUI, withPreservedScroll, ensureScrollState } from "./core/ui-helpers.js";

// Import Page Modules
import { HomePage } from "./pages/homePage.js";
import { OccupancyPage } from "./pages/occupancyPage.js";
import { RevenuePage } from "./pages/revenuePage.js";
import { BehaviorPage } from "./pages/behaviorPage.js";
import { DataPage } from "./pages/dataPage.js";

/* ============================================================
 * CONFIG & STATE
 * ============================================================ */

const sections = [
  HomePage,
  OccupancyPage,
  RevenuePage,
  BehaviorPage,
  DataPage
];

let currentSectionId = "home";
const initializedSections = new Set();

/* ============================================================
 * BOOT
 * ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  ensureScrollState();

  // 1. Herstel data uit localStorage
  const storedRows = loadFromLocalStorage();
  if (storedRows && storedRows.length) {
    setState({ rawRows: storedRows });

    const years = [...new Set(storedRows.map(r => r.__aankomst.getFullYear()))].sort((a, b) => b - a);
    if (years.length) {
      if (!state.currentYear || !years.includes(state.currentYear)) state.currentYear = years[0];
      if (!state.kpiYear || !years.includes(state.kpiYear)) state.kpiYear = years[0];
    }
  }

  // 2. Render alle secties in de DOM (templates injecteren)
  renderAllSections();

  // 3. Initialize Global UI & Events
  initGlobalUI();
  bindGlobalEvents();
  bindNavEvents();

  // 4. Start op de juiste tab (herstel uit hash of default naar home)
  const initialTab = window.location.hash.slice(1) || "home";

  requestAnimationFrame(() => {
    setTimeout(() => {
      switchSection(initialTab, false);
    }, 100);
  });

  // 5. Register Service Worker
  registerServiceWorker();
});

/* ============================================================
 * CORE NAVIGATION LOGIC
 * ============================================================ */

function renderAllSections() {
  const container = document.getElementById("app-content-slider");
  if (!container) return;

  container.innerHTML = "";
  sections.forEach((s) => {
    const el = document.createElement("div");
    el.id = `section-${s.id}`;
    el.className = "page-section";
    el.innerHTML = s.template();
    container.appendChild(el);
  });
}

/**
 * Switch naar een sectie. Voert Lazy Initialization uit if needed.
 */
export async function switchSection(id, animate = true) {
  const section = sections.find(s => s.id === id) || sections[0];
  currentSectionId = section.id;

  console.log(`🎯 Switching to: ${section.id}`);

  // Reset scroll naar boven omdat de topbar niet meer sticky is
  window.scrollTo(0, 0);

  // 1. Update UI (Nav & Title)
  updateNavUI(section.id);
  updateHeaderUI(section);

  // 2. Update Slider Position
  const slider = document.getElementById("app-content-slider");
  if (slider) {
    const index = sections.indexOf(section);
    slider.style.transition = animate ? "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)" : "none";
    slider.style.transform = `translateX(-${index * 100}vw)`;
  }

  // 3. LAZY INITIALIZATION & HEIGHT SYNC
  setTimeout(async () => {
    if (section.init) {
      console.log(`⚡ Initializing charts for section: ${section.id}`);
      try {
        await section.init();
        initializedSections.add(section.id);
      } catch (err) {
        console.error(`❌ Error initializing section ${section.id}:`, err);
      }
    }
    // Synchroniseer de hoogte van het viewport met de actieve sectie
    syncViewportHeight();
  }, animate ? 100 : 0);

  // 4. Update URL hash
  window.history.replaceState(null, null, `#${section.id}`);
}

/**
 * Zorgt dat het viewport niet hoger is dan de actieve sectie.
 * Dit voorkomt enorme 'lege' scrolruimte onderaan korte pagina's.
 */
export function syncViewportHeight() {
  const activeSection = document.getElementById(`section-${currentSectionId}`);
  const viewport = document.getElementById("app-viewport");
  if (!activeSection || !viewport) return;

  // Even resetten naar auto om de ware hoogte te meten
  viewport.style.height = "auto";

  requestAnimationFrame(() => {
    // Meet de werkelijke hoogte van de container binnen de sectie
    const container = activeSection.querySelector(".container");
    const height = container ? container.offsetHeight : activeSection.offsetHeight;

    // Zet de viewport hoogte vast op deze maat. 
    // De container heeft zelf al 70px padding-bottom om boven de nav te blijven.
    viewport.style.height = `${height}px`;
  });
}

function updateNavUI(id) {
  document.querySelectorAll(".nav-item").forEach((nav) => {
    nav.classList.toggle("active", nav.dataset.nav === id);
  });
}

function updateHeaderUI(section) {
  const titleEl = document.getElementById("global-title");
  const subtitleEl = document.getElementById("global-subtitle");

  if (titleEl) titleEl.textContent = `Gipfel ${section.title}`;

  if (subtitleEl) {
    const subtitles = {
      home: "Overzicht & KPI's",
      occupancy: "Bezetting & Gebruik",
      revenue: "Financiële inzichten",
      behavior: "Analyse van patronen",
      data: "Importeer en doorzoek boekingen"
    };
    subtitleEl.textContent = subtitles[section.id] || "Dashboard";
  }
}

function bindNavEvents() {
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      const id = item.dataset.nav;
      if (id) {
        switchSection(id);
        e.preventDefault();
      }
    });
  });
}

/* ============================================================
 * GLOBAL EVENTS & SW
 * ============================================================ */

function bindGlobalEvents() {
  document.addEventListener("change", (e) => {
    const input = e.target.closest(".excel-upload");
    if (!input || !input.files?.[0]) return;

    handleExcelUpload(input.files[0], ({ rows }) => {
      saveToLocalStorage(rows);
      // Bij nieuwe upload forceren we een re-init van de HUIDIGE sectie
      const currentSection = sections.find(s => s.id === currentSectionId);
      if (currentSection && currentSection.init) {
        withPreservedScroll(async () => {
          await currentSection.init();
          syncViewportHeight();
        });
      }
      // Markeer andere secties als needing refresh indien gewenst
      initializedSections.clear();
      initializedSections.add(currentSectionId);
    });

    input.value = "";
  });

  // Luister naar window resize om de hoogte te corrigeren
  window.addEventListener("resize", syncViewportHeight);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then(() => console.log("🚀 Service Worker geregistreerd."))
        .catch((err) => console.warn("SW registration failed:", err));
    });
  }
}