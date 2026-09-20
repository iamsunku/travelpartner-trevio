import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ log: ["error"] });
const IMG = "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=800&q=80";
const rows = await db.transferProduct.findMany({
  where: { OR: [{ images: { equals: [] } }, { images: { equals: null as unknown as string[] } }] },
  select: { id: true, images: true },
  take: 200,
});
// Prisma JSON null check is awkward — update all Malaysia KTH transfers missing images
const all = await db.transferProduct.findMany({ select: { id: true, images: true, name: true } });
let n = 0;
for (const t of all) {
  const imgs = Array.isArray(t.images) ? (t.images as string[]).filter(Boolean) : [];
  if (imgs.length) continue;
  await db.transferProduct.update({ where: { id: t.id }, data: { images: [IMG] } });
  n += 1;
}
console.log({ updated: n, total: all.length, emptyProbe: rows.length });
await db.$disconnect();
