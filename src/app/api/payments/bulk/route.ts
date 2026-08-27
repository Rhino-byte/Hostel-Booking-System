import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getStudentTermBalance } from "@/lib/balances";
import { pushStudentSummary } from "@/lib/sheet-sync";
import { MAX_STUDENT_BATCH } from "@/lib/student-batch";

const paymentRowSchema = z.object({
  studentId: z.string().min(1),
  amount: z.number().int().positive(),
});

const bulkPaymentSchema = z.object({
  termId: z.string().min(1),
  date: z.string().min(1),
  mode: z.enum(["PAY_BILL", "TILL", "CASH", "BANK", "OTHER"]),
  referenceNo: z.string().optional(),
  payments: z.array(paymentRowSchema).min(1).max(MAX_STUDENT_BATCH),
});

type PaymentError = {
  studentId: string;
  reason: string;
};

type RecordedPayment = {
  studentId: string;
  paymentId: string;
  amount: number;
  balance: {
    feeDue: number;
    feePaid: number;
    feeBalance: number;
  } | null;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bulkPaymentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { termId, date, mode, referenceNo, payments } = parsed.data;

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term || term.id !== termId) {
    return NextResponse.json(
      { error: "Active term mismatch. Refresh and try again." },
      { status: 409 }
    );
  }

  const payDate = new Date(date);
  if (Number.isNaN(payDate.getTime())) {
    return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
  }

  const recordedIds: { studentId: string; paymentId: string; amount: number }[] =
    [];
  const errors: PaymentError[] = [];
  const seenStudents = new Set<string>();

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const row of payments) {
          if (seenStudents.has(row.studentId)) {
            errors.push({
              studentId: row.studentId,
              reason: "Duplicate student in this request",
            });
            continue;
          }
          seenStudents.add(row.studentId);

          const student = await tx.student.findUnique({
            where: { id: row.studentId },
          });
          if (!student || student.clearedAt) {
            errors.push({
              studentId: row.studentId,
              reason: "Student not found",
            });
            continue;
          }

          const booking = await tx.booking.findFirst({
            where: {
              studentId: row.studentId,
              termId,
              status: "ACTIVE",
            },
          });
          if (!booking) {
            errors.push({
              studentId: row.studentId,
              reason: "Assign a room first",
            });
            continue;
          }

          const payment = await tx.payment.create({
            data: {
              studentId: row.studentId,
              termId,
              amount: row.amount,
              date: payDate,
              mode,
              kind: "FEE",
              source: "APP",
              referenceNo: referenceNo?.trim() || null,
              enteredById: session.uid,
            },
          });
          await tx.auditLog.create({
            data: {
              entity: "Payment",
              entityId: payment.id,
              action: "CREATE",
              afterJson: JSON.stringify(payment),
              userId: session.uid,
            },
          });

          recordedIds.push({
            studentId: row.studentId,
            paymentId: payment.id,
            amount: row.amount,
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not record payments. Try again." },
      { status: 500 }
    );
  }

  const recorded: RecordedPayment[] = await Promise.all(
    recordedIds.map(async (row) => {
      void pushStudentSummary(row.studentId).catch(() => undefined);
      try {
        const bal = await getStudentTermBalance(row.studentId, termId);
        return {
          ...row,
          balance: {
            feeDue: bal.feeDue,
            feePaid: bal.feePaid,
            feeBalance: bal.feeBalance,
          },
        };
      } catch {
        return { ...row, balance: null };
      }
    })
  );

  return NextResponse.json({ recorded, errors });
}
