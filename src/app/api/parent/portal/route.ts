import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getStudentTermBalance } from "@/lib/balances";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const term = await prisma.term.findFirst({ where: { isActive: true } });

  let studentIds: string[] = [];

  if (session.role === "PARENT") {
    const links = await prisma.studentGuardian.findMany({
      where: {
        OR: [
          { userId: session.uid },
          ...(session.phone ? [{ phone: session.phone }] : []),
        ],
      },
    });
    studentIds = links.map((l) => l.studentId);

    if (session.phone) {
      const byPhone = await prisma.student.findMany({
        where: { guardianPhone: session.phone, clearedAt: null },
        select: { id: true },
      });
      studentIds = Array.from(new Set([...studentIds, ...byPhone.map((s) => s.id)]));
    }
  } else {
    // Staff preview: show all booked students briefly? Better show empty or first few
    const all = await prisma.student.findMany({
      where: { clearedAt: null },
      take: 5,
      select: { id: true },
    });
    studentIds = all.map((s) => s.id);
  }

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, clearedAt: null },
    orderBy: { name: "asc" },
  });

  const enriched = [];
  for (const s of students) {
    if (!term) {
      enriched.push({
        id: s.id,
        name: s.name,
        admissionNo: s.admissionNo,
        classForm: s.classForm,
        feeDue: 0,
        feePaid: 0,
        feeBalance: 0,
        status: "UNPAID" as const,
        payments: [],
      });
      continue;
    }
    const bal = await getStudentTermBalance(s.id, term.id);
    enriched.push({
      id: s.id,
      name: s.name,
      admissionNo: s.admissionNo,
      classForm: s.classForm,
      feeDue: bal.feeDue,
      feePaid: bal.feePaid,
      feeBalance: bal.feeBalance,
      status: bal.status,
      residence: bal.booking?.residenceType.label,
      block: bal.booking?.bed.room.block.code,
      payments: bal.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        date: p.date,
        mode: p.mode,
        kind: p.kind,
        referenceNo: p.referenceNo,
      })),
    });
  }

  return NextResponse.json({
    user: { name: session.name, role: session.role },
    students: enriched,
  });
}
