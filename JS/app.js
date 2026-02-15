




/*-- ============================================================
     3  BOTTOM NAVIGATION
     ============================================================ */

/* ============================================================
 * NAVIGATION LOGIC
 * ============================================================ */

function navigateTo(pageId) {
    console.log("Navigating to:", pageId);

    // 1. Alle pagina's verbergen
    // We zoeken naar alle elementen met class 'page'
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 2. De gekozen pagina tonen
    // We plakken '-page' achter de pageId (bijv. 'home' wordt 'home-page')
    const activePage = document.getElementById(pageId + '-page');
    if (activePage) {
        activePage.classList.add('active');
    }

    // 3. De Navigatie-icoontjes updaten
    // Verwijder 'active' van alle nav-items
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });

    // Voeg 'active' toe aan de knop waar op geklikt is
    const activeNav = document.getElementById('nav-' + pageId);
    if (activeNav) {
        activeNav.classList.add('active');
    }

    // 4. Extra acties per pagina (net als in je vorige app)
    if (pageId === 'home') {
        // Hier kun je functies aanroepen om de home-stats te verversen
        console.log("Welcome home!");
    }

    if (pageId === 'data') {
        // Actie als je op de data pagina komt
    }

    // Altijd even naar boven scrollen bij wissel
    window.scrollTo(0, 0);
}

// Onderaan je app.js
document.addEventListener('DOMContentLoaded', () => {
    // We starten op 'home', zorg dat dit overeenkomt met de ID 'home-page'
    navigateTo('home');
});











function computeKPIs(rows) {
    const platformRows = rows.filter(r => !r.__owner);
    const ownerRows = rows.filter(r => r.__owner);

    // 1. Boekingen & Nachten
    const bookings = platformRows.length;
    const ownerBookings = ownerRows.length;
    
    const nights = platformRows.reduce((s, r) => s + (r.__nights || 0), 0);
    const ownerNights = ownerRows.reduce((s, r) => s + (r.__nights || 0), 0);

    // 2. Bezetting (Berekening op basis van 365 dagen)
    const totalBookedNights = nights + ownerNights;
    const daysInYear = 365;
    const nightsFree = Math.max(0, daysInYear - totalBookedNights);
    const occupancyPct = (totalBookedNights / daysInYear);

    // 3. Omzet & Rendement
    const grossRevenue = platformRows.reduce((s, r) => s + (r.__gross || 0), 0);
    const netRevenue = platformRows.reduce((s, r) => s + (r.__net || 0), 0);

    const grossRevPerNight = nights > 0 ? grossRevenue / nights : 0;
    const netRevPerNight = nights > 0 ? netRevenue / nights : 0;

    return {
        bookings, ownerBookings,
        nights, ownerNights,
        nightsFree, occupancyPct,
        grossRevenue, netRevenue,
        grossRevPerNight, netRevPerNight
    };
}

function renderKPIs(rows) {
    const k = computeKPIs(rows);

    // Tekstuele waarden
    document.getElementById("kpiBookings").textContent = k.bookings;
    document.getElementById("kpiOwnerBookings").textContent = k.ownerBookings;
    document.getElementById("kpiNights").textContent = k.nights;
    document.getElementById("kpiOwnerNights").textContent = k.ownerNights;
    document.getElementById("kpiNightsFree").textContent = k.nightsFree;
    
    // Percentage & Euro's
    document.getElementById("kpiOccupancyPct").textContent = (k.occupancyPct * 100).toFixed(1) + "%";
    document.getElementById("kpiGrossRevenue").textContent = fmtEUR(k.grossRevenue);
    document.getElementById("kpiNetRevenue").textContent = fmtEUR(k.netRevenue);
    document.getElementById("kpiGrossRevPerNight").textContent = fmtEUR(k.grossRevPerNight);
    document.getElementById("kpiNetRevPerNight").textContent = fmtEUR(k.netRevPerNight);
}










// ========= Config & State =========
const NET_FACTOR = 0.76; //
let rawRows = [];

// ========= Event Listeners =========
document.getElementById('fileInput').addEventListener('change', handleFileUpload);

// ========= Core Logic =========
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Gebruik de inspiratie code om data te normaliseren
        rawRows = normalizeRows(jsonData);
        
        // Update de Dashboard KPI's
        renderKPIs(rawRows);
        console.log("Dashboard succesvol bijgewerkt!");
    };
    reader.readAsArrayBuffer(file);
}

// ========= De 'Inspiratie' Functies =========

function normalizeRows(rows) {
    return rows.map((r) => {
        const aankomst = toDate(r["Aankomst"]);
        const owner = isOwnerBooking(r);
        const gross = owner ? 0 : (toNumber(r["Inkomsten"]) ?? 0);

        return {
            ...r,
            __aankomst: aankomst,
            __nights: toNumber(r["Nachten"]) ?? 0,
            __owner: owner,
            __gross: gross,
            __net: gross * NET_FACTOR,
        };
    }).filter(r => r.__aankomst); // Alleen rijen met een geldige datum
}

function isOwnerBooking(row) {
    const inc = row["Inkomsten"];
    // Als inkomsten een '-' is of de tekst 'huiseigenaar' bevat
    if (typeof inc === "string" && inc.trim() === "-") return true;
    const boeking = String(row["Boeking"] || "").toLowerCase();
    return boeking.includes("huiseigenaar");
}


// ========= Helpers =========
function toNumber(v) {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
        const n = Number(v.replace(",", "."));
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

function toDate(v) {
    if (v instanceof Date) return v;
    if (typeof v === "string") {
        const onlyDate = v.split(" ")[0].trim();
        const m = onlyDate.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (m) return new Date(m[3], m[2] - 1, m[1]);
    }
    return null;
}

function fmtEUR(n) {
    if (!n || !Number.isFinite(n)) return "€ 0,00";
    return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}