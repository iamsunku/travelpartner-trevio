/**
 * Inspect Genting / Langkawi hotel products + rates (PowerShell-safe).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

async function main() {
  const hotels = await db.hotelProduct.findMany({
    where: {
      country: "Malaysia",
      OR: [
        { city: { contains: "Genting", mode: "insensitive" } },
        { city: { contains: "Langkawi", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      city: true,
      starCategory: true,
      agencyId: true,
      currency: true,
      roomCategories: true,
      status: true,
      approvalStatus: true,
    },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  for (const h of hotels) {
    const rates = await db.contractedRate.findMany({
      where: { productType: "HOTEL", productId: h.id, active: true },
      select: {
        id: true,
        currency: true,
        contractedCost: true,
        validFrom: true,
        validTo: true,
        agencyId: true,
        rateUnit: true,
        metadata: true,
      },
      orderBy: [{ validFrom: "asc" }, { createdAt: "asc" }],
    });
    console.log(
      JSON.stringify(
        {
          hotel: {
            id: h.id,
            name: h.name,
            city: h.city,
            star: h.starCategory,
            agencyId: h.agencyId,
            currency: h.currency,
            status: h.status,
            rooms: h.roomCategories,
          },
          rates,
        },
        null,
        2,
      ),
    );
  }
  console.log(JSON.stringify({ hotelCount: hotels.length }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
