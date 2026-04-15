const xlsx = require('xlsx');
const wb = xlsx.readFile('C:\\Users\\Wander\\OneDrive\\Documenten\\Gipfel\\pricing_sources\\pricing_05-02-2026.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
console.log(JSON.stringify(xlsx.utils.sheet_to_json(sheet).slice(0, 5), null, 2));
