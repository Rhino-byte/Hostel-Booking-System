import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { pushStudentSummary } from "@/lib/sheet-sync";

const LIVE_PAYMENT_ERROR =
  "Cannot delete this student because a payment is recorded. Void the payment first or leave them on the roster.";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: { bookings: true, payments: true },
  });
  if (!student || student.clearedAt) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const hasLivePayments = student.payments.some(
    (p) => p.voidedAt == null && p.clearedAt == null
  );
  if (hasLivePayments) {
    return NextResponse.json({ error: LIVE_PAYMENT_ERROR }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const liveCount = await tx.payment.count({
        where: { studentId: id, voidedAt: null, clearedAt: null },
      });
      if (liveCount > 0) {
        throw new Error("LIVE_PAYMENTS");
      }

      const bookings = await tx.booking.findMany({
        where: { studentId: id },
      });

      for (const booking of bookings) {
        if (booking.status !== "ACTIVE") continue;
        const updated = await tx.booking.update({
          where: { id: booking.id },
          data: { status: "CANCELLED" },
        });
        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            action: "CANCEL",
            fromBedId: booking.bedId,
            note: "Student deleted",
            userId: session.uid,
          },
        });
        await tx.auditLog.create({
          data: {
            entity: "Booking",
            entityId: booking.id,
            action: "UPDATE",
            beforeJson: JSON.stringify(booking),
            afterJson: JSON.stringify(updated),
            userId: session.uid,
          },
        });
      }

      const leftover = await tx.booking.findMany({
        where: { studentId: id },
      });
      for (const booking of leftover) {
        await tx.auditLog.create({
          data: {
            entity: "Booking",
            entityId: booking.id,
            action: "DELETE",
            beforeJson: JSON.stringify(booking),
            userId: session.uid,
          },
        });
      }
      await tx.bookingEvent.deleteMany({
        where: { booking: { studentId: id } },
      });
      await tx.booking.deleteMany({ where: { studentId: id } });

      await tx.payment.deleteMany({ where: { studentId: id } });

      await tx.auditLog.create({
        data: {
          entity: "Student",
          entityId: id,
          action: "DELETE",
          beforeJson: JSON.stringify(student),
          userId: session.uid,
        },
      });

      await tx.student.delete({ where: { id } });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("LIVE_PAYMENTS")) {
      return NextResponse.json({ error: LIVE_PAYMENT_ERROR }, { status: 409 });
    }
    throw err;
  }

  if (student.sheetRowNo) {
    void pushStudentSummary(id).catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
