import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "stclare_session";
const IDLE_MS = Number(process.env.SESSION_IDLE_MS || 15 * 60 * 1000);
const ABSOLUTE_MS = Number(process.env.SESSION_ABSOLUTE_MS || 8 * 60 * 60 * 1000);
const REFRESH_THROTTLE_MS = 60_000;

function secretKey() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET || "st-clare-dev-jwt-secret-change-in-production-min-32-chars"
  );
}

type Role = "ADMIN" | "SECRETARY" | "MATRON" | "PARENT";

const STAFF_ROLES: Role[] = ["ADMIN", "SECRETARY", "MATRON"];

async function readSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as {
      uid: string;
      role: Role;
      name: string;
      phone?: string | null;
      lastActivity: number;
      iat?: number;
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname.startsWith("/admin");
  const isParent = pathname.startsWith("/parent");
  const isProtected = isAdmin || isParent;

  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const session = await readSession(token);
  if (!session) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  const lastMs = session.lastActivity * 1000;
  if (Date.now() - lastMs > IDLE_MS) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "idle");
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  if (isAdmin && !STAFF_ROLES.includes(session.role)) {
    return NextResponse.redirect(new URL("/parent", request.url));
  }
  if (isParent && session.role !== "PARENT" && !STAFF_ROLES.includes(session.role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Staff can peek parent portal; parents cannot access admin
  if (isParent && session.role === "PARENT") {
    // ok
  }

  const res = NextResponse.next();

  if (Date.now() - lastMs > REFRESH_THROTTLE_MS) {
    const now = Math.floor(Date.now() / 1000);
    const fresh = await new SignJWT({
      uid: session.uid,
      role: session.role,
      name: session.name,
      phone: session.phone ?? null,
      lastActivity: now,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(session.iat ?? now)
      .setExpirationTime((session.iat ?? now) + Math.floor(ABSOLUTE_MS / 1000))
      .sign(secretKey());

    res.cookies.set(COOKIE_NAME, fresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(ABSOLUTE_MS / 1000),
    });
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/parent/:path*"],
};
