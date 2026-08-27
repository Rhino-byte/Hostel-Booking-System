import { createHash } from "crypto";
import type { PaymentMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  isGoogleSheetsConfigured,
  readRows,
  updatePaymentColumns,
  type SheetRow,
} from "@/lib/google-sheets";

export type SyncResult = {
  pulled: number;
  pushed: number;
  created: number;
  updated: number;
  conflicts: number;
  paymentsImported: number;
  bookingsAssigned: number;
  unbooked: string[];
  errors: string[];
  notes: string[];
};

const BLOCK_MAP: Record<string, string> = {
  A: "A",
  B: "B",
  C: "C",
  SC: "SC",
  S: "SC",
  SELF: "SC",
  "SELF-CONTAINED": "SC",
  SELFCONTAINED: "SC",
  CM: "CM",
  COMMON: "CM",
  COMMONROOMS: "CM",
  "COMMON-ROOMS": "CM",
  LU: "LU",
  LAUNCH: "LU",
  LAUNCHUPSTAIRS: "LU",
  "LAUNCH-UPSTAIRS": "LU",
  CL: "CM",
};

function normalizeBlock(raw: string): string | null {
  const key = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!key) return null;
  return BLOCK_MAP[key] ?? null;
}

function parseAmount(raw: string): number | null {
  if (!raw.trim()) return null;
  const n = Number(String(raw).replace(/[, ]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function parseSheetDate(raw: string): Date | null {
  if (!raw.trim()) return null;
  // Accept YYYY/MM/DD, YYYY-MM-DD, DD/MM/YYYY
  const s = raw.trim();
  const isoLike = s.replace(/\//g, "-");
  const d1 = new Date(isoLike);
  if (!Number.isNaN(d1.getTime())) return d1;

  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function mapMode(raw: string): PaymentMode {
  const u = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (u.includes("PAY") && u.includes("BILL")) return "PAY_BILL";
  if (u.includes("TILL")) return "TILL";
  if (u.includes("CASH")) return "CASH";
  if (u.includes("BANK")) return "BANK";
  if (!u) return "OTHER";
  if (u === "PAY_BILL" || u === "TILL" || u === "CASH" || u === "BANK" || u === "OTHER") {
    return u;
  }
  return "OTHER";
}

function modeLabel(mode: PaymentMode): string {
  switch (mode) {
    case "PAY_BILL":
      return "PAY BILL";
    case "TILL":
      return "TILL";
    case "CASH":
      return "CASH";
    case "BANK":
      return "BANK";
    default:
      return "OTHER";
  }
}

function formatSheetDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function sheetPaymentHash(admissionNo: string, date: Date, amount: number): string {
  const key = `${admissionNo}|${formatSheetDate(date)}|${amount}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

function dayBounds(d: Date) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function assignFreeBed(opts: {
  studentId: string;
  termId: string;
  blockCode: string;
  userId?: string | null;
}): Promise<{ ok: true; bedLabel: string } | { ok: false; reason: string }> {
  const block = await prisma.block.findUnique({
    where: { code: opts.blockCode },
    include: {
      rooms: {
        include: { beds: true },
        orderBy: { number: "asc" },
      },
    },
  });
  if (!block) return { ok: false, reason: `Unknown block ${opts.blockCode}` };

  const occupied = await prisma.booking.findMany({
    where: { termId: opts.termId, status: "ACTIVE" },
    select: { bedId: true, studentId: true },
  });
  const occupiedBedIds = new Set(occupied.map((o) => o.bedId));

  // Already booked this term?
  const existing = occupied.find((o) => o.studentId === opts.studentId);
  if (existing) {
    // Ensure residence type matches block if already booked elsewhere — leave as-is
    return { ok: true, bedLabel: "already-booked" };
  }

  let freeBedId: string | null = null;
  for (const room of block.rooms) {
    for (const bed of room.beds) {
      if (!occupiedBedIds.has(bed.id)) {
        freeBedId = bed.id;
        break;
      }
    }
    if (freeBedId) break;
  }

  if (!freeBedId) {
    return { ok: false, reason: `Block ${opts.blockCode} is full` };
  }

  const booking = await prisma.booking.create({
    data: {
      studentId: opts.studentId,
      bedId: freeBedId,
      termId: opts.termId,
      residenceTypeId: block.residenceTypeId,
      assignedById: opts.userId || null,
      notes: "Auto-assigned from Google Sheet sync",
    },
  });
  await prisma.bookingEvent.create({
    data: {
      bookingId: booking.id,
      action: "ASSIGN",
      toBedId: freeBedId,
      userId: opts.userId || null,
      note: "Sheet sync",
    },
  });

  return { ok: true, bedLabel: freeBedId };
}

async function pullFromSheet(
  result: SyncResult,
  userId?: string | null
): Promise<void> {
  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) {
    result.errors.push("No active term configured");
    return;
  }

  const blocks = await prisma.block.findMany({ include: { residenceType: true } });
  const residenceByBlockCode = Object.fromEntries(
    blocks.map((b) => [b.code, b.residenceType])
  );

  let rows: SheetRow[];
  try {
    rows = await readRows();
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : "Failed to read sheet");
    return;
  }

  result.pulled = rows.length;

  for (const row of rows) {
    if (!row.no) {
      result.notes.push(`Skipped row ${row.rowNumber}: missing NO`);
      continue;
    }

    const admissionNo = String(row.no).trim();
    const name = row.name.trim() || `Student ${admissionNo}`;
    const blockCode = normalizeBlock(row.block);
    const residence = blockCode ? residenceByBlockCode[blockCode] ?? null : null;

    const existing = await prisma.student.findFirst({
      where: {
        OR: [{ admissionNo }, { sheetRowNo: row.rowNumber }],
      },
    });

    let studentId: string;
    if (existing) {
      const nameChanged = existing.name !== name;
      await prisma.student.update({
        where: { id: existing.id },
        data: {
          name, // sheet wins for NAME
          admissionNo,
          sheetRowNo: row.rowNumber,
          clearedAt: null, // restore if soft-cleared for a new semester
          ...(residence ? { residenceTypeId: residence.id } : {}),
        },
      });
      studentId = existing.id;
      if (nameChanged || existing.sheetRowNo !== row.rowNumber) {
        result.updated += 1;
      }
    } else {
      const created = await prisma.student.create({
        data: {
          name,
          admissionNo,
          sheetRowNo: row.rowNumber,
          residenceTypeId: residence?.id ?? null,
        },
      });
      studentId = created.id;
      result.created += 1;
    }

    // Auto-assign bed when block is present
    if (blockCode) {
      const assign = await assignFreeBed({
        studentId,
        termId: term.id,
        blockCode,
        userId,
      });
      if (assign.ok) {
        if (assign.bedLabel !== "already-booked") {
          result.bookingsAssigned += 1;
        }
      } else {
        result.conflicts += 1;
        result.unbooked.push(`${name} (${admissionNo}): ${assign.reason}`);
      }
    }

    // Import sheet payment if present and not already in app
    const amount = parseAmount(row.amount);
    const date = parseSheetDate(row.date);
    if (amount && date) {
      const hash = sheetPaymentHash(admissionNo, date, amount);
      const byHash = await prisma.payment.findFirst({
        where: { sheetHash: hash, voidedAt: null },
      });
      if (byHash) continue;

      const { start, end } = dayBounds(date);
      const duplicate = await prisma.payment.findFirst({
        where: {
          studentId,
          termId: term.id,
          amount,
          voidedAt: null,
          date: { gte: start, lte: end },
        },
      });
      if (duplicate) continue;

      // App is ledger: if student already has APP payments totaling this amount on same day, skip
      await prisma.payment.create({
        data: {
          studentId,
          termId: term.id,
          amount,
          date,
          mode: mapMode(row.mode),
          kind: "FEE",
          source: "SHEET",
          sheetHash: hash,
          blockCode: blockCode || row.block || null,
          notes: "Imported from Google Sheet",
          enteredById: userId || null,
        },
      });
      result.paymentsImported += 1;
    }
  }
}

export async function pushStudentSummary(studentId: string): Promise<boolean> {
  if (!isGoogleSheetsConfigured()) return false;

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) return false;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      bookings: {
        where: { status: "ACTIVE", termId: term.id },
        include: {
          bed: { include: { room: { include: { block: true } } } },
        },
        take: 1,
      },
      payments: {
        where: { termId: term.id, voidedAt: null, clearedAt: null },
        orderBy: { date: "desc" },
      },
    },
  });
  if (!student?.sheetRowNo) return false;

  const totalPaid = student.payments.reduce((s, p) => s + p.amount, 0);
  const latest = student.payments[0];
  const block =
    student.bookings[0]?.bed.room.block.code ||
    (student.residenceTypeId
      ? (
          await prisma.residenceType.findUnique({
            where: { id: student.residenceTypeId },
          })
        )?.code || ""
      : "");

  // App wins for AMOUNT/DATE/MODE; leave blank if no payments yet
  if (!latest && totalPaid === 0) {
    await updatePaymentColumns(student.sheetRowNo, {
      date: "",
      amount: "",
      block,
      mode: "",
    });
    return true;
  }

  await updatePaymentColumns(student.sheetRowNo, {
    date: latest ? formatSheetDate(latest.date) : "",
    amount: totalPaid,
    block,
    mode: latest ? modeLabel(latest.mode) : "",
  });
  return true;
}

async function pushAllSummaries(result: SyncResult): Promise<void> {
  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) return;

  const students = await prisma.student.findMany({
    where: { sheetRowNo: { not: null } },
    select: { id: true },
  });

  for (const s of students) {
    try {
      const ok = await pushStudentSummary(s.id);
      if (ok) result.pushed += 1;
    } catch (e) {
      result.errors.push(
        `Push failed for ${s.id}: ${e instanceof Error ? e.message : "unknown"}`
      );
    }
  }
}

export async function syncAll(opts?: {
  userId?: string | null;
  direction?: "PULL" | "PUSH" | "BOTH";
}): Promise<SyncResult & { syncLogId: string }> {
  const direction = opts?.direction ?? "BOTH";
  const result: SyncResult = {
    pulled: 0,
    pushed: 0,
    created: 0,
    updated: 0,
    conflicts: 0,
    paymentsImported: 0,
    bookingsAssigned: 0,
    unbooked: [],
    errors: [],
    notes: [],
  };

  if (!isGoogleSheetsConfigured()) {
    result.errors.push(
      "Google Sheets is not configured. Add service account credentials to .env and share the sheet as Editor."
    );
    const log = await prisma.syncLog.create({
      data: {
        direction,
        errorsJson: JSON.stringify(result.errors),
        notesJson: JSON.stringify({ unbooked: result.unbooked, notes: result.notes }),
        userId: opts?.userId || null,
      },
    });
    return { ...result, syncLogId: log.id };
  }

  if (direction === "PULL" || direction === "BOTH") {
    await pullFromSheet(result, opts?.userId);
  }
  if (direction === "PUSH" || direction === "BOTH") {
    await pushAllSummaries(result);
  }

  const log = await prisma.syncLog.create({
    data: {
      direction,
      pulled: result.pulled,
      pushed: result.pushed,
      created: result.created,
      updated: result.updated,
      conflicts: result.conflicts,
      errorsJson: result.errors.length ? JSON.stringify(result.errors) : null,
      notesJson: JSON.stringify({
        paymentsImported: result.paymentsImported,
        bookingsAssigned: result.bookingsAssigned,
        unbooked: result.unbooked,
        notes: result.notes,
      }),
      userId: opts?.userId || null,
    },
  });

  return { ...result, syncLogId: log.id };
}

export async function getLastSyncLog() {
  return prisma.syncLog.findFirst({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true } } },
  });
}
