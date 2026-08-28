import { prisma } from "@/lib/db";
import { paymentStatus, type FeeStatus } from "@/lib/utils";

export type StudentBalanceSummary = {
  feeDue: number;
  feePaid: number;
  feeBalance: number;
  status: FeeStatus;
};

/** Batch balance lookup — 2 queries for the whole term instead of 2 per student. */
export async function getTermBalanceMaps(
  termId: string,
  studentIds?: string[]
): Promise<{
  statusByStudent: Map<string, FeeStatus>;
  balanceByStudent: Map<string, StudentBalanceSummary>;
}> {
  const studentFilter = studentIds?.length
    ? { studentId: { in: studentIds } }
    : {};

  const [bookings, payments] = await Promise.all([
    prisma.booking.findMany({
      where: { termId, status: "ACTIVE", ...studentFilter },
      include: { residenceType: true },
    }),
    prisma.payment.findMany({
      where: { termId, voidedAt: null, clearedAt: null, ...studentFilter },
    }),
  ]);

  const paidByStudent = new Map<string, number>();
  for (const p of payments) {
    paidByStudent.set(
      p.studentId,
      (paidByStudent.get(p.studentId) || 0) + p.amount
    );
  }

  const feeDueByStudent = new Map<string, number>();
  for (const b of bookings) {
    feeDueByStudent.set(b.studentId, b.residenceType.feeKes);
  }

  const allStudentIds = new Set([
    ...bookings.map((b) => b.studentId),
    ...payments.map((p) => p.studentId),
    ...(studentIds ?? []),
  ]);

  const statusByStudent = new Map<string, FeeStatus>();
  const balanceByStudent = new Map<string, StudentBalanceSummary>();

  for (const sid of allStudentIds) {
    const feeDue = feeDueByStudent.get(sid) ?? 0;
    const feePaid = paidByStudent.get(sid) ?? 0;
    balanceByStudent.set(sid, {
      feeDue,
      feePaid,
      feeBalance: Math.max(0, feeDue - feePaid),
      status: paymentStatus(feeDue, feePaid),
    });
    statusByStudent.set(sid, paymentStatus(feeDue, feePaid));
  }

  return { statusByStudent, balanceByStudent };
}

export async function getStudentTermBalance(studentId: string, termId: string) {
  const booking = await prisma.booking.findFirst({
    where: { studentId, termId, status: "ACTIVE" },
    include: {
      residenceType: true,
      bed: { include: { room: { include: { block: true } } } },
    },
  });

  const payments = await prisma.payment.findMany({
    where: { studentId, termId, voidedAt: null, clearedAt: null },
  });

  // All recorded payments count toward semester fee (deposit is reference-only in settings)
  const feePaid = payments.reduce((s, p) => s + p.amount, 0);
  const feeDue = booking?.residenceType.feeKes ?? 0;

  return {
    booking,
    feeDue,
    feePaid,
    feeBalance: Math.max(0, feeDue - feePaid),
    status: paymentStatus(feeDue, feePaid),
    payments,
  };
}
