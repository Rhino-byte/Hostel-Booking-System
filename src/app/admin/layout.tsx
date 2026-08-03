import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role === "PARENT") redirect("/parent");

  const term = await prisma.term.findFirst({ where: { isActive: true } });

  return <AdminShell termName={term?.name}>{children}</AdminShell>;
}
