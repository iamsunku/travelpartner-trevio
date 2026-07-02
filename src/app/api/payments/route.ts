import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const method = searchParams.get("method");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (method && method !== "All") where.method = method;
    if (status && status !== "All") where.status = status;

    const payments = await db.payment.findMany({ where, orderBy: { date: "desc" } });
    const totalCollected = payments.filter((p) => p.status === "Success").reduce((s, p) => s + p.amount, 0);
    const totalRefunded = payments.filter((p) => p.status === "Refunded").reduce((s, p) => s + p.amount, 0);
    return NextResponse.json({ payments, total: payments.length, totalCollected, totalRefunded });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Simulate a Razorpay-style payment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, method, customerName, bookingRef } = body;
    // Simulate payment processing
    const success = Math.random() > 0.05; // 95% success
    const payment = await db.payment.create({
      data: {
        txnId: `pay_${Math.random().toString(36).slice(2, 12)}`,
        customerName: customerName || "Customer",
        bookingRef: bookingRef || `BK-${Math.floor(10000 + Math.random() * 90000)}`,
        amount,
        method: method || "Razorpay",
        status: success ? "Success" : "Failed",
        type: "Payment",
        gateway: "Razorpay",
      },
    });
    return NextResponse.json({ payment, success }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
