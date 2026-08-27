"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Download, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/money-text";
import { StatusBadge } from "@/components/status-badge";
import { format } from "date-fns";
import { signOutFirebase } from "@/lib/firebase-client";

type PortalData = {
  user: { name: string };
  students: {
    id: string;
    name: string;
    admissionNo: string;
    classForm: string | null;
    feeDue: number;
    feePaid: number;
    feeBalance: number;
    status: "CLEARED" | "PARTIAL" | "UNPAID" | "OVERPAID";
    residence?: string;
    block?: string;
    payments: {
      id: string;
      amount: number;
      date: string;
      mode: string;
      kind: string;
      referenceNo: string | null;
    }[];
  }[];
};

function BalanceRing({ paid, due }: { paid: number; due: number }) {
  const pct = due <= 0 ? 0 : Math.min(100, Math.round((paid / due) * 100));
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#eef2ec" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="#14532d"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums text-primary">{pct}%</span>
        <span className="text-xs text-muted-foreground">paid</span>
      </div>
    </div>
  );
}

export default function ParentPortalPage() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);

  useEffect(() => {
    fetch("/api/parent/portal")
      .then(async (r) => {
        if (!r.ok) {
          router.push("/login?next=/parent");
          return null;
        }
        return r.json();
      })
      .then((d) => d && setData(d));
  }, [router]);

  async function logout() {
    await signOutFirebase();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function downloadStatement(student: PortalData["students"][0]) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Statement — ${student.name}</title>
      <style>body{font-family:Georgia,serif;padding:40px} h1{color:#14532d} table{width:100%;border-collapse:collapse;margin-top:20px} td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style>
      </head><body>
      <h1>St. Clare's Girls Hostel</h1>
      <p>Payment statement for <strong>${student.name}</strong> (${student.admissionNo})</p>
      <p>Fee due: KES ${student.feeDue.toLocaleString()} · Paid: KES ${student.feePaid.toLocaleString()} · Balance: KES ${student.feeBalance.toLocaleString()}</p>
      <table><thead><tr><th>Date</th><th>Mode</th><th>Ref</th><th>Amount</th></tr></thead>
      <tbody>
      ${student.payments
        .map(
          (p) =>
            `<tr><td>${new Date(p.date).toLocaleDateString()}</td><td>${p.mode}</td><td>${p.referenceNo || ""}</td><td>KES ${p.amount.toLocaleString()}</td></tr>`
        )
        .join("")}
      </tbody></table>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading your portal…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-primary">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Home className="h-4 w-4" />
            </span>
            <span className="font-serif font-semibold">Parent portal</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {data.user.name}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-primary">
            Welcome, {data.user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s a clear view of hostel fees and payments. Contact the office if something looks wrong.
          </p>
        </div>

        {data.students.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No students are linked to this phone yet. Please ask the hostel secretary to link your account.
            </CardContent>
          </Card>
        ) : (
          data.students.map((s) => (
            <Card key={s.id} className="shadow-soft">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{s.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {s.admissionNo}
                    {s.classForm ? ` · ${s.classForm}` : ""}
                    {s.residence ? ` · ${s.residence}` : ""}
                    {s.block ? ` (${s.block})` : ""}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => downloadStatement(s)}>
                  <Download className="h-4 w-4" /> Statement
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <BalanceRing paid={s.feePaid} due={s.feeDue} />
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Fee due</p>
                    <MoneyText amount={s.feeDue} className="font-semibold" />
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <MoneyText amount={s.feePaid} className="font-semibold text-primary" />
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <MoneyText amount={s.feeBalance} className="font-semibold" />
                  </div>
                </div>
                <div>
                  <h3 className="mb-3 font-serif text-lg font-semibold">Payment history</h3>
                  <div className="space-y-2">
                    {s.payments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                    ) : (
                      s.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {format(new Date(p.date), "dd MMM yyyy")} ·{" "}
                              {p.mode.replace("_", " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.mode.replace("_", " ")}
                              {p.referenceNo ? ` · ${p.referenceNo}` : ""}
                            </p>
                          </div>
                          <MoneyText amount={p.amount} className="font-semibold text-primary" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
