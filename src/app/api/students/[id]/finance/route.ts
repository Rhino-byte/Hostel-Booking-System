import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getStudentTermBalance } from "@/lib/balances";
import { getLatestEditablePaymentId } from "@/lib/payment-editable";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const termIdParam = new URL(req.url).searchParams.get("termId");

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.clearedAt) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const term = termIdParam
    ? await prisma.term.findUnique({ where: { id: termIdParam } })
    : await prisma.term.findFirst({ where: { isActive: true } });

  if (!term) {
    return NextResponse.json({ error: "No term configured" }, { status: 404 });
  }

  const bal = await getStudentTermBalance(id, term.id);

  const allPayments = await prisma.payment.findMany({
    where: { studentId: id, termId: term.id, clearedAt: null },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: { enteredBy: { select: { name: true } } },
  });

  const latestEditablePaymentId = await getLatestEditablePaymentId(id, term.id);

  const booking = bal.booking;
  const roomLabel = booking
    ? `${booking.bed.room.block.code} · Room ${booking.bed.room.number}${
        booking.bed.label !== "1" ? ` · Bed ${booking.bed.label}` : ""
      }`
    : student.roomNumber || null;

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      admissionNo: student.admissionNo,
      roomNumber: student.roomNumber,
    },
    term: {
      id: term.id,
      name: term.name,
      isActive: term.isActive,
    },
    room: roomLabel,
    blockCode: booking?.bed.room.block.code ?? null,
    bedLabel: booking?.bed.label ?? null,
    roomNumberBooked: booking?.bed.room.number ?? null,
    residence: booking
      ? {
          code: booking.residenceType.code,
          label: booking.residenceType.label,
          feeKes: booking.residenceType.feeKes,
        }
      : null,
    feeDue: bal.feeDue,
    feePaid: bal.feePaid,
    feeBalance: bal.feeBalance,
    status: bal.status,
    hasActiveBooking: Boolean(booking),
    latestEditablePaymentId,
    payments: allPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      date: p.date,
      mode: p.mode,
      kind: p.kind,
      referenceNo: p.referenceNo,
      voidedAt: p.voidedAt,
      voidReason: p.voidReason,
      enteredBy: p.enteredBy,
    })),
  });
}
