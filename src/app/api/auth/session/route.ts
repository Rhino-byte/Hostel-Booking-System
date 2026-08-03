import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyFirebaseIdToken, isAdminConfigured } from "@/lib/firebase-admin";
import { signSession, setSessionCookie } from "@/lib/session";

const schema = z.object({
  idToken: z.string().min(10),
});

export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured on the server" },
      { status: 503 }
    );
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const decoded = await verifyFirebaseIdToken(parsed.data.idToken);
  if (!decoded) {
    return NextResponse.json({ error: "Invalid Firebase token" }, { status: 401 });
  }

  const firebaseUid = decoded.uid;
  const email = decoded.email?.trim().toLowerCase() ?? null;

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { firebaseUid },
        ...(email ? [{ email }] : []),
      ],
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "No account for this email. Ask an administrator to add you.",
      },
      { status: 403 }
    );
  }

  if (!user.firebaseUid || user.firebaseUid !== firebaseUid) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid,
        ...(email && !user.email ? { email } : {}),
      },
    });
  } else if (email && user.email !== email) {
    // Keep email in sync when Firebase email is authoritative and unique
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: user.id } },
    });
    if (!taken) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { email },
      });
    }
  }

  const token = await signSession({
    uid: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
  });
  await setSessionCookie(token);

  const redirect = user.role === "PARENT" ? "/parent" : "/admin";

  return NextResponse.json({
    ok: true,
    role: user.role,
    name: user.name,
    redirect,
  });
}
