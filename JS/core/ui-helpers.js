import { state } from "./app.js";

export const CHART_COLORS = {
  blue: "#3b82f6",
  orange: "#f59e0b",
  green: "#10b981",
  red: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  cyan: "#06b6d4",
  gray: "rgba(255, 255, 255, 0.1)",
  text: "rgba(255, 255, 255, 0.5)",
  border: "rgba(255, 255, 255, 0.05)",
};

export const CHART_PALETTE = [
  "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e", "#14b8a6"
];

/* ============================================================
 * SCROLL PRESERVATION
 * ============================================================ */

export function ensureScrollState() {
  state.scroll ??= { windowY: 0, containers: {} };
  state.scroll.containers ??= {};
}

export function saveScrollPositions() {
  ensureScrollState();
  state.scroll.windowY = window.scrollY;

  document.querySelectorAll("[data-scroll-key]").forEach((el) => {
    const key = el.dataset.scrollKey;
    state.scroll.containers[key] = { x: el.scrollLeft, y: el.scrollTop };
  });
}

export function restoreScrollPositions() {
  ensureScrollState();
  window.scrollTo({ top: state.scroll.windowY || 0, behavior: "auto" });

  document.querySelectorAll("[data-scroll-key]").forEach((el) => {
    const key = el.dataset.scrollKey;
    const saved = state.scroll.containers[key];
    if (saved) {
      el.scrollLeft = saved.x || 0;
      el.scrollTop = saved.y || 0;
    }
  });
}

/**
 * Executes a function and restores scroll positions after the next frame.
 * @param {Function} fn 
 */
export function withPreservedScroll(fn) {
  saveScrollPositions();
  fn?.();
  requestAnimationFrame(() => requestAnimationFrame(restoreScrollPositions));
}

/* ============================================================
 * CUSTOM SELECT WIRE
 * ============================================================ */

/**
 * Wires up a custom select component.
 */
export function wireCustomYearSelect({ containerId, displayId, optionsId, hiddenId, years, get, set, onChange }) {
  const container = document.getElementById(containerId);
  const display = document.getElementById(displayId);
  const options = document.getElementById(optionsId);
  const hidden = document.getElementById(hiddenId);
  if (!container || !display || !options || !hidden) return;

  options.innerHTML = "";
  years.forEach((year) => {
    const div = document.createElement("div");
    div.className = "option";
    div.textContent = String(year);
    div.addEventListener("click", (e) => {
      e.stopPropagation();
      display.textContent = String(year);
      hidden.value = String(year);
      set(year);
      container.classList.remove("open");
      options.classList.remove("show");
      onChange?.();
    });
    options.appendChild(div);
  });

  const initial = get();
  display.textContent = String(initial);
  hidden.value = String(initial);
}

/* ============================================================
 * GLOBAL UI HANDLERS (Delegated)
 * ============================================================ */

export function initGlobalUI() {
    document.addEventListener("click", (e) => {
        // Custom select toggles (delegated)
        const select = e.target.closest(".custom-select");
        if (select && e.target.closest(".select-trigger")) {
            toggleCustomSelect(select);
            e.stopPropagation();
        } else {
            closeAllCustomSelects();
        }
    });
}

function toggleCustomSelect(container) {
    const isOpen = container.classList.contains("open");
    closeAllCustomSelects();
    if (!isOpen) {
        container.classList.add("open");
        container.querySelector(".select-options")?.classList.add("show");
    }
}

function closeAllCustomSelects() {
    document.querySelectorAll(".custom-select").forEach((c) => {
        c.classList.remove("open");
        c.querySelector(".select-options")?.classList.remove("show");
      });
}

/* ============================================================
 * FORMATTING HELPERS
 * ============================================================ */

/**
 * Formats a number as Euro currency.
 */
export function euro(x) {
  try {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(x));
  } catch {
    const n = Number(x);
    return Number.isFinite(n) ? `€${Math.round(n * 100) / 100}` : "—";
  }
}

/**
 * Formats a date as DD-MM-YYYY.
 */
export function fmtDateNL(d) {
  if (!d || !(d instanceof Date)) return "—";
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/**
 * Utility: Pad a number to 2 digits.
 */
export function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Utility: Clamp a number between a and b.
 */
export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Utility: Get the start of the day (00:00:00).
 */
export function startOfDay(d) {
  if (!d) return null;
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Utility: Add n days to a date.
 */
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/**
 * Utility: Get the difference in days between two dates.
 */
export function diffDays(a, b) {
  const A = startOfDay(a).getTime();
  const B = startOfDay(b).getTime();
  return Math.max(0, Math.round((B - A) / 86400000));
}

/**
 * Utility: Get the Monday of the week for a given date.
 */
export function startOfWeekMonday(d) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  return addDays(x, diff);
}

/**
 * Utility: Get the Sunday of the week for a given date.
 */
export function endOfWeekSunday(d) {
  return addDays(startOfWeekMonday(d), 6);
}

/**
 * Utility: Check if a booking intersects with a specific year.
 */
export function intersectsYear(b, year) {
  return b.start < new Date(year + 1, 0, 1) && b.end > new Date(year, 0, 1);
}

/**
 * Utility: Escapes HTML special characters.
 */
export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Utility: Get YYYY-MM-DD from a Date object (local time).
 */
export function toISODateLocal(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

/**
 * Utility: Renders a simple HTML table.
 */
export function renderSimpleTable({ container, headers, rows, emptyMsg = "Geen data beschikbaar" }) {
    if (!container) return;
    if (!rows || rows.length === 0) {
        container.innerHTML = `<p class="empty-msg">${emptyMsg}</p>`;
        return;
    }

    let html = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        ${headers.map(h => `<th>${h}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            ${row.map(cell => `<td>${cell ?? "—"}</td>`).join("")}
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;
}
