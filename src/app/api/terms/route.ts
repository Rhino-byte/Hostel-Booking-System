import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !["ADMIN", "SECRETARY"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeHidden = new URL(req.url).searchParams.get("includeHidden") === "1";
  const terms = await prisma.term.findMany({
    where: includeHidden ? undefined : { hiddenAt: null },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json({ terms });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  startDate: z.string().datetime({ offset: true }).or(z.string().min(4)),
  endDate: z.string().datetime({ offset: true }).or(z.string().min(4)),
  activate: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
  }
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 }
    );
  }

  const activate = parsed.data.activate === true;

  const term = await prisma.$transaction(async (tx) => {
    if (activate) {
      await tx.term.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }
    return tx.term.create({
      data: {
        name: parsed.data.name,
        startDate,
        endDate,
        isActive: activate,
        hiddenAt: null,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      entity: "Term",
      entityId: term.id,
      action: "CREATE",
      afterJson: JSON.stringify(term),
      userId: session.uid,
    },
  });

  return NextResponse.json({ term });
}
