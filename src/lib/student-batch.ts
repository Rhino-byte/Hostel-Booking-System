import { prisma } from "@/lib/db";
import { newAdmissionNo } from "@/lib/admission";

export const MAX_STUDENT_BATCH = 500;

export type CreatedStudent = {
  id: string;
  name: string;
  admissionNo: string;
};

export type StudentBatchError = {
  row: number;
  name: string;
  reason: string;
};

export async function createStudentsFromRows(
  rows: { row: number; name: string }[],
  userId: string,
  audit: { entity: string; entityId: string; extra?: Record<string, unknown> }
): Promise<{ created: CreatedStudent[]; errors: StudentBatchError[] }> {
  const errors: StudentBatchError[] = [];
  const toCreate: { name: string; admissionNo: string }[] = [];

  for (const item of rows) {
    const name = item.name.trim();
    if (!name) continue;
    if (name.length < 2) {
      errors.push({
        row: item.row,
        name,
        reason: "Name is required (min 2 characters)",
      });
      continue;
    }
    toCreate.push({
      name,
      admissionNo: newAdmissionNo(),
    });
  }

  let created: CreatedStudent[] = [];
  if (toCreate.length > 0) {
    try {
      created = await prisma.student.createManyAndReturn({
        data: toCreate.map((s) => ({
          name: s.name,
          admissionNo: s.admissionNo,
          roomNumber: null,
        })),
        select: { id: true, name: true, admissionNo: true },
      });
    } catch {
      for (const item of rows) {
        const name = item.name.trim();
        if (!name || name.length < 2) continue;
        errors.push({
          row: item.row,
          name,
          reason: "Could not save student",
        });
      }
      created = [];
    }
  }

  await prisma.auditLog.create({
    data: {
      entity: audit.entity,
      entityId: audit.entityId,
      action: "CREATE",
      afterJson: JSON.stringify({
        ...audit.extra,
        created: created.length,
        skipped: errors.length,
        errors: errors.slice(0, 50),
      }),
      userId,
    },
  });

  return { created, errors };
}
