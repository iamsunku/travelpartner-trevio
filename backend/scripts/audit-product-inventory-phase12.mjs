import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const pkgs = await db.quotationPackage.findMany({
  select: { id: true, quotationId: true, flights: true, meals: true, transfers: true, activities: true },
});

let totalFlights = 0;
let missingSource = 0;
let contractedNoProduct = 0;
let mealsWithProduct = 0;
let totalMeals = 0;

for (const p of pkgs) {
  const flights = Array.isArray(p.flights) ? p.flights : [];
  for (const raw of flights) {
    if (!raw || typeof raw !== "object") continue;
    const f = raw;
    totalFlights += 1;
    if (!f.source) missingSource += 1;
    if (f.source === "CONTRACTED_PRODUCT" && !f.productId) contractedNoProduct += 1;
  }
  const meals = Array.isArray(p.meals) ? p.meals : [];
  for (const raw of meals) {
    if (!raw || typeof raw !== "object") continue;
    totalMeals += 1;
    if (raw.productId) mealsWithProduct += 1;
  }
}

const flightProducts = await db.flightProduct.count();
const mealProducts = await db.mealProduct.count();
const rates = await db.contractedRate.groupBy({
  by: ["productType"],
  _count: { _all: true },
});

console.log(
  JSON.stringify(
    {
      quotationPackages: pkgs.length,
      totalFlights,
      flightsMissingSource: missingSource,
      contractedFlightsMissingProductId: contractedNoProduct,
      totalMeals,
      mealsWithProductId: mealsWithProduct,
      flightProducts,
      mealProducts,
      contractedRatesByType: rates,
    },
    null,
    2,
  ),
);

await db.$disconnect();
