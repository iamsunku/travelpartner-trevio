import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const KNOWN = new Set([
  "Draft",
  "Awaiting Passenger Details",
  "Pending Initial Payment",
  "Partially Paid",
  "Payment Received",
  "In Progress",
  "Partially Confirmed",
  "Confirmed",
  "Travel Documents Ready",
  "Completed",
  "Cancelled",
  "Pending",
  "Ticketed",
  "Refunded",
  "Failed",
]);

const bookings = await db.booking.findMany({
  select: {
    id: true,
    bookingRef: true,
    quotationId: true,
    quotationVersionNumber: true,
    status: true,
    _count: { select: { passengers: true, services: true, documents: true } },
  },
});

const taskGroups = await db.task.groupBy({
  by: ["bookingId"],
  _count: { _all: true },
  where: { bookingId: { not: null } },
});

const missingQuote = bookings.filter((b) => !b.quotationId);
const missingRef = bookings.filter((b) => !b.bookingRef);
const statuses = [...new Set(bookings.map((b) => b.status))];
const unknownStatus = bookings.filter((b) => !KNOWN.has(b.status));
const qids = bookings.map((b) => b.quotationId).filter(Boolean);
const dupQuotes = qids.filter((id, i) => qids.indexOf(id) !== i);

console.log(
  JSON.stringify(
    {
      totalBookings: bookings.length,
      missingQuotationId: missingQuote.length,
      missingBookingRef: missingRef.length,
      withQuotationVersion: bookings.filter((b) => b.quotationVersionNumber != null).length,
      statusValues: statuses,
      unknownStatusCount: unknownStatus.length,
      duplicateQuotationIds: [...new Set(dupQuotes)].length,
      withPassengers: bookings.filter((b) => b._count.passengers > 0).length,
      withServices: bookings.filter((b) => b._count.services > 0).length,
      withDocuments: bookings.filter((b) => b._count.documents > 0).length,
      bookingsWithTasks: taskGroups.length,
      maxTasksOnOneBooking: taskGroups.reduce((m, t) => Math.max(m, t._count._all), 0),
      sampleMissingQuoteRefs: missingQuote.slice(0, 8).map((b) => b.bookingRef),
    },
    null,
    2,
  ),
);

await db.$disconnect();
