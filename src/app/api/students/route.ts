import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { newAdmissionNo } from "@/lib/admission";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";
  const rawLimit = Number(searchParams.get("limit") || 50);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 50;
  const unbookedOnly =
    searchParams.get("unbooked") === "1" ||
    searchParams.get("unbooked") === "true";

  const students = await prisma.student.findMany({
    where: {
      AND: [
        { clearedAt: null },
        q
          ? {
              OR: [
                { name: { contains: q } },
                { admissionNo: { contains: q } },
                { roomNumber: { contains: q } },
                { guardianPhone: { contains: q } },
              ],
            }
          : {},
        // Exclude students who already have an active room assignment
        unbookedOnly
          ? { bookings: { none: { status: "ACTIVE" } } }
          : {},
      ],
    },
    orderBy: { name: "asc" },
    take: Math.min(limit, 500),
    include: {
      bookings: {
        where: { status: "ACTIVE" },
        include: {
          residenceType: true,
          bed: { include: { room: { include: { block: true } } } },
          term: true,
        },
        take: 1,
      },
    },
  });

  return NextResponse.json({ students });
}

const createSchema = z.object({
  name: z.string().min(2),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role === "PARENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const name = parsed.data.name.trim();

  const student = await prisma.student.create({
    data: {
      name,
      roomNumber: null,
      admissionNo: newAdmissionNo(),
    },
  });

  await prisma.auditLog.create({
    data: {
      entity: "Student",
      entityId: student.id,
      action: "CREATE",
      afterJson: JSON.stringify(student),
      userId: session.uid,
    },
  });

  return NextResponse.json({ student });
}
