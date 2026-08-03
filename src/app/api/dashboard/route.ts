import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { paymentStatus } from "@/lib/utils";

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) {
    return NextResponse.json({
      term: null,
      totals: { collected: 0, outstanding: 0, paid: 0, partial: 0, unpaid: 0 },
      byBlock: [],
    });
  }

  const bookings = await prisma.booking.findMany({
    where: { termId: term.id, status: "ACTIVE" },
    include: {
      student: true,
      residenceType: true,
      bed: { include: { room: { include: { block: true } } } },
    },
  });

  const payments = await prisma.payment.findMany({
    where: { termId: term.id, voidedAt: null, clearedAt: null },
  });

  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    paidByStudent.set(p.studentId, (paidByStudent.get(p.studentId) || 0) + p.amount);
  }

  let collected = 0;
  let outstanding = 0;
  let paid = 0;
  let partial = 0;
  let unpaid = 0;

  const blockMap = new Map<
    string,
    { code: string; name: string; collected: number; outstanding: number; students: number; capacity: number }
  >();

  const beds = await prisma.bed.findMany({
    include: { room: { include: { block: true } } },
  });
  for (const bed of beds) {
    const code = bed.room.block.code;
    const cur = blockMap.get(code) || {
      code,
      name: bed.room.block.name,
      collected: 0,
      outstanding: 0,
      students: 0,
      capacity: 0,
    };
    cur.capacity += 1;
    blockMap.set(code, cur);
  }

  for (const b of bookings) {
    const feePaid = paidByStudent.get(b.studentId) || 0;
    const feeDue = b.residenceType.feeKes;
    collected += feePaid;
    outstanding += Math.max(0, feeDue - feePaid);
    const status = paymentStatus(feeDue, feePaid);
    if (status === "CLEARED" || status === "OVERPAID") paid += 1;
    else if (status === "PARTIAL") partial += 1;
    else unpaid += 1;

    const code = b.bed.room.block.code;
    const cur = blockMap.get(code)!;
    cur.students += 1;
    cur.collected += feePaid;
    cur.outstanding += Math.max(0, feeDue - feePaid);
  }

  // Include all fee payments even if somehow orphaned
  collected = payments.reduce((s, p) => s + p.amount, 0);

  return NextResponse.json({
    term,
    totals: { collected, outstanding, paid, partial, unpaid, booked: bookings.length },
    byBlock: Array.from(blockMap.values()).sort((a, b) => a.code.localeCompare(b.code)),
  });
}
