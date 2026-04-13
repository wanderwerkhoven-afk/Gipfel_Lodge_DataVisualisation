// ./JS/core/ui-helpers.js
import { state } from "./app.js";

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
