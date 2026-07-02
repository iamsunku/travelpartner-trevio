import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const service = searchParams.get("service");
    const search = searchParams.get("q");

    const where: Record<string, unknown> = {};
    if (status && status !== "All") where.status = status;
    if (service && service !== "All") where.service = service;
    if (search) where.customerName = { contains: search };

    const bookings = await db.booking.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ bookings, total: bookings.length });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const booking = await db.booking.create({
      data: {
        bookingRef: `BK-${Math.floor(10000 + Math.random() * 90000)}`,
        customerName: body.customerName,
        service: body.service,
        route: body.route,
        travelDate: body.travelDate,
        amount: body.amount,
        commission: body.commission || 0,
        status: "Pending",
        paymentStatus: "Pending",
        agentName: body.agentName || "System",
        agencyId: body.agencyId,
        agencyName: body.agencyName || "",
      },
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
