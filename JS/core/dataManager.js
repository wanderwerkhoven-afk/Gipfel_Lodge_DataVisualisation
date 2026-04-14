// ./JS/core/dataManager.js
import { CONFIG, state, setState } from "./app.js";

/* ============================================================
 * 1) FILE UPLOAD (Excel -> state.rawRows)
 * ============================================================ */

export function bindFileUploads(selector, onLoaded) {
  document.querySelectorAll(selector).forEach((input) => {
    input.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleExcelUpload(file, onLoaded);
      e.target.value = "";
    });
  });
}

export function handleExcelUpload(file, onLoaded) {
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
}

/* ============================================================
 * 2) ROW HELPERS
 * ============================================================ */

export function getYears(rows = state.rawRows) {
  return [...new Set(rows.map(r => r.__aankomst.getFullYear()))]
    .sort((a, b) => a - b);
}

export function getRowsForYear(year, rows = state.rawRows) {
  return rows.filter(r => r.__aankomst.getFullYear() === year);
}

function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s === "-" || s === "—") return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function findCol(row, aliases) {
  for (const alias of aliases) {
    if (row[alias] !== undefined) return row[alias];
    // Case-insensitive search
    const key = Object.keys(row).find(k => k.trim().toLowerCase() === alias.toLowerCase());
    if (key) return row[key];
  }
  return null;
}

export function normalizeRows(rows) {
  if (!rows || !rows.length) return [];
  
  const normalized = rows
    .map((r) => {
      const aankomstRaw = findCol(r, ["Aankomst", "Check-in", "Arr", "Arrival", "Aank"]);
      const vertrekRaw = findCol(r, ["Vertrek", "Check-out", "Dep", "Departure", "Vertr"]);
      
      const aankomst = toDate(aankomstRaw);
      const vertrek = toDate(vertrekRaw);
      
      if (!aankomst) return null;

      const owner = isOwnerBooking(r);
      const inkomstenRaw = findCol(r, ["Inkomsten", "Revenue", "Gross", "Bedrag"]);
      const gross = owner ? 0 : (toNumber(inkomstenRaw) ?? 0);

      const adults = toNumber(findCol(r, ["Volw.", "Volwassenen", "Adults"])) ?? 0;
      const kids = toNumber(findCol(r, ["Knd.", "Kinderen", "Kids", "Children"])) ?? 0;
      const babies = toNumber(findCol(r, ["Bab.", "Babies", "Baby's"])) ?? 0;
      const totalGuests = adults + kids + babies;

      const nachtenRaw = findCol(r, ["Nachten", "Nights", "Nights Count"]);

      return {
        ...r,
        __aankomst: aankomst,
        __vertrek: vertrek,
        __nights: toNumber(nachtenRaw) ?? 0,
        __owner: owner,
        __gross: gross,
        __net: gross * CONFIG.NET_FACTOR,

        __bookingRaw: String(findCol(r, ["Boeking", "Booking", "Reference"]) || ""),
        __bookedAt: toDate(findCol(r, ["Geboekt op", "Booked at", "Booking Date"])),
        __accomCode: String(findCol(r, ["Accommodatiecode", "Code"]) || ""),
        __accomName: String(findCol(r, ["Accommodatie", "Accommodation"]) || ""),
        __guest: String(findCol(r, ["Gast", "Guest", "Name"]) || "Onbekende gast"),
        __email: String(findCol(r, ["E-mailadres", "Email", "Mail"]) || "").trim(),
        __phone: String(findCol(r, ["Telefoon", "Phone", "Tel"]) || ""),
        __countryCode: String(findCol(r, ["Land", "Country"]) || "").trim().toUpperCase(),
        __adults: adults,
        __kids: kids,
        __babies: babies,
        __totalGuests: totalGuests,
        __pets: toNumber(findCol(r, ["H.d.", "Pets", "Huisdieren"])) ?? 0,
        __note: String(findCol(r, ["Opmerking", "Note", "Comment"]) || ""),
      };
    })
    .filter(Boolean);

  console.log(`📊 Normalisatie voltooid: ${normalized.length}/${rows.length} rijen herkend.`);
  return normalized;
}

/* ============================================================
 * 3) PRICING (JSON per jaar)
 * ============================================================ */

/**
 * Laadt pricing JSON via een repo-safe pad
 */
export async function loadPricingYear(year) {
  const url = new URL(`../../pricing_sources/pricing_${year}.json`, import.meta.url);
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
 * 5) LOCALSTORAGE PERSISTENCE
 * ============================================================ */

const STORAGE_KEY = "gipfel_lodge_data";

export function saveToLocalStorage(rows) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    console.log("✅ Data opgeslagen in LocalStorage:", rows.length, "rijen.");
  } catch (err) {
    console.warn("LocalStorage save gefaald:", err);
  }
}

export function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    // Restore dates for ALL date fields
    return data.map(r => {
      if (r.__aankomst) r.__aankomst = new Date(r.__aankomst);
      if (r.__vertrek) r.__vertrek = new Date(r.__vertrek);
      if (r.__bookedAt) r.__bookedAt = new Date(r.__bookedAt);
      return r;
    });
  } catch (err) {
    console.warn("LocalStorage parse gefaald:", err);
    return null;
  }
}

function toDate(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 40000) {
    // Excel numeric date (days since 1900)
    return new Date((v - 25569) * 86400 * 1000);
  }

  if (typeof v === "string") {
    let s = v.trim();
    if (!s || s === "-" || s === "—") return null;

    // 1) Handle time suffix (e.g. "13-01-2026 16:00 - 18:00")
    if (s.includes(" ")) {
      s = s.split(" ")[0];
    }

    // 2) Try DD-MM-YYYY
    const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const d = new Date(+m[3], +m[2] - 1, +m[1]);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // 3) Try YYYY-MM-DD (ISO)
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) {
      const d = new Date(+mIso[1], +mIso[2] - 1, +mIso[3]);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    // Fallback: Default JS Date parsing
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  return null;
}

function isOwnerBooking(row) {
  const inc = row["Inkomsten"] || row["Revenue"] || row["Gross"] || "-";
  if (typeof inc === "string" && inc.trim() === "-") return true;
  const boeking = String(row["Boeking"] || row["Booking"] || "").toLowerCase();
  return boeking.includes("huiseigenaar") || boeking.includes("owner");
}