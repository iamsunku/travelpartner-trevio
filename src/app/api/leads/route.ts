import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get("stage");

    const where: Record<string, unknown> = {};
    if (stage && stage !== "All") where.stage = stage;

    const leads = await db.lead.findMany({ where, orderBy: { createdAt: "desc" } });
    const byStage = await db.lead.groupBy({ by: ["stage"], _count: true, _sum: { value: true } });
    return NextResponse.json({ leads, total: leads.length, byStage });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lead = await db.lead.create({
      data: {
        customerName: body.customerName, email: body.email, phone: body.phone,
        source: body.source, service: body.service, value: body.value,
        stage: "New", assignedTo: body.assignedTo || "Unassigned",
        expectedClose: body.expectedClose, notes: body.notes,
      },
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Move lead to a new stage (kanban drag)
export async function PATCH(req: NextRequest) {
  try {
    const { id, stage } = await req.json();
    const lead = await db.lead.update({ where: { id }, data: { stage } });
    return NextResponse.json({ lead });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
