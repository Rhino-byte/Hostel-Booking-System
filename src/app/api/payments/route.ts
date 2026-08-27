import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { z } from "zod";
import { getStudentTermBalance } from "@/lib/balances";
import { pushStudentSummary } from "@/lib/sheet-sync";
import { paymentStatus, type FeeStatus } from "@/lib/utils";

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

  // Build fee status per student+term from non-voided payments + active booking fee
  const pairs = Array.from(
    new Map(
      payments.map((p) => [`${p.studentId}:${p.termId}`, { studentId: p.studentId, termId: p.termId }])
    ).values()
  );

  const statusByPair = new Map<string, FeeStatus>();
  const balanceByPair = new Map<
    string,
    { feeDue: number; feePaid: number; feeBalance: number }
  >();

  await Promise.all(
    pairs.map(async ({ studentId: sid, termId: tid }) => {
      const key = `${sid}:${tid}`;
      const bal = await getStudentTermBalance(sid, tid);
      statusByPair.set(key, bal.status);
      balanceByPair.set(key, {
        feeDue: bal.feeDue,
        feePaid: bal.feePaid,
        feeBalance: bal.feeBalance,
      });
    })
  );

  const enriched = payments.map((p) => {
    const key = `${p.studentId}:${p.termId}`;
    const bal = balanceByPair.get(key);
    return {
      ...p,
      studentStatus: statusByPair.get(key) ?? paymentStatus(0, 0),
      feeDue: bal?.feeDue ?? 0,
      feePaid: bal?.feePaid ?? 0,
      feeBalance: bal?.feeBalance ?? 0,
    };
  });

  return NextResponse.json({ payments: enriched });
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
