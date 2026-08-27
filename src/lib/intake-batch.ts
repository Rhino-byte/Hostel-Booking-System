import { Prisma, type PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { newAdmissionNo } from "@/lib/admission";
import { MAX_STUDENT_BATCH } from "@/lib/student-batch";
import { pushStudentSummary } from "@/lib/sheet-sync";

export type IntakeBatchStudentInput = {
  tempId: string;
  name?: string;
  existingStudentId?: string;
};

export type IntakeBatchAssignmentInput = {
  tempId: string;
  bedId: string;
};

export type IntakeBatchPaymentInput = {
  date: Date;
  mode: PaymentMode;
  referenceNo?: string | null;
  rows: { tempId: string; amount: number }[];
};

export type IntakeBatchInput = {
  termId: string;
  userId: string;
  allowPayments: boolean;
  students: IntakeBatchStudentInput[];
  assignments: IntakeBatchAssignmentInput[];
  payments: IntakeBatchPaymentInput | null;
};

export type IntakeBatchRowError = {
  tempId: string;
  name: string;
  reason: string;
};

export type IntakeBatchCreated = {
  tempId: string;
  id: string;
  name: string;
  admissionNo: string;
};

export type IntakeBatchAssigned = {
  tempId: string;
  studentId: string;
  bedId: string;
  bookingId: string;
  feeDue: number;
};

export type IntakeBatchResult = {
  created: IntakeBatchCreated[];
  existingCount: number;
  assigned: IntakeBatchAssigned[];
  paymentsRecorded: number;
  errors: IntakeBatchRowError[];
};

function studentLabel(
  row: IntakeBatchStudentInput,
  fallbackName?: string | null
) {
  return row.name?.trim() || fallbackName || row.tempId;
}

export async function commitIntakeBatch(
  input: IntakeBatchInput
): Promise<IntakeBatchResult> {
  const errors: IntakeBatchRowError[] = [];
  const created: IntakeBatchCreated[] = [];
  const assigned: IntakeBatchAssigned[] = [];
  let paymentsRecorded = 0;
  let existingCount = 0;

  if (
    input.students.length < 1 ||
    input.students.length > MAX_STUDENT_BATCH
  ) {
    throw new Error(`Send 1–${MAX_STUDENT_BATCH} students`);
  }

  const byTemp = new Map<string, IntakeBatchStudentInput>();
  for (const row of input.students) {
    if (byTemp.has(row.tempId)) {
      errors.push({
        tempId: row.tempId,
        name: studentLabel(row),
        reason: "Duplicate student in this request",
      });
      continue;
    }
    byTemp.set(row.tempId, row);
  }

  const newRows: { tempId: string; name: string; admissionNo: string }[] = [];
  const existingIds: { tempId: string; studentId: string }[] = [];
  const seenExisting = new Set<string>();

  for (const row of byTemp.values()) {
    if (row.existingStudentId) {
      if (seenExisting.has(row.existingStudentId)) {
        errors.push({
          tempId: row.tempId,
          name: studentLabel(row),
          reason: "Duplicate student in this request",
        });
        continue;
      }
      seenExisting.add(row.existingStudentId);
      existingIds.push({ tempId: row.tempId, studentId: row.existingStudentId });
      continue;
    }
    const name = row.name?.trim() || "";
    if (name.length < 2) {
      errors.push({
        tempId: row.tempId,
        name,
        reason: "Name is required (min 2 characters)",
      });
      continue;
    }
    newRows.push({
      tempId: row.tempId,
      name,
      admissionNo: newAdmissionNo(),
    });
  }

  const assignmentByTemp = new Map<string, string>();
  const seenBeds = new Set<string>();
  for (const row of input.assignments) {
    const student = byTemp.get(row.tempId);
    if (!student) {
      errors.push({
        tempId: row.tempId,
        name: row.tempId,
        reason: "Student is not in this batch",
      });
      continue;
    }
    if (assignmentByTemp.has(row.tempId)) {
      errors.push({
        tempId: row.tempId,
        name: studentLabel(student),
        reason: "Duplicate student in this request",
      });
      continue;
    }
    if (seenBeds.has(row.bedId)) {
      errors.push({
        tempId: row.tempId,
        name: studentLabel(student),
        reason: "Duplicate bed in this request",
      });
      continue;
    }
    seenBeds.add(row.bedId);
    assignmentByTemp.set(row.tempId, row.bedId);
  }

  const paymentByTemp = new Map<string, number>();
  if (input.allowPayments && input.payments) {
    const seenPay = new Set<string>();
    for (const row of input.payments.rows) {
      if (seenPay.has(row.tempId)) {
        errors.push({
          tempId: row.tempId,
          name: studentLabel(byTemp.get(row.tempId) ?? { tempId: row.tempId }),
          reason: "Duplicate student in this request",
        });
        continue;
      }
      seenPay.add(row.tempId);
      if (!Number.isInteger(row.amount) || row.amount <= 0) {
        errors.push({
          tempId: row.tempId,
          name: studentLabel(byTemp.get(row.tempId) ?? { tempId: row.tempId }),
          reason: "Amount must be a positive whole number",
        });
        continue;
      }
      paymentByTemp.set(row.tempId, row.amount);
    }
  }

  const tempToStudentId = new Map<string, string>();
  const sheetStudentIds: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      if (existingIds.length > 0) {
        const ids = existingIds.map((s) => s.studentId);
        await tx.$queryRaw`
          SELECT id FROM "Student" WHERE id IN (${Prisma.join(ids)}) FOR UPDATE
        `;
        const existing = await tx.student.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, clearedAt: true },
        });
        const found = new Map(existing.map((s) => [s.id, s]));
        for (const row of existingIds) {
          const student = found.get(row.studentId);
          if (!student || student.clearedAt) {
            errors.push({
              tempId: row.tempId,
              name: studentLabel(byTemp.get(row.tempId), student?.name),
              reason: "Student not found",
            });
            continue;
          }
          tempToStudentId.set(row.tempId, student.id);
          existingCount += 1;
        }
      }

      if (newRows.length > 0) {
        const inserted = await tx.student.createManyAndReturn({
          data: newRows.map((s) => ({
            name: s.name,
            admissionNo: s.admissionNo,
            roomNumber: null,
          })),
          select: { id: true, name: true, admissionNo: true },
        });
        const byAdmission = new Map(
          inserted.map((s) => [s.admissionNo, s])
        );
        for (const row of newRows) {
          const student = byAdmission.get(row.admissionNo);
          if (!student) {
            errors.push({
              tempId: row.tempId,
              name: row.name,
              reason: "Could not save student",
            });
            continue;
          }
          tempToStudentId.set(row.tempId, student.id);
          created.push({
            tempId: row.tempId,
            id: student.id,
            name: student.name,
            admissionNo: student.admissionNo,
          });
        }
      }

      const bedIds = [...new Set(assignmentByTemp.values())];
      const studentIdsForAssign = [...assignmentByTemp.keys()]
        .map((tempId) => tempToStudentId.get(tempId))
        .filter((id): id is string => Boolean(id));

      if (bedIds.length > 0) {
        await tx.$queryRaw`
          SELECT id FROM "Bed" WHERE id IN (${Prisma.join(bedIds)}) FOR UPDATE
        `;
      }

      const beds =
        bedIds.length > 0
          ? await tx.bed.findMany({
              where: { id: { in: bedIds } },
              include: {
                room: { include: { block: { include: { residenceType: true } } } },
              },
            })
          : [];
      const bedById = new Map(beds.map((b) => [b.id, b]));

      const existingBookings =
        bedIds.length > 0 || studentIdsForAssign.length > 0
          ? await tx.booking.findMany({
              where: {
                termId: input.termId,
                status: "ACTIVE",
                OR: [
                  ...(bedIds.length ? [{ bedId: { in: bedIds } }] : []),
                  ...(studentIdsForAssign.length
                    ? [{ studentId: { in: studentIdsForAssign } }]
                    : []),
                ],
              },
              select: { studentId: true, bedId: true },
            })
          : [];
      const occupiedBeds = new Set(existingBookings.map((b) => b.bedId));
      const bookedStudents = new Set(
        existingBookings.map((b) => b.studentId)
      );

      const bookingsToCreate: {
        tempId: string;
        studentId: string;
        bedId: string;
        residenceTypeId: string;
        feeDue: number;
      }[] = [];

      for (const [tempId, bedId] of assignmentByTemp) {
        const studentId = tempToStudentId.get(tempId);
        const label = studentLabel(byTemp.get(tempId));
        if (!studentId) continue;
        const bed = bedById.get(bedId);
        if (!bed) {
          errors.push({
            tempId,
            name: label,
            reason: "Bed not found",
          });
          continue;
        }
        if (occupiedBeds.has(bedId)) {
          errors.push({
            tempId,
            name: label,
            reason: "This bed is already occupied for the selected term",
          });
          continue;
        }
        if (bookedStudents.has(studentId)) {
          errors.push({
            tempId,
            name: label,
            reason: "Student already has a bed this term",
          });
          continue;
        }
        occupiedBeds.add(bedId);
        bookedStudents.add(studentId);
        bookingsToCreate.push({
          tempId,
          studentId,
          bedId,
          residenceTypeId: bed.room.block.residenceTypeId,
          feeDue: bed.room.block.residenceType.feeKes,
        });
      }

      if (bookingsToCreate.length > 0) {
        const insertedBookings = await tx.booking.createManyAndReturn({
          data: bookingsToCreate.map((row) => ({
            studentId: row.studentId,
            bedId: row.bedId,
            termId: input.termId,
            residenceTypeId: row.residenceTypeId,
            assignedById: input.userId,
            status: "ACTIVE" as const,
          })),
          select: { id: true, studentId: true, bedId: true },
        });
        const bookingKey = (studentId: string, bedId: string) =>
          `${studentId}:${bedId}`;
        const bookingByPair = new Map(
          insertedBookings.map((b) => [bookingKey(b.studentId, b.bedId), b])
        );
        const events = [];
        for (const row of bookingsToCreate) {
          const booking = bookingByPair.get(
            bookingKey(row.studentId, row.bedId)
          );
          if (!booking) {
            errors.push({
              tempId: row.tempId,
              name: studentLabel(byTemp.get(row.tempId)),
              reason: "Could not assign bed",
            });
            continue;
          }
          assigned.push({
            tempId: row.tempId,
            studentId: row.studentId,
            bedId: row.bedId,
            bookingId: booking.id,
            feeDue: row.feeDue,
          });
          events.push({
            bookingId: booking.id,
            action: "ASSIGN",
            toBedId: row.bedId,
            userId: input.userId,
          });
        }
        if (events.length > 0) {
          await tx.bookingEvent.createMany({ data: events });
        }
      }

      const assignedTemps = new Set(assigned.map((a) => a.tempId));
      const paymentsToCreate: {
        studentId: string;
        amount: number;
      }[] = [];

      if (input.allowPayments && input.payments) {
        for (const [tempId, amount] of paymentByTemp) {
          const label = studentLabel(byTemp.get(tempId));
          const studentId = tempToStudentId.get(tempId);
          if (!studentId) continue;
          if (!assignedTemps.has(tempId)) {
            errors.push({
              tempId,
              name: label,
              reason: "Assign a room first",
            });
            continue;
          }
          paymentsToCreate.push({ studentId, amount });
        }
        if (paymentsToCreate.length > 0) {
          await tx.payment.createMany({
            data: paymentsToCreate.map((row) => ({
              studentId: row.studentId,
              termId: input.termId,
              amount: row.amount,
              date: input.payments!.date,
              mode: input.payments!.mode,
              kind: "FEE" as const,
              source: "APP" as const,
              referenceNo: input.payments!.referenceNo?.trim() || null,
              enteredById: input.userId,
            })),
          });
          paymentsRecorded = paymentsToCreate.length;
        }
      }

      await tx.auditLog.create({
        data: {
          entity: "IntakeBatch",
          entityId: `intake-${Date.now()}`,
          action: "CREATE",
          afterJson: JSON.stringify({
            created: created.length,
            existing: existingCount,
            assigned: assigned.length,
            paymentsRecorded,
            errors: errors.slice(0, 50),
          }),
          userId: input.userId,
        },
      });
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  for (const id of [
    ...created.map((s) => s.id),
    ...assigned.map((s) => s.studentId),
  ]) {
    sheetStudentIds.push(id);
  }
  for (const id of new Set(sheetStudentIds)) {
    void pushStudentSummary(id).catch(() => undefined);
  }

  return {
    created,
    existingCount,
    assigned,
    paymentsRecorded,
    errors,
  };
}
