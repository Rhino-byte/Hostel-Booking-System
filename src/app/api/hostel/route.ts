import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { z } from "zod";

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  const blocks = await prisma.block.findMany({
    include: {
      residenceType: true,
      rooms: {
        include: {
          beds: {
            include: {
              bookings: {
                where: { status: "ACTIVE", ...(term ? { termId: term.id } : {}) },
                include: { student: true, residenceType: true },
              },
            },
          },
        },
        orderBy: { number: "asc" },
      },
    },
    orderBy: { code: "asc" },
  });

  return NextResponse.json({ blocks, term });
}

const assignSchema = z.object({
  studentId: z.string(),
  bedId: z.string(),
  termId: z.string(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY", "MATRON"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = assignSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const bed = await prisma.bed.findUnique({
    where: { id: parsed.data.bedId },
    include: { room: { include: { block: true } } },
  });
  if (!bed) {
    return NextResponse.json({ error: "Bed not found" }, { status: 404 });
  }

  const occupied = await prisma.booking.findFirst({
    where: {
      bedId: parsed.data.bedId,
      termId: parsed.data.termId,
      status: "ACTIVE",
    },
  });
  if (occupied) {
    return NextResponse.json(
      { error: "This bed is already occupied for the selected term" },
      { status: 409 }
    );
  }

  const existing = await prisma.booking.findFirst({
    where: {
      studentId: parsed.data.studentId,
      termId: parsed.data.termId,
      status: "ACTIVE",
    },
  });

  if (existing) {
    const updated = await prisma.booking.update({
      where: { id: existing.id },
      data: {
        bedId: parsed.data.bedId,
        residenceTypeId: bed.room.block.residenceTypeId,
        assignedById: session.uid,
      },
    });
    await prisma.bookingEvent.create({
      data: {
        bookingId: updated.id,
        action: "REASSIGN",
        fromBedId: existing.bedId,
        toBedId: parsed.data.bedId,
        userId: session.uid,
      },
    });
    await prisma.auditLog.create({
      data: {
        entity: "Booking",
        entityId: updated.id,
        action: "REASSIGN",
        beforeJson: JSON.stringify(existing),
        afterJson: JSON.stringify(updated),
        userId: session.uid,
      },
    });
    return NextResponse.json({ booking: updated });
  }

  const booking = await prisma.booking.create({
    data: {
      studentId: parsed.data.studentId,
      bedId: parsed.data.bedId,
      termId: parsed.data.termId,
      residenceTypeId: bed.room.block.residenceTypeId,
      assignedById: session.uid,
    },
  });
  await prisma.bookingEvent.create({
    data: {
      bookingId: booking.id,
      action: "ASSIGN",
      toBedId: parsed.data.bedId,
      userId: session.uid,
    },
  });
  await prisma.auditLog.create({
    data: {
      entity: "Booking",
      entityId: booking.id,
      action: "ASSIGN",
      afterJson: JSON.stringify(booking),
      userId: session.uid,
    },
  });

  return NextResponse.json({ booking });
}
