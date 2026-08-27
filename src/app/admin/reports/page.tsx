"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/money-text";
import { StatusBadge } from "@/components/status-badge";
import { paymentStatus } from "@/lib/utils";

type Row = {
  studentId: string;
  name: string;
  admissionNo: string;
  block: string;
  feeDue: number;
  feePaid: number;
  status: "CLEARED" | "PARTIAL" | "UNPAID" | "OVERPAID";
};

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [termName, setTermName] = useState("");

  useEffect(() => {
    async function load() {
      const [dash, students, payments, hostel] = await Promise.all([
        fetch("/api/dashboard").then((r) => r.json()),
        fetch("/api/students?limit=100").then((r) => r.json()),
        fetch("/api/payments").then((r) => r.json()),
        fetch("/api/hostel").then((r) => r.json()),
      ]);
      setTermName(dash.term?.name || "");
      const feeMap = new Map<string, number>();
      for (const p of payments.payments || []) {
        if (p.voidedAt || p.clearedAt) continue;
        feeMap.set(p.studentId, (feeMap.get(p.studentId) || 0) + p.amount);
      }
      const built: Row[] = (students.students || []).map(
        (s: {
          id: string;
          name: string;
          admissionNo: string;
          bookings: {
            residenceType: { feeKes: number };
            bed: { room: { block: { code: string } } };
          }[];
        }) => {
          const booking = s.bookings[0];
          const feeDue = booking?.residenceType.feeKes || 0;
          const feePaid = feeMap.get(s.id) || 0;
          return {
            studentId: s.id,
            name: s.name,
            admissionNo: s.admissionNo,
            block: booking?.bed.room.block.code || "—",
            feeDue,
            feePaid,
            status: paymentStatus(feeDue, feePaid),
          };
        }
      );
      setRows(built);
      void hostel;
    }
    load();
  }, []);

  function exportCsv() {
    const header = ["Name", "Admission", "Block", "FeeDue", "FeePaid", "Balance", "Status"];
    const lines = rows.map((r) =>
      [
        r.name,
        r.admissionNo,
        r.block,
        r.feeDue,
        r.feePaid,
        Math.max(0, r.feeDue - r.feePaid),
        r.status,
      ].join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `st-clare-balances-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printStatement(row: Row) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Statement — ${row.name}</title>
      <style>body{font-family:Georgia,serif;padding:40px;color:#1f2421} h1{color:#14532d}</style>
      </head><body>
      <h1>St. Clare's Girls Hostel</h1>
      <p>Student statement · ${termName}</p>
      <p><strong>${row.name}</strong> (${row.admissionNo}) · Block ${row.block}</p>
      <p>Fee due: KES ${row.feeDue.toLocaleString()}<br/>
      Paid: KES ${row.feePaid.toLocaleString()}<br/>
      Balance: KES ${Math.max(0, row.feeDue - row.feePaid).toLocaleString()}<br/>
      Status: ${row.status}</p>
      <p style="margin-top:40px;font-size:12px;color:#666">Generated ${new Date().toLocaleString()}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-primary">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Outstanding balances{termName ? ` for ${termName}` : ""}. Export or print statements.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.studentId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
            >
              <div>
                <p className="font-medium">
                  {r.name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {r.admissionNo} · {r.block}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Paid <MoneyText amount={r.feePaid} /> of <MoneyText amount={r.feeDue} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <MoneyText
                  amount={Math.max(0, r.feeDue - r.feePaid)}
                  className="font-semibold text-primary"
                />
                <Button size="sm" variant="ghost" onClick={() => printStatement(r)}>
                  Statement
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
