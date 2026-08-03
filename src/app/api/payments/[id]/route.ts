import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { z } from "zod";
import { pushStudentSummary } from "@/lib/sheet-sync";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const schema = z.object({
    amount: z.number().int().positive().optional(),
    date: z.string().optional(),
    mode: z.enum(["PAY_BILL", "TILL", "CASH", "BANK", "OTHER"]).optional(),
    referenceNo: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const before = await prisma.payment.findUnique({ where: { id } });
  if (!before || before.voidedAt) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
      ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
      ...(parsed.data.mode ? { mode: parsed.data.mode } : {}),
      ...(parsed.data.referenceNo !== undefined
        ? { referenceNo: parsed.data.referenceNo }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      entity: "Payment",
      entityId: id,
      action: "UPDATE",
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(payment),
      userId: session.uid,
    },
  });

  void pushStudentSummary(payment.studentId).catch(() => undefined);

  return NextResponse.json({ payment });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason =
    typeof body.reason === "string" ? body.reason : "Voided by staff";

  const before = await prisma.payment.findUnique({ where: { id } });
  if (!before || before.voidedAt) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const payment = await prisma.payment.update({
    where: { id },
    data: { voidedAt: new Date(), voidReason: reason },
  });

  await prisma.auditLog.create({
    data: {
      entity: "Payment",
      entityId: id,
      action: "VOID",
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify(payment),
      userId: session.uid,
    },
  });

  void pushStudentSummary(payment.studentId).catch(() => undefined);

  return NextResponse.json({ payment });
}
