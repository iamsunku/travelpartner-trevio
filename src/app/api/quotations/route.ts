import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const where: Record<string, unknown> = {};
    if (status && status !== "All") where.status = status;
    const quotations = await db.quotation.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ quotations, total: quotations.length });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const quotation = await db.quotation.create({
      data: {
        quoteNo: `QT-2025-${Math.floor(100 + Math.random() * 900)}`,
        customerName: body.customerName,
        service: body.service,
        items: body.items || 1,
        amount: body.amount,
        gst: body.gst || Math.round(body.amount * 0.18),
        total: body.total || body.amount + Math.round(body.amount * 0.18),
        status: "Draft",
        validTill: body.validTill,
        createdBy: body.createdBy || "System",
      },
    });
    return NextResponse.json({ quotation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
