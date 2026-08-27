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
        ...(email
          ? [{ email: { equals: email, mode: "insensitive" as const } }]
          : []),
      ],
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: email
          ? `No account for ${email}. Ask an administrator to add this exact email in Settings → Users.`
          : "No account found for this sign-in. Ask an administrator to add you.",
      },
      { status: 403 }
    );
  }

  if (!user.firebaseUid || user.firebaseUid !== firebaseUid) {
    // Avoid unique conflicts if another row already holds this UID
    await prisma.user.updateMany({
      where: { firebaseUid, NOT: { id: user.id } },
      data: { firebaseUid: null },
    });
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid,
        ...(email && !user.email ? { email } : {}),
      },
    });
  }

  // Normalize stored email to the Firebase email when safe
  if (email && user.email?.toLowerCase() !== email) {
    const taken = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        NOT: { id: user.id },
      },
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
