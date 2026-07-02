import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { email, role } = await req.json();
    const user = await db.user.findFirst({
      where: { OR: [{ email }, ...(role ? [{ role }] : [])] },
      include: { agency: true, branch: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await db.auditLog.create({
      data: { userName: user.name, action: "Login", module: "Auth", ip: "0.0.0.0" },
    });
    return NextResponse.json({ user, token: `demo-${user.id}` });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
