import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  deleteFirebaseAuthUser,
  isAdminConfigured,
  setFirebaseUserPassword,
} from "@/lib/firebase-admin";

const patchSchema = z.object({
  password: z.string().min(8),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured" },
      { status: 503 }
    );
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json(
      { error: "This user has no email; cannot set a password" },
      { status: 400 }
    );
  }

  try {
    const fbUser = await setFirebaseUserPassword({
      email,
      password: parsed.data.password,
      firebaseUid: user.firebaseUid,
      displayName: user.name,
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid: fbUser.uid,
        email,
      },
    });

    await prisma.auditLog.create({
      data: {
        entity: "User",
        entityId: user.id,
        action: "UPDATE",
        beforeJson: JSON.stringify({
          email: user.email,
          firebaseUid: user.firebaseUid,
        }),
        afterJson: JSON.stringify({
          email: updated.email,
          firebaseUid: updated.firebaseUid,
          passwordSet: true,
        }),
        userId: session.uid,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        firebaseUid: updated.firebaseUid,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not set Firebase password";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (id === session.uid) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let firebaseDeleted = false;
  if (isAdminConfigured() && (user.firebaseUid || user.email)) {
    try {
      const result = await deleteFirebaseAuthUser({
        firebaseUid: user.firebaseUid,
        email: user.email,
      });
      firebaseDeleted = result.deleted;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Could not delete Firebase Auth user";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  // Clear FKs that are not onDelete: SetNull so Prisma can delete the user
  await prisma.$transaction([
    prisma.payment.updateMany({
      where: { enteredById: id },
      data: { enteredById: null },
    }),
    prisma.booking.updateMany({
      where: { assignedById: id },
      data: { assignedById: null },
    }),
    prisma.bookingEvent.updateMany({
      where: { userId: id },
      data: { userId: null },
    }),
    prisma.auditLog.updateMany({
      where: { userId: id },
      data: { userId: null },
    }),
    prisma.syncLog.updateMany({
      where: { userId: id },
      data: { userId: null },
    }),
    prisma.studentGuardian.updateMany({
      where: { userId: id },
      data: { userId: null },
    }),
    prisma.auditLog.create({
      data: {
        entity: "User",
        entityId: id,
        action: "DELETE",
        beforeJson: JSON.stringify({
          name: user.name,
          email: user.email,
          role: user.role,
          firebaseUid: user.firebaseUid,
          firebaseDeleted,
        }),
        userId: session.uid,
      },
    }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({
    ok: true,
    firebaseDeleted,
  });
}
