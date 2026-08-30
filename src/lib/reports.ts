import {
  addDays,
  addWeeks,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { paymentStatus, type FeeStatus } from "@/lib/utils";

export type ReportGranularity = "week" | "day";

export type ReportRow = {
  studentId: string;
  name: string;
  admissionNo: string;
  block: string;
  feeDue: number;
  feePaid: number;
  balance: number;
  status: FeeStatus;
};

export type ReportTotals = {
  collected: number;
  outstanding: number;
  expected: number;
  collectionRate: number;
  paid: number;
  partial: number;
  unpaid: number;
  overpaid: number;
  booked: number;
};

export type CollectionBucket = {
  key: string;
  label: string;
  amount: number;
  cumulative: number;
};

type BookingInput = {
  studentId: string;
  student: { id: string; name: string; admissionNo: string };
  residenceType: { feeKes: number };
  bed: { room: { block: { code: string } } };
};

type OrphanStudentInput = {
  id: string;
  name: string;
  admissionNo: string;
};

type PaymentInput = {
  studentId: string;
  amount: number;
  date: Date;
};

function bucketDate(date: Date, granularity: ReportGranularity): Date {
  return granularity === "week"
    ? startOfWeek(date, { weekStartsOn: 1 })
    : startOfDay(date);
}

function bucketLabel(date: Date, granularity: ReportGranularity): string {
  const fmt = new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Nairobi",
  });
  const text = fmt.format(date);
  return granularity === "week" ? `Week of ${text}` : text;
}

export function buildCollectionsOverTime(
  payments: PaymentInput[],
  termStart: Date,
  termEnd: Date,
  granularity: ReportGranularity
): CollectionBucket[] {
  const now = new Date();
  const rangeEnd = termEnd < now ? termEnd : now;

  const amountsByKey = new Map<string, number>();
  for (const p of payments) {
    const bucket = bucketDate(p.date, granularity);
    const key = bucket.toISOString();
    amountsByKey.set(key, (amountsByKey.get(key) || 0) + p.amount);
  }

  const buckets: Date[] = [];
  let cursor = bucketDate(termStart, granularity);
  const endBucket = bucketDate(rangeEnd, granularity);

  while (cursor <= endBucket) {
    buckets.push(new Date(cursor));
    cursor =
      granularity === "week" ? addWeeks(cursor, 1) : addDays(cursor, 1);
  }

  let cumulative = 0;
  return buckets.map((d) => {
    const key = d.toISOString();
    const amount = amountsByKey.get(key) || 0;
    cumulative += amount;
    return {
      key,
      label: bucketLabel(d, granularity),
      amount,
      cumulative,
    };
  });
}

export function buildReportRows(
  bookings: BookingInput[],
  orphanStudents: OrphanStudentInput[],
  paidByStudent: Map<string, number>
): ReportRow[] {
  const rows: ReportRow[] = bookings.map((b) => {
    const feeDue = b.residenceType.feeKes;
    const feePaid = paidByStudent.get(b.studentId) || 0;
    const balance = Math.max(0, feeDue - feePaid);
    return {
      studentId: b.student.id,
      name: b.student.name,
      admissionNo: b.student.admissionNo,
      block: b.bed.room.block.code,
      feeDue,
      feePaid,
      balance,
      status: paymentStatus(feeDue, feePaid),
    };
  });

  for (const s of orphanStudents) {
    const feePaid = paidByStudent.get(s.id) || 0;
    if (feePaid <= 0) continue;
    rows.push({
      studentId: s.id,
      name: s.name,
      admissionNo: s.admissionNo,
      block: "—",
      feeDue: 0,
      feePaid,
      balance: 0,
      status: paymentStatus(0, feePaid),
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildReportTotals(
  rows: ReportRow[],
  payments: PaymentInput[]
): ReportTotals {
  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = rows.reduce((s, r) => s + r.balance, 0);
  const expected = collected + outstanding;
  const collectionRate =
    expected > 0 ? Math.round((collected / expected) * 100) : 0;

  let paid = 0;
  let partial = 0;
  let unpaid = 0;
  let overpaid = 0;

  for (const r of rows) {
    if (r.status === "CLEARED") paid += 1;
    else if (r.status === "PARTIAL") partial += 1;
    else if (r.status === "UNPAID") unpaid += 1;
    else if (r.status === "OVERPAID") overpaid += 1;
  }

  const booked = rows.filter((r) => r.feeDue > 0).length;

  return {
    collected,
    outstanding,
    expected,
    collectionRate,
    paid,
    partial,
    unpaid,
    overpaid,
    booked,
  };
}

export function slugifyTermName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeCsvField(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
