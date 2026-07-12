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

  await prisma.supplier.upsert({
    where: { id: "sup-1" },
    update: {},
    create: {
      id: "sup-1",
      agencyId: "ag-1",
      name: "Global Stays India",
      contactPerson: "Ravi Kumar",
      email: "contracts@globalstays.in",
      phone: "+91 98765 11111",
      type: "Hotel",
      status: "Active",
    },
  });

  await prisma.hotelProduct.upsert({
    where: { id: "hp-1" },
    update: {},
    create: {
      id: "hp-1",
      agencyId: "ag-1",
      supplierId: "sup-1",
      name: "Taj Lands End",
      description: "Luxury waterfront hotel in Bandra with sea views and premium dining.",
      starCategory: 5,
      address: "Bandra West, Mumbai",
      city: "Mumbai",
      country: "India",
      mapsUrl: "https://maps.google.com/?q=Taj+Lands+End+Mumbai",
      amenities: ["Free WiFi", "Swimming Pool", "Spa", "Restaurant", "Airport Shuttle"],
      policies: { checkIn: "14:00", checkOut: "11:00", pets: "Not allowed" },
      contactPerson: "Front Desk",
      contactPhone: "+91 22 6668 1234",
      contactEmail: "reservations@tajlandsend.com",
      website: "https://www.tajhotels.com",
      images: ["https://example.com/taj-1.jpg", "https://example.com/taj-2.jpg"],
      roomCategories: [{
        name: "Deluxe Sea View",
        description: "King bed, sea view, breakfast included",
        maxOccupancy: 3,
        maxAdults: 2,
        maxChildren: 1,
        mealPlan: "CP",
        pricing: { single: 12000, double: 15000, extraAdult: 3000, extraChild: 1500 },
      }],
      currency: "INR",
      cancellationPolicy: "Free cancellation up to 72 hours before check-in",
      status: "Active",
    },
  });

  await prisma.activityProduct.upsert({
    where: { id: "ap-1" },
    update: {},
    create: {
      id: "ap-1",
      agencyId: "ag-1",
      name: "Dubai Desert Safari",
      description: "Evening desert safari with dune bashing, BBQ dinner and cultural show.",
      duration: "6 hours",
      location: "Dubai Desert Conservation Reserve",
      meetingPoint: "Hotel lobby pickup",
      inclusions: ["4x4 transfer", "BBQ dinner", "Live entertainment"],
      exclusions: ["Personal expenses", "Quad biking"],
      operatingHours: "15:00 - 21:00",
      minChildAge: 3,
      adultPrice: 4500,
      childPrice: 2500,
      currency: "INR",
      cancellationPolicy: "50% charge within 24 hours",
      status: "Active",
    },
  });

  await prisma.transferProduct.upsert({
    where: { id: "tp-1" },
    update: {},
    create: {
      id: "tp-1",
      agencyId: "ag-1",
      name: "Mumbai Airport Transfer",
      transferType: "Private",
      vehicleType: "Sedan",
      pickupLocation: "Chhatrapati Shivaji Maharaj International Airport",
      dropLocation: "South Mumbai Hotels",
      pickupTime: "On arrival",
      privatePrice: 2500,
      sharedPrice: 800,
      currency: "INR",
      cancellationPolicy: "Free cancellation up to 12 hours before pickup",
      status: "Active",
    },
  });

  console.log("Seed complete!");
  const counts = {
    agencies: await prisma.agency.count(),
    branches: await prisma.branch.count(),
    users: await prisma.user.count(),
    suppliers: await prisma.supplier.count(),
    hotels: await prisma.hotelProduct.count(),
    activities: await prisma.activityProduct.count(),
    transfers: await prisma.transferProduct.count(),
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
