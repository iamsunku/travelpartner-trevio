import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const agencies = await db.agency.findMany({
      orderBy: { monthlyRevenue: "desc" },
      include: { branches: true },
    });
    return NextResponse.json({ agencies, total: agencies.length });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const agency = await db.agency.create({
      data: {
        name: body.name, owner: body.owner, email: body.email, phone: body.phone,
        plan: body.plan || "Starter", status: "Trial",
        apiAllocation: JSON.stringify(body.apiAllocation || {}),
      },
    });
    return NextResponse.json({ agency }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
