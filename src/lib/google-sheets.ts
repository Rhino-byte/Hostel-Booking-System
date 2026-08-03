import { google, type sheets_v4 } from "googleapis";

export type SheetRow = {
  /** 1-based spreadsheet row number (header is row 1, first data row is 2) */
  rowNumber: number;
  name: string;
  no: string;
  date: string;
  amount: string;
  block: string;
  mode: string;
};

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

function getSheetsClient(): sheets_v4.Sheets {
  if (!isGoogleSheetsConfigured()) {
    throw new Error(
      "Google Sheets is not configured. Set GOOGLE_SHEETS_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }

  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(
    /\\n/g,
    "\n"
  );

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function spreadsheetId() {
  return process.env.GOOGLE_SHEETS_ID!;
}

function dataRange() {
  return process.env.GOOGLE_SHEETS_RANGE || "Sheet1!A2:F";
}

function sheetNameFromRange(range: string) {
  const bang = range.indexOf("!");
  return bang >= 0 ? range.slice(0, bang) : "Sheet1";
}

function cell(values: string[] | undefined, index: number): string {
  return (values?.[index] ?? "").toString().trim();
}

export async function readRows(): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const range = dataRange();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range,
  });

  const values = res.data.values || [];
  // A2 is spreadsheet row 2
  return values
    .map((row, i) => ({
      rowNumber: i + 2,
      name: cell(row as string[], 0),
      no: cell(row as string[], 1),
      date: cell(row as string[], 2),
      amount: cell(row as string[], 3),
      block: cell(row as string[], 4),
      mode: cell(row as string[], 5),
    }))
    .filter((r) => r.name || r.no);
}

export async function writeRow(
  rowNumber: number,
  values: {
    name?: string;
    no?: string;
    date?: string;
    amount?: string | number;
    block?: string;
    mode?: string;
  }
) {
  const sheets = getSheetsClient();
  const sheet = sheetNameFromRange(dataRange());
  const range = `${sheet}!A${rowNumber}:F${rowNumber}`;

  // Read existing so we only overwrite provided fields
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range,
  });
  const current = (existing.data.values?.[0] as string[] | undefined) || [];
  const next = [
    values.name !== undefined ? values.name : current[0] ?? "",
    values.no !== undefined ? String(values.no) : current[1] ?? "",
    values.date !== undefined ? values.date : current[2] ?? "",
    values.amount !== undefined ? String(values.amount) : current[3] ?? "",
    values.block !== undefined ? values.block : current[4] ?? "",
    values.mode !== undefined ? values.mode : current[5] ?? "",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [next] },
  });
}

export async function batchUpdateRows(
  updates: {
    rowNumber: number;
    values: (string | number | null | undefined)[];
  }[]
) {
  if (!updates.length) return;
  const sheets = getSheetsClient();
  const sheet = sheetNameFromRange(dataRange());

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: spreadsheetId(),
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({
        range: `${sheet}!A${u.rowNumber}:F${u.rowNumber}`,
        values: [u.values.map((v) => (v == null ? "" : String(v)))],
      })),
    },
  });
}

export async function updatePaymentColumns(
  rowNumber: number,
  data: { date: string; amount: number | string; block: string; mode: string }
) {
  const sheets = getSheetsClient();
  const sheet = sheetNameFromRange(dataRange());
  // Only DATE, AMOUNT, BLOCK, MODE (C:F) — leave NAME/NO alone
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${sheet}!C${rowNumber}:F${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[data.date, String(data.amount), data.block, data.mode]],
    },
  });
}
