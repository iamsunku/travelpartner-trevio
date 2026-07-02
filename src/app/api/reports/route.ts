import { NextResponse } from "next/server";
import { REVENUE_DATA, BOOKING_TYPE_DATA, ENQUIRY_SOURCE_DATA, TOP_DESTINATIONS } from "@/lib/mock-data";

export async function GET() {
  try {
    return NextResponse.json({
      revenue: REVENUE_DATA,
      bookingTypes: BOOKING_TYPE_DATA,
      enquirySources: ENQUIRY_SOURCE_DATA,
      topDestinations: TOP_DESTINATIONS,
      summary: {
        totalRevenue: REVENUE_DATA.reduce((s, d) => s + d.revenue, 0),
        totalBookings: REVENUE_DATA.reduce((s, d) => s + d.bookings, 0),
        totalCommission: REVENUE_DATA.reduce((s, d) => s + d.commission, 0),
        avgMonthlyRevenue: Math.round(REVENUE_DATA.reduce((s, d) => s + d.revenue, 0) / REVENUE_DATA.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
