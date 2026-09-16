import raw from "@/data/world-airports.json";

export type WorldAirport = {
  code: string;
  city: string;
  name: string;
  country: string;
  popular?: boolean;
};

type CompactAirport = { c: string; y: string; n: string; o: string; p?: number };

const COMPACT = raw as CompactAirport[];

export const WORLD_AIRPORTS: WorldAirport[] = COMPACT.map((a) => ({
  code: a.c,
  city: a.y,
  name: a.n,
  country: a.o,
  popular: a.p === 1,
}));

const BY_CODE = new Map(WORLD_AIRPORTS.map((a) => [a.code, a]));

export function airportByCode(code: string | undefined | null): WorldAirport | undefined {
  if (!code) return undefined;
  return BY_CODE.get(String(code).trim().toUpperCase());
}

/** Persist format: "BLR · Bangalore" (IATA + city). Legacy city-only values still accepted. */
export function formatAirportValue(a: WorldAirport): string {
  return `${a.code} · ${a.city}`;
}

export function parseAirportValue(value: string | undefined | null): { code: string; city: string; label: string } {
  const rawVal = String(value || "").trim();
  if (!rawVal) return { code: "", city: "", label: "" };
  const m = rawVal.match(/^([A-Za-z]{3})\s*[·•\-–—]?\s*(.*)$/);
  if (m) {
    const code = m[1].toUpperCase();
    const known = airportByCode(code);
    const city = (m[2] || "").trim() || known?.city || code;
    return { code, city, label: known ? formatAirportValue(known) : `${code} · ${city}` };
  }
  const byCity = WORLD_AIRPORTS.find((a) => a.city.toLowerCase() === rawVal.toLowerCase());
  if (byCity) return { code: byCity.code, city: byCity.city, label: formatAirportValue(byCity) };
  return { code: "", city: rawVal, label: rawVal };
}

/** IATA for flight origin default — empty if unknown. */
export function departureIata(value: string | undefined | null): string {
  return parseAirportValue(value).code;
}

export function searchWorldAirports(query: string, limit = 40): WorldAirport[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const popular = WORLD_AIRPORTS.filter((a) => a.popular);
    const rest = WORLD_AIRPORTS.filter((a) => !a.popular).slice(0, Math.max(0, limit - popular.length));
    return [...popular, ...rest].slice(0, limit);
  }
  const scored: Array<{ a: WorldAirport; score: number }> = [];
  for (const a of WORLD_AIRPORTS) {
    const code = a.code.toLowerCase();
    const city = a.city.toLowerCase();
    const name = a.name.toLowerCase();
    const country = a.country.toLowerCase();
    let score = 0;
    if (code === q) score = 100;
    else if (code.startsWith(q)) score = 90;
    else if (city === q) score = 80;
    else if (city.startsWith(q)) score = 70;
    else if (city.includes(q)) score = 50;
    else if (name.includes(q)) score = 40;
    else if (country.startsWith(q) || country.includes(q)) score = 20;
    else continue;
    if (a.popular) score += 5;
    scored.push({ a, score });
  }
  scored.sort((x, y) => y.score - x.score || x.a.city.localeCompare(y.a.city));
  return scored.slice(0, limit).map((s) => s.a);
}
