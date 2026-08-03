import { prisma } from "@/lib/db";
import { paymentStatus } from "@/lib/utils";

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
