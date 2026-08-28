import { prisma } from "@/lib/db";

const editableWhere = {
  voidedAt: null,
  clearedAt: null,
} as const;

/** Latest non-voided, non-cleared payment for a student in a term. */
export async function getLatestEditablePaymentId(
  studentId: string,
  termId: string
): Promise<string | null> {
  const latest = await prisma.payment.findFirst({
    where: { studentId, termId, ...editableWhere },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  return latest?.id ?? null;
}

export async function assertPaymentEditable(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.voidedAt || payment.clearedAt) {
    return {
      ok: false as const,
      error: "Payment not found",
      status: 404,
    };
  }

  const latestId = await getLatestEditablePaymentId(
    payment.studentId,
    payment.termId
  );
  if (payment.id !== latestId) {
    return {
      ok: false as const,
      error: "Only the most recent payment can be changed",
      status: 403,
    };
  }

  return { ok: true as const, payment };
}

/** Map studentId → latest editable payment id for a term. */
export async function getLatestEditablePaymentIds(
  termId: string,
  studentIds: string[]
): Promise<Map<string, string>> {
  if (studentIds.length === 0) return new Map();

  const latest = await prisma.payment.findMany({
    where: {
      termId,
      studentId: { in: studentIds },
      ...editableWhere,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    distinct: ["studentId"],
    select: { id: true, studentId: true },
  });

  return new Map(latest.map((p) => [p.studentId, p.id]));
}
