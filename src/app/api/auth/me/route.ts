import { NextResponse } from "next/server";
import {
  getSession,
  IDLE_MS,
  shouldRefreshActivity,
  signSession,
  setSessionCookie,
} from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let lastActivity = session.lastActivity;
  if (shouldRefreshActivity(session)) {
    lastActivity = Math.floor(Date.now() / 1000);
    const token = await signSession({
      uid: session.uid,
      role: session.role,
      name: session.name,
      phone: session.phone,
      lastActivity,
      iat: typeof session.iat === "number" ? session.iat : undefined,
    });
    await setSessionCookie(token);
  }

  const idleRemainingMs = Math.max(
    0,
    IDLE_MS - (Date.now() - lastActivity * 1000)
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
