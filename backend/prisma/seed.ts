import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_USERS } from "../src/lib/mock-data";

const prisma = new PrismaClient();

const DEFAULT_SEED_PASSWORD = "Passw0rd@123";

async function main() {
  console.log("Seeding Travel Partner Pro database (login accounts only, no demo business data)...");
  const hashedPassword = await bcrypt.hash(DEFAULT_SEED_PASSWORD, 10);

  // One agency + branch — required so the agency_admin/branch_manager/employee/accountant
  // demo accounts have somewhere to belong. Everything else (bookings, customers, etc.)
  // starts empty; create real records through the app itself.
  await prisma.agency.upsert({
    where: { id: "ag-1" },
    update: {},
    create: {
      id: "ag-1",
      name: "Wanderlust Travels",
      owner: "Priya Sharma",
      email: "admin@wanderlusttravels.in",
      phone: "+91 98200 12345",
      plan: "Enterprise",
      status: "Active",
      apiAllocation: { flights: 50000, hotels: 30000 },
    },
  });

  await prisma.branch.upsert({
    where: { id: "br-1" },
    update: {},
    create: {
      id: "br-1",
      agencyId: "ag-1",
      name: "Mumbai - Andheri",
      manager: "Arjun Nair",
      city: "Mumbai",
    },
  });

  // Users (login accounts — one per role)
  for (const [, u] of Object.entries(ROLE_USERS)) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { password: hashedPassword },
      create: {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        password: hashedPassword,
        role: u.role,
        designation: u.designation,
        agencyId: u.agencyId,
        branchId: u.branchId,
        status: "Active",
      },
    });
  }

  console.log("Seed complete!");
  const counts = {
    agencies: await prisma.agency.count(),
    branches: await prisma.branch.count(),
    users: await prisma.user.count(),
  };
  console.log("Counts:", counts);
  console.log(`\nAll seeded users share the default password: ${DEFAULT_SEED_PASSWORD}\nChange it after first login in any real deployment.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
