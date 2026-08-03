import { NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { newAdmissionNo } from "@/lib/admission";

const MAX_ROWS = 500;

type ImportError = {
  row: number;
  name: string;
  reason: string;
};

type ParsedRow = {
  row: number;
  name: string;
};

const NAME_HEADERS = new Set(["name", "full name", "fullname"]);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findColumnIndex(headers: string[], accepted: Set<string>): number {
  return headers.findIndex((h) => accepted.has(normalizeHeader(h)));
}

function parseCsv(text: string): ParsedRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors[0]?.message || "Could not parse CSV");
  }

  const fields = (parsed.meta.fields || []).map((f) => f.trim());
  const nameIdx = findColumnIndex(fields, NAME_HEADERS);
  if (nameIdx < 0) {
    throw new Error('File must include a "name" column header');
  }

  const nameKey = fields[nameIdx]!;

  return parsed.data.map((row, i) => ({
    row: i + 2,
    name: String(row[nameKey] ?? "").trim(),
  }));
}

function parseXlsx(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Excel file has no sheets");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!rows.length) throw new Error("Excel sheet is empty");

  const headerRow = (rows[0] || []).map((c) => String(c ?? "").trim());
  const nameIdx = findColumnIndex(headerRow, NAME_HEADERS);
  if (nameIdx < 0) {
    throw new Error('File must include a "name" column header');
  }

  return rows.slice(1).map((row, i) => ({
    row: i + 2,
    name: String(row[nameIdx] ?? "").trim(),
  }));
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

  let rows: ParsedRow[];
  try {
    if (isCsv) {
      rows = parseCsv(await file.text());
    } else {
      const buffer = Buffer.from(await file.arrayBuffer());
      rows = parseXlsx(buffer);
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse file" },
      { status: 400 }
    );
  }

  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `Too many rows (max ${MAX_ROWS})` },
      { status: 400 }
    );
  }

  const errors: ImportError[] = [];
  const toCreate: { row: number; name: string }[] = [];

  for (const row of rows) {
    if (!row.name) continue;

    if (row.name.length < 2) {
      errors.push({
        row: row.row,
        name: row.name,
        reason: "Name is required (min 2 characters)",
      });
      continue;
    }

    toCreate.push({ row: row.row, name: row.name });
  }

  let created = 0;
  for (const item of toCreate) {
    try {
      await prisma.student.create({
        data: {
          name: item.name,
          roomNumber: null,
          admissionNo: newAdmissionNo(),
        },
      });
      created += 1;
    } catch {
      errors.push({
        row: item.row,
        name: item.name,
        reason: "Could not save student",
      });
    }
  }

  const skipped = errors.length;

  await prisma.auditLog.create({
    data: {
      entity: "StudentImport",
      entityId: `import-${Date.now()}`,
      action: "CREATE",
      afterJson: JSON.stringify({
        fileName: file.name,
        created,
        skipped,
        errors: errors.slice(0, 50),
      }),
      userId: session.uid,
    },
  });

  return NextResponse.json({
    created,
    skipped,
    errors,
  });
}
