import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const transactions = await db.walletTransaction.findMany({ orderBy: { date: "desc" } });
    const agency = await db.agency.findFirst();
    const balance = agency?.walletBalance ?? 0;
    return NextResponse.json({ balance, transactions, total: transactions.length });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// Add money to wallet (simulated top-up)
export async function POST(req: Request) {
  try {
    const { amount, source = "Top-up" } = await req.json();
    const agency = await db.agency.findFirst();
    if (!agency) return NextResponse.json({ error: "No agency" }, { status: 404 });
    const newBalance = agency.walletBalance + amount;
    await db.agency.update({ where: { id: agency.id }, data: { walletBalance: newBalance } });
    const txn = await db.walletTransaction.create({
      data: {
        agencyId: agency.id, type: "Credit", source, amount, balance: newBalance,
        description: `Wallet ${source.toLowerCase()} of ₹${amount}`,
      },
    });
    return NextResponse.json({ txn, balance: newBalance }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
