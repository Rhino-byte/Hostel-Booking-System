import { PrismaClient } from "@prisma/client";
import { BLOCK_DEFS, RESIDENCE_DEFS } from "./hostel-layout";

const prisma = new PrismaClient();

async function main() {
  console.log("Rebuilding hostel layout (students, payments, terms, users kept)…");

  const ended = await prisma.booking.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "ENDED" },
  });
  console.log(`Ended ${ended.count} active booking(s).`);

  await prisma.bookingEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.room.deleteMany();
  await prisma.block.deleteMany();
  console.log("Cleared old blocks, rooms, and beds.");

  const byCode: Record<string, { id: string }> = {};

  for (const r of RESIDENCE_DEFS) {
    const residence = await prisma.residenceType.upsert({
      where: { code: r.code },
      create: {
        code: r.code,
        label: r.label,
        feeKes: r.feeKes,
        depositKes: r.depositKes,
        bathroom: r.bathroom,
        config: r.config,
        sortOrder: r.sortOrder,
        features: r.features,
      },
      update: {
        label: r.label,
        feeKes: r.feeKes,
        depositKes: r.depositKes,
        bathroom: r.bathroom,
        config: r.config,
        sortOrder: r.sortOrder,
        features: r.features,
      },
    });
    byCode[r.code] = residence;
  }
  console.log(`Upserted ${RESIDENCE_DEFS.length} residence type(s).`);

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

  const bedCount = BLOCK_DEFS.reduce((n, d) => n + d.rooms * d.bedsPer, 0);
  console.log(
    `Layout rebuilt: ${BLOCK_DEFS.map((d) => `${d.code}:${d.rooms}r`).join(", ")} (${bedCount} beds).`
  );
  console.log("Done. All beds are free.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
