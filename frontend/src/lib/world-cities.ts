export type WorldCity = {
  name: string;
  country: string;
  popular?: boolean;
};

type CompactCity = { n: string; o: string; p?: number };

let cache: CompactCity[] | null = null;
let loadPromise: Promise<CompactCity[]> | null = null;

function toWorldCity(row: CompactCity): WorldCity {
  return {
    name: row.n,
    country: row.o,
    popular: row.p === 1,
  };
}

/** Lazy-load ~140k world cities from static public data (once per session). */
export async function loadWorldCities(): Promise<CompactCity[]> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      const res = await fetch("/data/world-cities.json");
      if (!res.ok) throw new Error(`Failed to load cities (${res.status})`);
      // Parse off the critical path a tick so the dropdown can paint "Loading…"
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const rows = (await res.json()) as CompactCity[];
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("City list is empty");
      }
      cache = rows;
      return cache;
    })().catch((err) => {
      loadPromise = null;
      throw err;
    });
  }
  return loadPromise;
}

export function formatCityValue(city: WorldCity): string {
  return `${city.name}, ${city.country}`;
}

export function parseCityValue(value: string | undefined | null): { name: string; country: string; label: string } {
  const raw = String(value || "").trim();
  if (!raw) return { name: "", country: "", label: "" };
  const m = raw.match(/^(.+?),\s*(.+)$/);
  if (m) {
    return { name: m[1].trim(), country: m[2].trim(), label: `${m[1].trim()}, ${m[2].trim()}` };
  }
  return { name: raw, country: "", label: raw };
}

export function searchWorldCities(cities: CompactCity[], query: string, limit = 40): WorldCity[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    const popular: WorldCity[] = [];
    for (const c of cities) {
      if (c.p !== 1) continue;
      popular.push(toWorldCity(c));
      if (popular.length >= limit) break;
    }
    if (popular.length) return popular;
    return cities.slice(0, limit).map(toWorldCity);
  }

  const exact: WorldCity[] = [];
  const starts: WorldCity[] = [];
  const includes: WorldCity[] = [];
  const countryHits: WorldCity[] = [];

  for (const c of cities) {
    const name = c.n.toLowerCase();
    const country = c.o.toLowerCase();
    if (name === q) exact.push(toWorldCity(c));
    else if (name.startsWith(q)) starts.push(toWorldCity(c));
    else if (name.includes(q)) includes.push(toWorldCity(c));
    else if (country.startsWith(q) || country.includes(q)) countryHits.push(toWorldCity(c));
    else continue;

    if (exact.length + starts.length >= limit) break;
  }

  return [...exact, ...starts, ...includes, ...countryHits].slice(0, limit);
}

/** Warm the cache so the first dropdown open is fast. */
export function preloadWorldCities(): void {
  void loadWorldCities().catch(() => undefined);
}
