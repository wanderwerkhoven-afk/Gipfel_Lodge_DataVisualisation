// ./JS/core/dataManager.js
import { CONFIG, state, setState } from "./app.js";

/* ============================================================
 * 1) FILE UPLOAD (Excel -> state.rawRows)
 * ============================================================ */

export function bindFileUploads(selector, onLoaded) {
  document.querySelectorAll(selector).forEach((input) => {
    input.addEventListener("change", (e) => handleFileUpload(e, onLoaded));
  });
}

function handleFileUpload(event, onLoaded) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const normalized = normalizeRows(rows);
    setState({ rawRows: normalized });

    // defaults
    const years = getYears(normalized);
    if (years.length) {
      if (!years.includes(state.currentYear)) state.currentYear = years[0];
      if (state.cumulativeYear == null || !years.includes(state.cumulativeYear)) {
        state.cumulativeYear = state.currentYear;
      }
      if (state.occupancyYear == null || !years.includes(state.occupancyYear)) {
        state.occupancyYear = "ALL";
      }
    }

    onLoaded?.({ rows: normalized, years });
  };

  reader.readAsArrayBuffer(file);
  event.target.value = "";
}

/* ============================================================
 * 2) ROW HELPERS
 * ============================================================ */

export function getYears(rows = state.rawRows) {
  return [...new Set(rows.map(r => r.__aankomst.getFullYear()))]
    .sort((a, b) => b - a);
}

export function getRowsForYear(year, rows = state.rawRows) {
  return rows.filter(r => r.__aankomst.getFullYear() === year);
}

export function normalizeRows(rows) {
  return rows
    .map(r => {
      const aankomst = toDate(r["Aankomst"]);
      if (!aankomst) return null;

      const owner = isOwnerBooking(r);
      const gross = owner ? 0 : (toNumber(r["Inkomsten"]) ?? 0);

      return {
        ...r,
        __aankomst: aankomst,
        __nights: toNumber(r["Nachten"]) ?? 0,
        __owner: owner,
        __gross: gross,
        __net: gross * CONFIG.NET_FACTOR,
      };
    })
    .filter(Boolean);
}

/* ============================================================
 * 3) PRICING (JSON per jaar)
 * ============================================================ */

/**
 * Laadt pricing JSON via een repo-safe pad
 */
export async function loadPricingYear(year) {
  const url = new URL(`../JSON/pricing_${year}.json`, import.meta.url);
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Pricing file ontbreekt: ${url.href}`);
  }

  return res.json();
}

/**
 * Zorgt dat pricing één keer per jaar geladen wordt
 */
export async function ensurePricingLoadedForYear(year) {
  if (
    state.pricingYearLoaded === year &&
    state.pricingByDate &&
    Object.keys(state.pricingByDate).length
  ) {
    return;
  }

  try {
    const rows = await loadPricingYear(year);
    state.pricingByDate = Object.fromEntries(
      rows.map(r => [r.datum, r])
    );
    state.pricingYearLoaded = year;
  } catch (err) {
    console.warn(`Geen pricing voor jaar ${year}`, err);
    state.pricingByDate = {};
    state.pricingYearLoaded = year;
  }
}

/* ============================================================
 * 4) INTERNAL HELPERS
 * ============================================================ */

function isOwnerBooking(row) {
  const inc = row["Inkomsten"];
  if (typeof inc === "string" && inc.trim() === "-") return true;
  const boeking = String(row["Boeking"] || "").toLowerCase();
  return boeking.includes("huiseigenaar");
}

function toNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s === "-") return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "string") {
    const onlyDate = v.split(" ")[0].trim();
    const m = onlyDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}