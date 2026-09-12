import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
try {
  const [taxRulesTotal, taxRulesActive, quoteTemplates, flightProducts, mealProducts, hotelProducts, contractedRates, agencies] =
    await Promise.all([
      p.taxRule.count(),
      p.taxRule.count({ where: { active: true } }),
      p.quoteTemplate.count(),
      p.flightProduct.count(),
      p.mealProduct.count(),
      p.hotelProduct.count(),
      p.contractedRate.count(),
      p.agency.count(),
    ]);
  console.log(
    JSON.stringify(
      {
        agencies,
        taxRulesTotal,
        taxRulesActive,
        quoteTemplates,
        flightProducts,
        mealProducts,
        hotelProducts,
        contractedRates,
      },
      null,
      2,
    ),
  );
} finally {
  await p.$disconnect();
}
