/**
 * Upsert ADMIN / SECRETARY / MATRON from SEED_* env into Neon.
 * Does not print emails or UIDs.
 */
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

type Staff = {
  role: Role;
  name: string;
  email: string;
  firebaseUid: string;
};

function fromEnv(
  role: Role,
  uidKey: string,
  emailKey: string,
  nameKey: string,
  defaultName: string
): Staff | null {
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

async function upsertStaff(s: Staff) {
  const byUid = await prisma.user.findFirst({
    where: { firebaseUid: s.firebaseUid },
  });
  const byEmail = await prisma.user.findFirst({
    where: { email: s.email },
  });
  const byRole = await prisma.user.findFirst({
    where: { role: s.role },
    orderBy: { createdAt: "asc" },
  });

  const existing = byUid || byEmail || byRole;

  if (existing) {
    // Clear conflicting unique fields on other rows
    await prisma.user.updateMany({
      where: {
        id: { not: existing.id },
        OR: [{ email: s.email }, { firebaseUid: s.firebaseUid }],
      },
      data: { email: null, firebaseUid: null },
    });

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: s.name,
        email: s.email,
        firebaseUid: s.firebaseUid,
        role: s.role,
      },
    });
    return "updated";
  }

  await prisma.user.create({
    data: {
      name: s.name,
      email: s.email,
      firebaseUid: s.firebaseUid,
      role: s.role,
    },
  });
  return "created";
}

async function main() {
  const staff = [
    fromEnv(
      Role.ADMIN,
      "SEED_ADMIN_FIREBASE_UID",
      "SEED_ADMIN_EMAIL",
      "SEED_ADMIN_NAME",
      "School Administrator"
    ),
    fromEnv(
      Role.SECRETARY,
      "SEED_SECRETARY_FIREBASE_UID",
      "SEED_SECRETARY_EMAIL",
      "SEED_SECRETARY_NAME",
      "Hostel Secretary"
    ),
    fromEnv(
      Role.MATRON,
      "SEED_MATRON_FIREBASE_UID",
      "SEED_MATRON_EMAIL",
      "SEED_MATRON_NAME",
      "Hostel Matron"
    ),
  ].filter((s): s is Staff => Boolean(s));

  if (!staff.length) {
    throw new Error("No SEED_*_FIREBASE_UID / SEED_*_EMAIL set in .env");
  }

  for (const s of staff) {
    const action = await upsertStaff(s);
    console.log(`${s.role}: ${action}`);
  }
  console.log("Staff Firebase identities synced. Try signing in again.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
