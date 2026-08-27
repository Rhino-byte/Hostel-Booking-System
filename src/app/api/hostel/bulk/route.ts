import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { MAX_STUDENT_BATCH } from "@/lib/student-batch";

const assignmentSchema = z.object({
  studentId: z.string().min(1),
  bedId: z.string().min(1),
});

const bulkAssignSchema = z.object({
  termId: z.string().min(1),
  assignments: z.array(assignmentSchema).min(1).max(MAX_STUDENT_BATCH),
});

type AssignError = {
  studentId: string;
  bedId: string;
  reason: string;
};

type AssignedRow = {
  studentId: string;
  bedId: string;
  bookingId: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY", "MATRON"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bulkAssignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { termId, assignments } = parsed.data;

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term || term.id !== termId) {
    return NextResponse.json(
      { error: "Active term mismatch. Refresh and try again." },
      { status: 409 }
    );
  }

  const assigned: AssignedRow[] = [];
  const errors: AssignError[] = [];
  const seenBeds = new Set<string>();
  const seenStudents = new Set<string>();

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const row of assignments) {
          if (seenBeds.has(row.bedId)) {
            errors.push({
              studentId: row.studentId,
              bedId: row.bedId,
              reason: "Duplicate bed in this request",
            });
            continue;
          }
          if (seenStudents.has(row.studentId)) {
            errors.push({
              studentId: row.studentId,
              bedId: row.bedId,
              reason: "Duplicate student in this request",
            });
            continue;
          }
          seenBeds.add(row.bedId);
          seenStudents.add(row.studentId);

          const lockedBeds = await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Bed" WHERE id = ${row.bedId} FOR UPDATE
          `;
          if (!lockedBeds.length) {
            errors.push({
              studentId: row.studentId,
              bedId: row.bedId,
              reason: "Bed not found",
            });
            continue;
          }

          await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Student" WHERE id = ${row.studentId} FOR UPDATE
          `;

          const bed = await tx.bed.findUnique({
            where: { id: row.bedId },
            include: { room: { include: { block: true } } },
          });
          if (!bed) {
            errors.push({
              studentId: row.studentId,
              bedId: row.bedId,
              reason: "Bed not found",
            });
            continue;
          }

          const student = await tx.student.findUnique({
            where: { id: row.studentId },
          });
          if (!student || student.clearedAt) {
            errors.push({
              studentId: row.studentId,
              bedId: row.bedId,
              reason: "Student not found",
            });
            continue;
          }

          const occupied = await tx.booking.findFirst({
            where: {
              bedId: row.bedId,
              termId,
              status: "ACTIVE",
            },
          });
          if (occupied) {
            errors.push({
              studentId: row.studentId,
              bedId: row.bedId,
              reason: "This bed is already occupied for the selected term",
            });
            continue;
          }

          const existing = await tx.booking.findFirst({
            where: {
              studentId: row.studentId,
              termId,
              status: "ACTIVE",
            },
          });
          if (existing) {
            errors.push({
              studentId: row.studentId,
              bedId: row.bedId,
              reason: "Student already has a bed this term",
            });
            continue;
          }

          const booking = await tx.booking.create({
            data: {
              studentId: row.studentId,
              bedId: row.bedId,
              termId,
              residenceTypeId: bed.room.block.residenceTypeId,
              assignedById: session.uid,
            },
          });
          await tx.bookingEvent.create({
            data: {
              bookingId: booking.id,
              action: "ASSIGN",
              toBedId: row.bedId,
              userId: session.uid,
            },
          });
          await tx.auditLog.create({
            data: {
              entity: "Booking",
              entityId: booking.id,
              action: "ASSIGN",
              afterJson: JSON.stringify(booking),
              userId: session.uid,
            },
          });

          assigned.push({
            studentId: row.studentId,
            bedId: row.bedId,
            bookingId: booking.id,
          });
        }
      },
      { maxWait: 10_000, timeout: 120_000 }
    );
  } catch {
    return NextResponse.json(
      { error: "Could not assign beds. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ assigned, errors });
}
