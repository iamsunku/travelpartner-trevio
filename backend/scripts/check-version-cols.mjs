import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const cols = await db.$queryRawUnsafe(
  `SELECT column_name FROM information_schema.columns WHERE table_name='QuotationDocument' AND column_name IN ('versionNumber','quotationVersionId')`,
);
const share = await db.$queryRawUnsafe(
  `SELECT column_name FROM information_schema.columns WHERE table_name='QuotationShare' AND column_name='versionNumber'`,
);
const mig = await db.$queryRawUnsafe(
  `SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%version%' OR migration_name LIKE '%202609122%' ORDER BY finished_at DESC NULLS LAST LIMIT 10`,
);
console.log(JSON.stringify({ cols, share, mig }, null, 2));
await db.$disconnect();
