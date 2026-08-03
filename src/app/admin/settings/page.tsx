import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MoneyText } from "@/components/money-text";
import { Badge } from "@/components/ui/badge";
import { SheetSyncCard } from "@/components/admin/sheet-sync-card";
import { TermsManagementCard } from "@/components/admin/terms-management-card";
import { RecentAuditLog } from "@/components/admin/recent-audit-log";
import { UsersManagementCard } from "@/components/admin/users-management-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!["ADMIN", "SECRETARY"].includes(session.role)) {
    return (
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold text-primary">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Only administrators and the secretary can manage sync and system settings.
        </p>
      </div>
    );
  }

  const isAdmin = session.role === "ADMIN";

  const [residences, users, audits] = await Promise.all([
    prisma.residenceType.findMany({ orderBy: { sortOrder: "asc" } }),
    isAdmin ? prisma.user.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
    isAdmin
      ? prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: true },
        })
      : Promise.resolve([]),
  ]);

  const auditItems = audits.map((a) => ({
    id: a.id,
    action: a.action,
    entity: a.entity,
    userName: a.user?.name || "System",
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-primary">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Google Sheet sync, residence fees, terms
          {isAdmin ? ", users, and audit activity" : ""}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SheetSyncCard />

        <Card>
          <CardHeader>
            <CardTitle>Residence fees</CardTitle>
            <CardDescription>
              Semester fee is used for balances. Deposit amounts are brochure
              reference only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {residences.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <div>
                  <p className="font-medium">
                    {r.label} <Badge variant="gold">{r.code}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deposit (reference) <MoneyText amount={r.depositKes} />
                  </p>
                </div>
                <MoneyText amount={r.feeKes} className="font-semibold text-primary" />
              </div>
            ))}
          </CardContent>
        </Card>

        <TermsManagementCard isAdmin={isAdmin} />

        {isAdmin ? (
          <>
            <UsersManagementCard
              initialUsers={users.map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone,
                role: u.role,
                firebaseUid: u.firebaseUid,
              }))}
            />

            <RecentAuditLog audits={auditItems} />
          </>
        ) : null}
      </div>
    </div>
  );
}
