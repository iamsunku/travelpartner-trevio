import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const notifications = await db.notification.findMany({ orderBy: { createdAt: "desc" } });
    const unread = notifications.filter((n) => !n.read).length;
    return NextResponse.json({ notifications, unread });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, read } = await req.json();
    const notification = await db.notification.update({ where: { id }, data: { read } });
    return NextResponse.json({ notification });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
