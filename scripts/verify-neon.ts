import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const summary = {
    students: await prisma.student.count(),
    payments: await prisma.payment.count(),
    users: await prisma.user.count(),
    beds: await prisma.bed.count(),
    bookings: await prisma.booking.count(),
    terms: await prisma.term.count(),
  };
  console.log("Neon connectivity OK:", summary);
  const active = await prisma.term.findFirst({ where: { isActive: true } });
  console.log("Active term:", active?.name ?? "(none)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
