import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { z } from "zod";
import {
  getStudentTermBalance,
  getTermBalanceMaps,
} from "@/lib/balances";
import { getLatestEditablePaymentIds } from "@/lib/payment-editable";
import { pushStudentSummary } from "@/lib/sheet-sync";
import { paymentStatus } from "@/lib/utils";

const paymentSchema = z.object({
  studentId: z.string(),
  termId: z.string(),
  amount: z.number().int().positive(),
  date: z.string(),
  mode: z.enum(["PAY_BILL", "TILL", "CASH", "BANK", "OTHER"]),
  referenceNo: z.string().optional(),
  blockCode: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role === "PARENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const termIdParam = searchParams.get("termId");
    const termId =
      termIdParam ||
      (await prisma.term.findFirst({ where: { isActive: true } }))?.id;

    if (!termId) {
      return NextResponse.json({ payments: [] });
    }

    const payments = await prisma.payment.findMany({
      where: {
        clearedAt: null,
        termId,
        ...(studentId ? { studentId } : {}),
      },
      include: {
        student: true,
        term: true,
        enteredBy: true,
      },
      orderBy: { date: "desc" },
      take: 200,
    });

    const studentIds = Array.from(new Set(payments.map((p) => p.studentId)));
    const [{ statusByStudent, balanceByStudent }, latestEditableByStudent] =
      await Promise.all([
        getTermBalanceMaps(termId, studentIds),
        getLatestEditablePaymentIds(termId, studentIds),
      ]);

    const enriched = payments.map((p) => {
      const bal = balanceByStudent.get(p.studentId);
      const isEditable =
        !p.voidedAt &&
        latestEditableByStudent.get(p.studentId) === p.id;
      return {
        ...p,
        isEditable,
        studentStatus: statusByStudent.get(p.studentId) ?? paymentStatus(0, 0),
        feeDue: bal?.feeDue ?? 0,
        feePaid: bal?.feePaid ?? 0,
        feeBalance: bal?.feeBalance ?? 0,
      };
    });

    return NextResponse.json({ payments: enriched });
  } catch (err) {
    console.error("GET /api/payments failed:", err);
    return NextResponse.json(
      { error: "Failed to load payments" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payment = await prisma.payment.create({
    data: {
      studentId: parsed.data.studentId,
      termId: parsed.data.termId,
      amount: parsed.data.amount,
      date: new Date(parsed.data.date),
      mode: parsed.data.mode,
      kind: "FEE",
      source: "APP",
      referenceNo: parsed.data.referenceNo || null,
      blockCode: parsed.data.blockCode || null,
      notes: parsed.data.notes || null,
      enteredById: session.uid,
    },
  });

  await prisma.auditLog.create({
    data: {
      entity: "Payment",
      entityId: payment.id,
      action: "CREATE",
      afterJson: JSON.stringify(payment),
      userId: session.uid,
    },
  });

  void pushStudentSummary(parsed.data.studentId).catch(() => undefined);

  const balance = await getStudentTermBalance(
    parsed.data.studentId,
    parsed.data.termId
  );
  return NextResponse.json({ payment, balance });
}
