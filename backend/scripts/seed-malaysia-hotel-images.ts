/**
 * Attach placeholder Unsplash images to Malaysia hotels that have none.
 * Usage: npx tsx scripts/seed-malaysia-hotel-images.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

const HOTEL_BY_CITY: Record<string, string[]> = {
  "Kuala Lumpur": [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
  ],
  "Genting Highlands": [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
  ],
  Langkawi: [
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=80",
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
  return list[hashSeed(seed) % list.length];
}

async function main() {
  const hotels = await db.hotelProduct.findMany({ where: { country: "Malaysia" } });
  let updated = 0;
  for (const h of hotels) {
    const pool = HOTEL_BY_CITY[h.city || ""] || HOTEL_BY_CITY["Kuala Lumpur"];
    const hero = pick(pool, h.name);
    const rooms = Array.isArray(h.roomCategories)
      ? (h.roomCategories as Array<Record<string, unknown>>)
      : [];
    const nextRooms = rooms.map((room, idx) => {
      const name = String(room.name || `Room ${idx + 1}`);
      const existing = Array.isArray(room.images) ? (room.images as string[]).filter(Boolean) : [];
      return {
        ...room,
        images: existing.length ? existing : [pick(ROOM_PHOTOS, `${h.name}|${name}`)],
        refundable: room.refundable !== false,
        mealPlan: room.mealPlan || "Breakfast",
      };
    });
    const existingImages = Array.isArray(h.images) ? (h.images as string[]).filter(Boolean) : [];
    await db.hotelProduct.update({
      where: { id: h.id },
      data: {
        images: existingImages.length ? existingImages : [hero],
        roomCategories: nextRooms,
        address: h.address || `${h.city}, Malaysia`,
        description:
          h.description
          || `${h.name} is a contracted ${h.starCategory || ""}-star stay in ${h.city}, Malaysia. Rates are from the Malaysia contracted rate sheet (USD converted to INR).`,
      },
    });
    updated += 1;
    console.log(`✓ ${h.city} · ${h.name}`);
  }
  console.log({ updated });
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
