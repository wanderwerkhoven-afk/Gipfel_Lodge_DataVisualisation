const xlsx = require('xlsx');
const fs = require('fs');

const wb = xlsx.readFile('C:\\Users\\Wander\\OneDrive\\Documenten\\Web-apps\\Gipfel_Lodge_DataVisualisation_New\\Gipfel_Lodge_DataVisualisation_v2\\pricing_sources\\pricing_05-02-2026.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

const pricingByDate = {};

rows.forEach(r => {
  let dateVal = r.Datum || r.Dag;
  if (!dateVal) return;
  
  let jsDate;
  if (typeof dateVal === "number") {
    jsDate = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
  } else {
    jsDate = new Date(dateVal);
  }
  if (isNaN(jsDate.getTime())) return;
  
  const iso = jsDate.toISOString().split("T")[0];
  const dagprijsKey = Object.keys(r).find(k => k.toLowerCase().includes("dagprijs"));
  const weekprijsKey = Object.keys(r).find(k => k.toLowerCase().includes("weekprijs"));
  const minNachtKey = Object.keys(r).find(k => k.toLowerCase().includes("min. nacht"));
  
  pricingByDate[iso] = {
    dagprijs: Number(r[dagprijsKey]) || 0,
    weekprijs: Number(r[weekprijsKey]) || 0,
    minNachten: r[minNachtKey] || 0,
    periode: r.Periode || ""
  };
});

fs.writeFileSync('pricing_2026_hardcoded.json', JSON.stringify(pricingByDate, null, 2));
console.log('Saved to pricing_2026_hardcoded.json. Length:', Object.keys(pricingByDate).length);
