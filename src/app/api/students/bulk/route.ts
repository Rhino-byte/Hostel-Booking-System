import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import {
  MAX_STUDENT_BATCH,
  createStudentsFromRows,
} from "@/lib/student-batch";

const bulkNamesSchema = z.object({
  names: z.array(z.string()).min(1).max(MAX_STUDENT_BATCH),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bulkNamesSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: `Send 1–${MAX_STUDENT_BATCH} names` },
      { status: 400 }
    );
  }

  const rows = parsed.data.names.map((name, i) => ({
    row: i + 1,
    name,
  }));

  const { created, errors } = await createStudentsFromRows(
    rows,
    session.uid,
    {
      entity: "StudentBulk",
      entityId: `bulk-${Date.now()}`,
    }
  );

  return NextResponse.json({
    created: created.length,
    skipped: errors.length,
    students: created,
    errors,
  });
}
