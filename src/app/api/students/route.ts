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
  const rawOffset = Number(searchParams.get("offset") || 0);
  const offset =
    Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;
  const unbookedOnly =
    searchParams.get("unbooked") === "1" ||
    searchParams.get("unbooked") === "true";

  const where = {
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
      unbookedOnly
        ? { bookings: { none: { status: "ACTIVE" } } }
        : {},
    ],
  };

  const take = Math.min(limit, 500);

  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: { name: "asc" },
      skip: offset,
      take,
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
        _count: {
          select: {
            payments: {
              where: { voidedAt: null, clearedAt: null },
            },
          },
        },
      },
    }),
  ]);

  const canDeleteRole = ["ADMIN", "SECRETARY"].includes(session.role);
  const students = rows.map(({ _count, ...student }) => {
    const hasLivePayments = _count.payments > 0;
    return {
      ...student,
      hasLivePayments,
      canDelete: canDeleteRole && !hasLivePayments,
    };
  });

  return NextResponse.json({ students, total, limit: take, offset });
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
