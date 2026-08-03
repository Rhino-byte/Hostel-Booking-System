import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { paymentStatus } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ blockCode: string }> }
) {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blockCode: rawCode } = await params;
  const blockCode = decodeURIComponent(rawCode).trim().toUpperCase();

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) {
    return NextResponse.json({ error: "No active term" }, { status: 404 });
  }

  const block = await prisma.block.findUnique({
    where: { code: blockCode },
    include: {
      rooms: { include: { beds: true } },
    },
  });
  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  const capacity = block.rooms.reduce((s, r) => s + r.beds.length, 0);

  const bookings = await prisma.booking.findMany({
    where: {
      termId: term.id,
      status: "ACTIVE",
      bed: { room: { blockId: block.id } },
    },
    include: {
      student: true,
      residenceType: true,
      bed: { include: { room: true } },
    },
  });

  const studentIds = bookings.map((b) => b.studentId);
  const payments = studentIds.length
    ? await prisma.payment.findMany({
        where: {
          termId: term.id,
          voidedAt: null,
          clearedAt: null,
          studentId: { in: studentIds },
        },
      })
    : [];

  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    paidByStudent.set(
      p.studentId,
      (paidByStudent.get(p.studentId) || 0) + p.amount
    );
  }

  let collected = 0;
  let outstanding = 0;
  let paid = 0;
  let partial = 0;
  let unpaid = 0;

  const statusOrder = { UNPAID: 0, PARTIAL: 1, CLEARED: 2, OVERPAID: 3 } as const;

  const students = bookings.map((b) => {
    const feeDue = b.residenceType.feeKes;
    const feePaid = paidByStudent.get(b.studentId) || 0;
    const balance = Math.max(0, feeDue - feePaid);
    const status = paymentStatus(feeDue, feePaid);

    collected += feePaid;
    outstanding += balance;
    if (status === "CLEARED" || status === "OVERPAID") paid += 1;
    else if (status === "PARTIAL") partial += 1;
    else unpaid += 1;

    const bedLabel =
      b.bed.label === "1"
        ? `${block.code}-${b.bed.room.number}`
        : `${block.code}-${b.bed.room.number}${b.bed.label}`;

    return {
      id: b.student.id,
      name: b.student.name,
      roomNumber: b.student.roomNumber,
      bedLabel,
      roomNumberBed: bedLabel,
      feeDue,
      feePaid,
      balance,
      status,
    };
  });

  students.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      a.name.localeCompare(b.name)
  );

  const occupied = bookings.length;
  const free = Math.max(0, capacity - occupied);
  const ratePercent =
    capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;

  return NextResponse.json({
    block: { code: block.code, name: block.name },
    term: { name: term.name },
    occupancy: {
      occupied,
      capacity,
      free,
      ratePercent,
    },
    payments: {
      collected,
      outstanding,
      paid,
      partial,
      unpaid,
    },
    students,
  });
}
