// ./parse_to_json.js
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Script to convert pricing Excel to JSON for internal application use.
 * Run with: node parse_to_json.js
 */

const baseDir = 'C:\\Users\\Wander\\OneDrive\\Documenten\\Web-apps\\Gipfel_Lodge_DataVisualisation_New\\Gipfel_Lodge_DataVisualisation_v2';
const priceFile = path.join(baseDir, 'pricing_sources', 'pricing_05-02-2026.xlsx');
const outputFile = path.join(baseDir, 'pricing_sources', 'pricing_2026.json');

if (!fs.existsSync(priceFile)) {
    console.error(`❌ Error: Input file not found at ${priceFile}`);
    process.exit(1);
}

console.log(`📖 Reading Excel: ${priceFile}`);
const wb = xlsx.readFile(priceFile);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

const pricingArray = [];

rows.forEach(r => {
  let dateVal = r.Datum || r.Dag || r.datum || r.dag;
  if (!dateVal) return;
  
  let jsDate;
  if (typeof dateVal === "number") {
    jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
  } else {
    jsDate = new Date(dateVal);
  }
  if (isNaN(jsDate.getTime())) return;
  
  const iso = jsDate.toISOString().split("T")[0];
  
  // Robust key finding
  const dagprijsKey = Object.keys(r).find(k => k.toLowerCase().includes("dagprijs"));
  const weekprijsKey = Object.keys(r).find(k => k.toLowerCase().includes("weekprijs"));
  const minNachtKey = Object.keys(r).find(k => k.toLowerCase().includes("min. nacht"));
  const seizoenKey = Object.keys(r).find(k => k.toLowerCase().includes("seizoen"));
  
  pricingArray.push({
    datum: iso,
    weekdag: iso,
    seizoen: r[seizoenKey] || r.Periode || "X",
    min_nachten_boeken: Number(r[minNachtKey]) || 0,
    dagprijs: Number(r[dagprijsKey]) || 0,
    weekprijs: Number(r[weekprijsKey]) || 0
  });
});

// Zorg dat de doeldirectory bestaat
const outputDir = path.dirname(outputFile);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputFile, JSON.stringify(pricingArray, null, 2));
console.log(`✅ Success: Updated ${outputFile}`);
console.log(`📈 Total dates processed: ${pricingArray.length}`);
