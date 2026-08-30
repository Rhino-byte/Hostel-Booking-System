import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  buildCollectionsOverTime,
  buildReportRows,
  buildReportTotals,
  type ReportGranularity,
} from "@/lib/reports";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const termIdParam = searchParams.get("termId");
  const rawGranularity = searchParams.get("granularity") || "week";
  const granularity: ReportGranularity =
    rawGranularity === "day" ? "day" : "week";

  const term = termIdParam
    ? await prisma.term.findUnique({ where: { id: termIdParam } })
    : await prisma.term.findFirst({ where: { isActive: true } });

  if (!term) {
    return NextResponse.json({
      term: null,
      totals: {
        collected: 0,
        outstanding: 0,
        expected: 0,
        collectionRate: 0,
        paid: 0,
        partial: 0,
        unpaid: 0,
        overpaid: 0,
        booked: 0,
      },
      collectionsOverTime: [],
      rows: [],
    });
  }

  const [bookings, payments] = await Promise.all([
    prisma.booking.findMany({
      where: { termId: term.id, status: "ACTIVE" },
      include: {
        student: true,
        residenceType: true,
        bed: { include: { room: { include: { block: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { termId: term.id, voidedAt: null, clearedAt: null },
      select: { studentId: true, amount: true, date: true },
    }),
  ]);

  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    paidByStudent.set(
      p.studentId,
      (paidByStudent.get(p.studentId) || 0) + p.amount
    );
  }

  const bookedStudentIds = new Set(bookings.map((b) => b.studentId));
  const orphanIds = Array.from(
    new Set(
      payments
        .map((p) => p.studentId)
        .filter((id) => !bookedStudentIds.has(id))
    )
  );

  const orphanStudents = orphanIds.length
    ? await prisma.student.findMany({
        where: { id: { in: orphanIds } },
        select: { id: true, name: true, admissionNo: true },
      })
    : [];

  const rows = buildReportRows(bookings, orphanStudents, paidByStudent);
  const totals = buildReportTotals(rows, payments);
  const collectionsOverTime = buildCollectionsOverTime(
    payments,
    term.startDate,
    term.endDate,
    granularity
  );

  return NextResponse.json({
    term: {
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      isActive: term.isActive,
    },
    totals,
    collectionsOverTime,
    rows,
  });
}
