/** Curated Unsplash hotel/room photos used when catalogue products have no images. */

const HOTEL_BY_CITY: Record<string, string[]> = {
  "kuala lumpur": [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
  ],
  "genting highlands": [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
  ],
  langkawi: [
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
  ],
  malaysia: [
    "https://images.unsplash.com/photo-1596422846543-75c6fc7107f2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
  ],
};

const ROOM_PHOTOS = [
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
];

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function pick(list: string[], seed: string): string {
  if (!list.length) return ROOM_PHOTOS[0];
  return list[hashSeed(seed) % list.length];
}

export function placeholderHotelImage(opts: {
  name?: string;
  city?: string;
  country?: string;
}): string {
  const city = String(opts.city || "").trim().toLowerCase();
  const name = String(opts.name || "hotel").trim();
  const pool =
    HOTEL_BY_CITY[city]
    || (String(opts.country || "").toLowerCase().includes("malaysia") ? HOTEL_BY_CITY.malaysia : null)
    || HOTEL_BY_CITY.malaysia;
  return pick(pool, `${city}|${name}`);
}

export function placeholderRoomImage(opts: {
  hotelName?: string;
  roomName?: string;
  city?: string;
}): string {
  const seed = `${opts.city || ""}|${opts.hotelName || ""}|${opts.roomName || "room"}`;
  return pick(ROOM_PHOTOS, seed);
}
