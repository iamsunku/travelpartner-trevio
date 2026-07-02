import { NextRequest, NextResponse } from "next/server";
import { generateHotels } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city") || "Mumbai";
    const count = parseInt(searchParams.get("count") || "8");
    const hotels = generateHotels(city, count);
    return NextResponse.json({ hotels, total: hotels.length, city });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
