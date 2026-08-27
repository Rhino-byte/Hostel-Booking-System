import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { MAX_STUDENT_BATCH } from "@/lib/student-batch";
import { commitIntakeBatch } from "@/lib/intake-batch";

const studentSchema = z
  .object({
    tempId: z.string().min(1),
    name: z.string().optional(),
    existingStudentId: z.string().optional(),
  })
  .refine(
    (row) =>
      Boolean(row.existingStudentId) ||
      Boolean(row.name && row.name.trim().length >= 2),
    { message: "Each student needs a name or an existing student id" }
  );

const paymentsSchema = z
  .object({
    date: z.string().min(1),
    mode: z.enum(["PAY_BILL", "TILL", "CASH", "BANK", "OTHER"]),
    referenceNo: z.string().optional(),
    rows: z
      .array(
        z.object({
          tempId: z.string().min(1),
          amount: z.number().int().positive(),
        })
      )
      .max(MAX_STUDENT_BATCH),
  })
  .nullable();

const batchSchema = z.object({
  termId: z.string().min(1),
  students: z.array(studentSchema).min(1).max(MAX_STUDENT_BATCH),
  assignments: z
    .array(
      z.object({
        tempId: z.string().min(1),
        bedId: z.string().min(1),
      })
    )
    .max(MAX_STUDENT_BATCH)
    .default([]),
  payments: paymentsSchema.optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY", "MATRON"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = batchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const allowPayments = session.role !== "MATRON";
  if (!allowPayments && parsed.data.payments) {
    return NextResponse.json(
      { error: "Only a secretary or administrator can record payments" },
      { status: 403 }
    );
  }

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term || term.id !== parsed.data.termId) {
    return NextResponse.json(
      { error: "Active term mismatch. Refresh and try again." },
      { status: 409 }
    );
  }

  let payDate: Date | null = null;
  if (allowPayments && parsed.data.payments) {
    payDate = new Date(parsed.data.payments.date);
    if (Number.isNaN(payDate.getTime())) {
      return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });
    }
  }

  try {
    const result = await commitIntakeBatch({
      termId: parsed.data.termId,
      userId: session.uid,
      allowPayments,
      students: parsed.data.students,
      assignments: parsed.data.assignments,
      payments:
        allowPayments && parsed.data.payments && payDate
          ? {
              date: payDate,
              mode: parsed.data.payments.mode,
              referenceNo: parsed.data.payments.referenceNo,
              rows: parsed.data.payments.rows,
            }
          : null,
    });

    return NextResponse.json({
      created: result.created,
      existingCount: result.existingCount,
      assigned: result.assigned,
      paymentsRecorded: result.paymentsRecorded,
      errors: result.errors,
    });
  } catch (e) {
    const message =
      e instanceof Error && e.message.startsWith("Send 1")
        ? e.message
        : "Could not save this batch. Try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
