import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  MAX_STUDENT_BATCH,
  createStudentsFromRows,
} from "@/lib/student-batch";
import {
  parseStudentCsv,
  parseStudentXlsx,
  type ParsedNameRow,
} from "@/lib/student-import-parse";

function isPreviewFlag(value: FormDataEntryValue | null): boolean {
  return value === "1" || value === "true";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const preview = isPreviewFlag(form.get("preview"));

  const limitField = form.get("limit");
  const hasLimit = typeof limitField === "string" && limitField.trim() !== "";
  let maxCreate = MAX_STUDENT_BATCH;
  if (hasLimit) {
    const n = Number(limitField);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    maxCreate = Math.min(n, MAX_STUDENT_BATCH);
  }

  const fileName = file.name.toLowerCase();
  const isCsv = fileName.endsWith(".csv") || file.type.includes("csv");
  const isXlsx =
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel");

  if (!isCsv && !isXlsx) {
    return NextResponse.json(
      { error: "Upload a .csv or .xlsx file" },
      { status: 400 }
    );
  }

  let rows: ParsedNameRow[];
  try {
    if (isCsv) {
      rows = parseStudentCsv(await file.text());
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      rows = parseStudentXlsx(buffer);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse file" },
      { status: 400 }
    );
  }

  if (!hasLimit && rows.length > MAX_STUDENT_BATCH) {
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_STUDENT_BATCH})` },
      { status: 400 }
    );
  }

  const sourceRows = hasLimit ? rows.filter((r) => r.name.trim()) : rows;
  const toCreate = sourceRows.slice(0, maxCreate);
  const truncated = hasLimit
    ? Math.max(0, sourceRows.length - toCreate.length)
    : 0;

  if (preview) {
    const names: string[] = [];
    const errors: { row: number; name: string; reason: string }[] = [];
    for (const item of toCreate) {
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
      names.push(name);
    }
    return NextResponse.json({
      preview: true,
      names,
      skipped: errors.length,
      truncated,
      errors,
    });
  }

  if (toCreate.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: 0,
      truncated,
      students: [],
      errors: [],
    });
  }

  const { created, errors } = await createStudentsFromRows(
    toCreate,
    session.uid,
    {
      entity: "StudentImport",
      entityId: `import-${Date.now()}`,
      extra: { fileName: file.name, truncated },
    }
  );

  return NextResponse.json({
    created: created.length,
    skipped: errors.length,
    truncated,
    students: created,
    errors,
  });
}
