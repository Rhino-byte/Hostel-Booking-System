import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedNameRow = {
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

export function parseStudentCsv(text: string): ParsedNameRow[] {
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

export function parseStudentXlsx(buffer: Buffer): ParsedNameRow[] {
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
