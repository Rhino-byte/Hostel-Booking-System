/**
 * One-shot: copy rows from local SQLite (prisma/dev.db) into Neon Postgres (DATABASE_URL).
 * Usage: npm run db:migrate-neon [-- --force]
 */
import path from "path";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const force = process.argv.includes("--force");
const sqlitePath = path.resolve(
  process.env.SQLITE_MIGRATE_PATH || "./prisma/dev.db"
);

const prisma = new PrismaClient();

function asBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return Boolean(v);
}

function asDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" && Number.isFinite(v)) {
    // SQLite often stores ms (or s) unix timestamps
    return new Date(v < 1e12 ? v * 1000 : v);
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (/^\d+$/.test(trimmed)) {
      const n = Number(trimmed);
      return new Date(n < 1e12 ? n * 1000 : n);
    }
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function asDateRequired(v: unknown): Date {
  const d = asDate(v);
  if (!d) throw new Error(`Invalid date: ${String(v)}`);
  return d;
}

function rows(db: Database.Database, table: string): Record<string, unknown>[] {
  return db.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
}

async function assertEmptyOrForce() {
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.residenceType.count(),
    prisma.payment.count(),
  ]);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total > 0 && !force) {
    throw new Error(
      `Neon already has data (users=${counts[0]}, students=${counts[1]}, residences=${counts[2]}, payments=${counts[3]}). Re-run with --force to wipe app tables first.`
    );
  }
  if (total > 0 && force) {
    console.log("(--force) Clearing Neon app tables…");
    await prisma.syncLog.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.bookingEvent.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.bed.deleteMany();
    await prisma.room.deleteMany();
    await prisma.block.deleteMany();
    await prisma.studentGuardian.deleteMany();
    await prisma.student.deleteMany();
    await prisma.term.deleteMany();
    await prisma.residenceType.deleteMany();
    await prisma.user.deleteMany();
    await prisma.contactEnquiry.deleteMany();
  }
}

async function main() {
  console.log(`SQLite source: ${sqlitePath}`);
  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });

  await assertEmptyOrForce();

  const residenceTypes = rows(db, "ResidenceType");
  const users = rows(db, "User");
  const terms = rows(db, "Term");
  const blocks = rows(db, "Block");
  const rooms = rows(db, "Room");
  const beds = rows(db, "Bed");
  const students = rows(db, "Student");
  const guardians = rows(db, "StudentGuardian");
  const bookings = rows(db, "Booking");
  const bookingEvents = rows(db, "BookingEvent");
  const payments = rows(db, "Payment");
  const audits = rows(db, "AuditLog");
  const syncLogs = rows(db, "SyncLog");
  const enquiries = rows(db, "ContactEnquiry");

  console.log("Inserting into Neon…");

  if (residenceTypes.length) {
    await prisma.residenceType.createMany({
      data: residenceTypes.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        label: String(r.label),
        feeKes: Number(r.feeKes),
        depositKes: Number(r.depositKes),
        bathroom: r.bathroom as "PRIVATE" | "SHARED",
        config: r.config as "PRIVATE_SINGLE" | "SHARED_SINGLE" | "SHARED_BUNK",
        features: String(r.features),
        sortOrder: Number(r.sortOrder ?? 0),
      })),
    });
  }

  if (users.length) {
    await prisma.user.createMany({
      data: users.map((u) => ({
        id: String(u.id),
        firebaseUid: u.firebaseUid != null ? String(u.firebaseUid) : null,
        phone: u.phone != null ? String(u.phone) : null,
        email: u.email != null ? String(u.email) : null,
        name: String(u.name),
        role: u.role as "ADMIN" | "SECRETARY" | "MATRON" | "PARENT",
        createdAt: asDateRequired(u.createdAt),
        updatedAt: asDateRequired(u.updatedAt),
      })),
    });
  }

  if (terms.length) {
    await prisma.term.createMany({
      data: terms.map((t) => ({
        id: String(t.id),
        name: String(t.name),
        startDate: asDateRequired(t.startDate),
        endDate: asDateRequired(t.endDate),
        isActive: asBool(t.isActive),
        hiddenAt: asDate(t.hiddenAt),
        createdAt: asDateRequired(t.createdAt),
      })),
    });
  }

  if (blocks.length) {
    await prisma.block.createMany({
      data: blocks.map((b) => ({
        id: String(b.id),
        name: String(b.name),
        code: String(b.code),
        residenceTypeId: String(b.residenceTypeId),
      })),
    });
  }

  if (rooms.length) {
    await prisma.room.createMany({
      data: rooms.map((r) => ({
        id: String(r.id),
        blockId: String(r.blockId),
        number: String(r.number),
        capacity: Number(r.capacity ?? 1),
      })),
    });
  }

  if (beds.length) {
    await prisma.bed.createMany({
      data: beds.map((b) => ({
        id: String(b.id),
        roomId: String(b.roomId),
        label: String(b.label),
      })),
    });
  }

  if (students.length) {
    await prisma.student.createMany({
      data: students.map((s) => ({
        id: String(s.id),
        admissionNo: String(s.admissionNo),
        name: String(s.name),
        roomNumber: s.roomNumber != null ? String(s.roomNumber) : null,
        classForm: s.classForm != null ? String(s.classForm) : null,
        phone: s.phone != null ? String(s.phone) : null,
        guardianName: s.guardianName != null ? String(s.guardianName) : null,
        guardianPhone: s.guardianPhone != null ? String(s.guardianPhone) : null,
        guardianEmail: s.guardianEmail != null ? String(s.guardianEmail) : null,
        sheetRowNo: s.sheetRowNo != null ? Number(s.sheetRowNo) : null,
        residenceTypeId:
          s.residenceTypeId != null ? String(s.residenceTypeId) : null,
        clearedAt: asDate(s.clearedAt),
        createdAt: asDateRequired(s.createdAt),
        updatedAt: asDateRequired(s.updatedAt),
      })),
    });
  }

  if (guardians.length) {
    await prisma.studentGuardian.createMany({
      data: guardians.map((g) => ({
        id: String(g.id),
        studentId: String(g.studentId),
        userId: g.userId != null ? String(g.userId) : null,
        phone: String(g.phone),
        createdAt: asDateRequired(g.createdAt),
      })),
    });
  }

  if (bookings.length) {
    await prisma.booking.createMany({
      data: bookings.map((b) => ({
        id: String(b.id),
        studentId: String(b.studentId),
        bedId: String(b.bedId),
        termId: String(b.termId),
        residenceTypeId: String(b.residenceTypeId),
        status: b.status as "ACTIVE" | "ENDED" | "CANCELLED",
        assignedById: b.assignedById != null ? String(b.assignedById) : null,
        notes: b.notes != null ? String(b.notes) : null,
        createdAt: asDateRequired(b.createdAt),
        updatedAt: asDateRequired(b.updatedAt),
      })),
    });
  }

  if (bookingEvents.length) {
    await prisma.bookingEvent.createMany({
      data: bookingEvents.map((e) => ({
        id: String(e.id),
        bookingId: String(e.bookingId),
        action: String(e.action),
        fromBedId: e.fromBedId != null ? String(e.fromBedId) : null,
        toBedId: e.toBedId != null ? String(e.toBedId) : null,
        note: e.note != null ? String(e.note) : null,
        userId: e.userId != null ? String(e.userId) : null,
        createdAt: asDateRequired(e.createdAt),
      })),
    });
  }

  if (payments.length) {
    await prisma.payment.createMany({
      data: payments.map((p) => ({
        id: String(p.id),
        studentId: String(p.studentId),
        termId: String(p.termId),
        amount: Number(p.amount),
        date: asDateRequired(p.date),
        mode: p.mode as "PAY_BILL" | "TILL" | "CASH" | "BANK" | "OTHER",
        kind: (p.kind as "FEE" | "DEPOSIT") || "FEE",
        source: (p.source as "APP" | "SHEET") || "APP",
        sheetHash: p.sheetHash != null ? String(p.sheetHash) : null,
        referenceNo: p.referenceNo != null ? String(p.referenceNo) : null,
        blockCode: p.blockCode != null ? String(p.blockCode) : null,
        notes: p.notes != null ? String(p.notes) : null,
        enteredById: p.enteredById != null ? String(p.enteredById) : null,
        voidedAt: asDate(p.voidedAt),
        voidReason: p.voidReason != null ? String(p.voidReason) : null,
        clearedAt: asDate(p.clearedAt),
        createdAt: asDateRequired(p.createdAt),
        updatedAt: asDateRequired(p.updatedAt),
      })),
    });
  }

  if (audits.length) {
    await prisma.auditLog.createMany({
      data: audits.map((a) => ({
        id: String(a.id),
        entity: String(a.entity),
        entityId: String(a.entityId),
        action: a.action as
          | "CREATE"
          | "UPDATE"
          | "VOID"
          | "DELETE"
          | "ASSIGN"
          | "REASSIGN",
        beforeJson: a.beforeJson != null ? String(a.beforeJson) : null,
        afterJson: a.afterJson != null ? String(a.afterJson) : null,
        userId: a.userId != null ? String(a.userId) : null,
        createdAt: asDateRequired(a.createdAt),
      })),
    });
  }

  if (syncLogs.length) {
    await prisma.syncLog.createMany({
      data: syncLogs.map((s) => ({
        id: String(s.id),
        direction: (s.direction as "PULL" | "PUSH" | "BOTH") || "BOTH",
        pulled: Number(s.pulled ?? 0),
        pushed: Number(s.pushed ?? 0),
        created: Number(s.created ?? 0),
        updated: Number(s.updated ?? 0),
        conflicts: Number(s.conflicts ?? 0),
        errorsJson: s.errorsJson != null ? String(s.errorsJson) : null,
        notesJson: s.notesJson != null ? String(s.notesJson) : null,
        userId: s.userId != null ? String(s.userId) : null,
        createdAt: asDateRequired(s.createdAt),
      })),
    });
  }

  if (enquiries.length) {
    await prisma.contactEnquiry.createMany({
      data: enquiries.map((c) => ({
        id: String(c.id),
        name: String(c.name),
        phone: String(c.phone),
        email: c.email != null ? String(c.email) : null,
        message: String(c.message),
        createdAt: asDateRequired(c.createdAt),
      })),
    });
  }

  db.close();

  const summary = {
    residenceTypes: await prisma.residenceType.count(),
    users: await prisma.user.count(),
    terms: await prisma.term.count(),
    blocks: await prisma.block.count(),
    rooms: await prisma.room.count(),
    beds: await prisma.bed.count(),
    students: await prisma.student.count(),
    guardians: await prisma.studentGuardian.count(),
    bookings: await prisma.booking.count(),
    bookingEvents: await prisma.bookingEvent.count(),
    payments: await prisma.payment.count(),
    audits: await prisma.auditLog.count(),
    syncLogs: await prisma.syncLog.count(),
    enquiries: await prisma.contactEnquiry.count(),
  };

  console.log("Migration complete. Neon counts:");
  console.log(summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
