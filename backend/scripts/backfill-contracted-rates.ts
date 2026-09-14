import { backfillMissingContractedRates } from "../src/lib/ensure-product-rates.js";

async function main() {
  const result = await backfillMissingContractedRates();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
