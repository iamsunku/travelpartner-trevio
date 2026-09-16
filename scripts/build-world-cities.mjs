import fs from "node:fs";
import zlib from "node:zlib";

const gunzip = zlib.gunzipSync(fs.readFileSync("frontend/src/data/cities.json.gz"));
const cities = JSON.parse(gunzip.toString("utf8"));

const popularNames = new Set([
  "mumbai", "delhi", "new delhi", "bengaluru", "bangalore", "chennai", "hyderabad", "kolkata",
  "goa", "kochi", "pune", "jaipur", "dubai", "abu dhabi", "singapore", "bangkok", "phuket",
  "krabi", "pattaya", "kuala lumpur", "bali", "denpasar", "jakarta", "hong kong", "tokyo",
  "osaka", "seoul", "beijing", "shanghai", "london", "paris", "rome", "milan", "barcelona",
  "madrid", "amsterdam", "frankfurt", "munich", "zurich", "vienna", "istanbul", "doha",
  "new york", "los angeles", "san francisco", "chicago", "miami", "toronto", "vancouver",
  "sydney", "melbourne", "auckland", "cape town", "johannesburg", "nairobi", "cairo",
  "male", "malé", "colombo", "kathmandu", "dhaka", "islamabad", "karachi", "manila",
  "ho chi minh city", "hanoi", "yangon", "muscat", "riyadh", "jeddah", "sharjah",
]);

const seen = new Set();
/** @type {Array<{n:string,o:string,p?:1}>} */
const out = [];

for (const row of cities) {
  const name = String(row.name || "").trim();
  const country = String(row.country_name || "").trim();
  if (!name || !country) continue;
  const key = `${name.toLowerCase()}|${country.toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);
  /** @type {{n:string,o:string,p?:1}} */
  const item = { n: name, o: country };
  if (popularNames.has(name.toLowerCase())) item.p = 1;
  out.push(item);
}

out.sort((a, b) => a.n.localeCompare(b.n) || a.o.localeCompare(b.o));

const json = JSON.stringify(out);
fs.mkdirSync("frontend/public/data", { recursive: true });
fs.writeFileSync("frontend/public/data/world-cities.json", json);
fs.writeFileSync("frontend/src/data/world-cities.meta.json", JSON.stringify({ count: out.length, generatedAt: new Date().toISOString() }));

// cleanup heavy intermediates
fs.unlinkSync("frontend/src/data/cities.json.gz");
if (fs.existsSync("frontend/src/data/cities.raw.json")) fs.unlinkSync("frontend/src/data/cities.raw.json");

console.log("cities", out.length);
console.log("bytes", Buffer.byteLength(json));
console.log("sample", out.find((c) => c.n === "Phuket"), out.find((c) => /bengaluru|bangalore/i.test(c.n)));
