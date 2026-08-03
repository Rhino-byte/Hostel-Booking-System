import { NextResponse } from "next/server";
import { getSession, IDLE_MS } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const idleRemainingMs = Math.max(
    0,
    IDLE_MS - (Date.now() - session.lastActivity * 1000)
  );
  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.uid,
      name: session.name,
      role: session.role,
      phone: session.phone,
    },
    idleRemainingMs,
    idleMs: IDLE_MS,
  });
}
