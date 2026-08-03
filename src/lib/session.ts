import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";

export type SessionPayload = {
  uid: string;
  role: Role;
  name: string;
  phone?: string | null;
  iat: number;
  lastActivity: number;
};

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "stclare_session";
export const IDLE_MS = Number(process.env.SESSION_IDLE_MS || 15 * 60 * 1000);
export const ABSOLUTE_MS = Number(process.env.SESSION_ABSOLUTE_MS || 8 * 60 * 60 * 1000);
const REFRESH_THROTTLE_MS = 60_000;

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: Omit<SessionPayload, "iat" | "lastActivity"> & {
    lastActivity?: number;
  }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    uid: payload.uid,
    role: payload.role,
    name: payload.name,
    phone: payload.phone ?? null,
    lastActivity: payload.lastActivity ?? now,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(ABSOLUTE_MS / 1000))
    .sign(secretKey());
}

export async function verifySession(
  token: string
): Promise<(SessionPayload & JWTPayload) | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.uid !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.lastActivity !== "number"
    ) {
      return null;
    }
    return payload as SessionPayload & JWTPayload;
  } catch {
    return null;
  }
}

export function isIdle(session: SessionPayload): boolean {
  const last = session.lastActivity * 1000;
  return Date.now() - last > IDLE_MS;
}

export function shouldRefreshActivity(session: SessionPayload): boolean {
  const last = session.lastActivity * 1000;
  return Date.now() - last > REFRESH_THROTTLE_MS;
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session || isIdle(session)) return null;
  return session;
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
