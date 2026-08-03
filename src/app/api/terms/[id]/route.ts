import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

const confirmSchema = z.object({
  confirmName: z.string().trim().min(1),
});

export async function POST(req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const url = new URL(req.url);
  // Nested actions via query: ?action=clear|activate|hide|unhide
  // Also support path-style by checking Referer — prefer body.action
  const body = await req.json().catch(() => ({}));
  const action =
    (typeof body.action === "string" && body.action) ||
    url.searchParams.get("action") ||
    "";

  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) {
    return NextResponse.json({ error: "Term not found" }, { status: 404 });
  }

  if (action === "clear") {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success || parsed.data.confirmName !== term.name) {
      return NextResponse.json(
        {
          error:
            "Type the exact term name to confirm clearing rooms, payments, and students",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const [bookings, payments, students] = await prisma.$transaction([
      prisma.booking.updateMany({
        where: { termId: id, status: "ACTIVE" },
        data: { status: "ENDED" },
      }),
      prisma.payment.updateMany({
        where: { termId: id, clearedAt: null },
        data: { clearedAt: now },
      }),
      // Soft-hide roster from UX; free roomNumber unique for next intake
      prisma.student.updateMany({
        where: { clearedAt: null },
        data: { clearedAt: now, roomNumber: null },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        entity: "Term",
        entityId: id,
        action: "UPDATE",
        beforeJson: JSON.stringify({
          activeBookingsEnded: bookings.count,
          paymentsClearedFromUx: payments.count,
          studentsClearedFromUx: students.count,
        }),
        afterJson: JSON.stringify({
          termId: id,
          ended: bookings.count,
          paymentsCleared: payments.count,
          studentsCleared: students.count,
        }),
        userId: session.uid,
      },
    });

    return NextResponse.json({
      ok: true,
      ended: bookings.count,
      paymentsCleared: payments.count,
      studentsCleared: students.count,
    });
  }

  if (action === "activate") {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.term.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.term.update({
        where: { id },
        data: { isActive: true, hiddenAt: null },
      });
    });

    await prisma.auditLog.create({
      data: {
        entity: "Term",
        entityId: id,
        action: "UPDATE",
        beforeJson: JSON.stringify(term),
        afterJson: JSON.stringify(updated),
        userId: session.uid,
      },
    });

    return NextResponse.json({ term: updated });
  }

  if (action === "hide") {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (term.isActive) {
      return NextResponse.json(
        { error: "Ongoing semester cannot be removed from view" },
        { status: 400 }
      );
    }

    const updated = await prisma.term.update({
      where: { id },
      data: { hiddenAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        entity: "Term",
        entityId: id,
        action: "UPDATE",
        beforeJson: JSON.stringify(term),
        afterJson: JSON.stringify(updated),
        userId: session.uid,
      },
    });

    return NextResponse.json({ term: updated });
  }

  if (action === "unhide") {
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await prisma.term.update({
      where: { id },
      data: { hiddenAt: null },
    });

    await prisma.auditLog.create({
      data: {
        entity: "Term",
        entityId: id,
        action: "UPDATE",
        beforeJson: JSON.stringify(term),
        afterJson: JSON.stringify(updated),
        userId: session.uid,
      },
    });

    return NextResponse.json({ term: updated });
  }

  return NextResponse.json(
    { error: "Unknown action. Use clear, activate, hide, or unhide." },
    { status: 400 }
  );
}
