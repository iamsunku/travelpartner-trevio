import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const [
      totalAgencies, activeAgencies, totalBookings, totalCustomers,
      bookings, payments, agencies,
    ] = await Promise.all([
      db.agency.count(),
      db.agency.count({ where: { status: "Active" } }),
      db.booking.count(),
      db.customer.count(),
      db.booking.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
      db.payment.findMany({ take: 10, orderBy: { date: "desc" } }),
      db.agency.findMany({ orderBy: { monthlyRevenue: "desc" } }),
    ]);

    const totalRevenue = agencies.reduce((s, a) => s + a.monthlyRevenue, 0);
    const totalWallet = agencies.reduce((s, a) => s + a.walletBalance, 0);
    const totalCommission = agencies.reduce((s, a) => s + a.commissionEarned, 0);

    return NextResponse.json({
      stats: { totalAgencies, activeAgencies, totalBookings, totalCustomers, totalRevenue, totalWallet, totalCommission },
      recentBookings: bookings,
      recentPayments: payments,
      agencies,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
