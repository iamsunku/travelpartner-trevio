import fs from "node:fs";

const raw = fs.readFileSync("frontend/src/data/airports.dat", "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);
const popular = new Set([
  "BOM", "DEL", "BLR", "MAA", "HYD", "CCU", "GOI", "DXB", "SIN", "BKK",
  "LHR", "JFK", "LAX", "SYD", "DOH", "IST", "CDG", "FRA", "AMS", "HKG",
  "NRT", "ICN", "DPS", "MLE", "AUH", "KUL", "HKT", "ORD", "DXB",
]);

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  fields.push(cur);
  return fields;
}

const out = [];
const seen = new Set();
for (const line of lines) {
  const f = parseCsvLine(line);
  if (f.length < 6) continue;
  const name = f[1] || "";
  const city = f[2] || "";
  const country = f[3] || "";
  const iata = (f[4] || "").trim();
  if (!iata || iata === "\\N" || iata.length !== 3) continue;
  const code = iata.toUpperCase();
  if (seen.has(code)) continue;
  seen.add(code);
  /** @type {{c:string,y:string,n:string,o:string,p?:number}} */
  const row = { c: code, y: city, n: name, o: country };
  if (popular.has(code)) row.p = 1;
  out.push(row);
}

out.sort((a, b) => a.c.localeCompare(b.c));
fs.writeFileSync("frontend/src/data/world-airports.json", JSON.stringify(out));
fs.unlinkSync("frontend/src/data/airports.dat");
console.log("count", out.length, "bytes", fs.statSync("frontend/src/data/world-airports.json").size);
console.log("BLR", out.find((a) => a.c === "BLR"));
console.log("JFK", out.find((a) => a.c === "JFK"));
