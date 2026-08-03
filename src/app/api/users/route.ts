import { NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  createFirebaseAuthUser,
  isAdminConfigured,
} from "@/lib/firebase-admin";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "SECRETARY", "MATRON", "PARENT"]),
  password: z.string().min(8).optional().or(z.literal("")),
});

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      firebaseUid: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password?.trim() || "";

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  let firebaseUid: string | null = null;

  if (password) {
    if (!isAdminConfigured()) {
      return NextResponse.json(
        {
          error:
            "Firebase Admin is not configured; omit password to invite for Google sign-in only, or configure Admin credentials.",
        },
        { status: 503 }
      );
    }
    try {
      const fbUser = await createFirebaseAuthUser({
        email,
        password,
        displayName: parsed.data.name,
      });
      firebaseUid = fbUser.uid;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not create Firebase Auth user";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      role: parsed.data.role as Role,
      firebaseUid,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      userId: session.uid,
      afterJson: JSON.stringify({
        email: user.email,
        role: user.role,
        hasPassword: Boolean(password),
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      firebaseUid: user.firebaseUid,
    },
  });
}
