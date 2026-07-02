import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q");
    const tier = searchParams.get("tier");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (search) where.name = { contains: search };
    if (tier && tier !== "All") where.tier = tier;
    if (type && type !== "All") where.type = type;

    const customers = await db.customer.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ customers, total: customers.length });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const customer = await db.customer.create({
      data: {
        name: body.name, email: body.email, phone: body.phone,
        type: body.type || "Individual", tier: "Silver", city: body.city, agencyId: body.agencyId,
      },
    });
    return NextResponse.json({ customer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
