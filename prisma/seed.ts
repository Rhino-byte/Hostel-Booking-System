import { PrismaClient, Role } from "@prisma/client";
import { BLOCK_DEFS, RESIDENCE_DEFS } from "./hostel-layout";

const prisma = new PrismaClient();

type StaffSeed = {
  role: Role;
  name: string;
  email: string;
  firebaseUid: string;
};

function staffFromEnv(
  role: Role,
  uidKey: string,
  emailKey: string,
  nameKey: string,
  defaultName: string
): StaffSeed | null {
  const firebaseUid = process.env[uidKey]?.trim();
  const email = process.env[emailKey]?.trim().toLowerCase();
  if (!firebaseUid || !email) return null;
  return {
    role,
    firebaseUid,
    email,
    name: process.env[nameKey]?.trim() || defaultName,
  };
}

async function main() {
  console.log("Seeding St. Clare hostel…");

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

  const residences = await Promise.all(
    RESIDENCE_DEFS.map((r) =>
      prisma.residenceType.create({
        data: {
          code: r.code,
          label: r.label,
          feeKes: r.feeKes,
          depositKes: r.depositKes,
          bathroom: r.bathroom,
          config: r.config,
          sortOrder: r.sortOrder,
          features: r.features,
        },
      })
    )
  );

  const byCode = Object.fromEntries(residences.map((r) => [r.code, r]));

  for (const def of BLOCK_DEFS) {
    const block = await prisma.block.create({
      data: {
        code: def.code,
        name: def.name,
        residenceTypeId: byCode[def.residence]!.id,
      },
    });
    for (let r = 1; r <= def.rooms; r++) {
      const room = await prisma.room.create({
        data: {
          blockId: block.id,
          number: String(r).padStart(2, "0"),
          capacity: def.bedsPer,
        },
      });
      for (let b = 1; b <= def.bedsPer; b++) {
        await prisma.bed.create({
          data: {
            roomId: room.id,
            label: def.bedsPer === 1 ? "1" : String.fromCharCode(64 + b),
          },
        });
      }
    }
  }

  const term = await prisma.term.create({
    data: {
      name: "Semester 1 2026",
      startDate: new Date("2026-01-15"),
      endDate: new Date("2026-05-31"),
      isActive: true,
    },
  });

  const staffSeeds = [
    staffFromEnv(
      Role.ADMIN,
      "SEED_ADMIN_FIREBASE_UID",
      "SEED_ADMIN_EMAIL",
      "SEED_ADMIN_NAME",
      "School Administrator"
    ),
    staffFromEnv(
      Role.SECRETARY,
      "SEED_SECRETARY_FIREBASE_UID",
      "SEED_SECRETARY_EMAIL",
      "SEED_SECRETARY_NAME",
      "Hostel Secretary"
    ),
    staffFromEnv(
      Role.MATRON,
      "SEED_MATRON_FIREBASE_UID",
      "SEED_MATRON_EMAIL",
      "SEED_MATRON_NAME",
      "Hostel Matron"
    ),
  ].filter((s): s is StaffSeed => Boolean(s));

  if (staffSeeds.length === 0) {
    console.warn(
      "No SEED_*_FIREBASE_UID / SEED_*_EMAIL set — creating no staff users. Add env vars and re-seed, or create users in Admin → Settings."
    );
  }

  let adminId: string | null = null;
  for (const s of staffSeeds) {
    const user = await prisma.user.create({
      data: {
        name: s.name,
        email: s.email,
        role: s.role,
        firebaseUid: s.firebaseUid,
      },
    });
    if (s.role === Role.ADMIN) adminId = user.id;
    console.log(`  Seeded ${s.role}: ${s.email} (${s.firebaseUid})`);
  }

  const bedCount = BLOCK_DEFS.reduce((n, d) => n + d.rooms * d.bedsPer, 0);

  console.log("Seed complete.");
  console.log(
    `Layout: ${BLOCK_DEFS.length} blocks, ${bedCount} beds. Residences include CL @ 47k.`
  );
  console.log("Students/payments come from Google Sheet sync (Settings → Sync now).");
  console.log("Sign in with Firebase email/password or Google (admin-provisioned accounts only).");
  console.log(`Active term: ${term.name}`);
  if (adminId) console.log(`Admin user id: ${adminId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
