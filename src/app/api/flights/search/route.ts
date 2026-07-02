import { NextRequest, NextResponse } from "next/server";
import { generateFlights } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const origin = searchParams.get("origin") || "BOM";
    const destination = searchParams.get("destination") || "DEL";
    const count = parseInt(searchParams.get("count") || "8");

    if (origin === destination) {
      return NextResponse.json({ error: "Origin and destination cannot be the same" }, { status: 400 });
    }
    const flights = generateFlights(origin.toUpperCase(), destination.toUpperCase(), count);
    return NextResponse.json({ flights, total: flights.length, origin, destination });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
