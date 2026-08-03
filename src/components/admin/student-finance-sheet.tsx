"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MoneyText } from "@/components/money-text";
import { StatusBadge } from "@/components/status-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
} from "@/components/ui/sheet";
import type { FeeStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type StudentFinance = {
  student: {
    id: string;
    name: string;
    admissionNo: string;
    roomNumber: string | null;
  };
  term: { id: string; name: string; isActive: boolean };
  room: string | null;
  residence: { code: string; label: string; feeKes: number } | null;
  feeDue: number;
  feePaid: number;
  feeBalance: number;
  status: FeeStatus;
  hasActiveBooking: boolean;
  payments: {
    id: string;
    amount: number;
    date: string;
    mode: string;
    kind: string;
    referenceNo: string | null;
    voidedAt: string | null;
    voidReason: string | null;
    enteredBy: { name: string } | null;
  }[];
};

export function StudentFinanceSheet({
  studentId,
  open,
  onOpenChange,
  onAddPayment,
  onChanged,
}: {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPayment?: (studentId: string, label: string) => void;
  onChanged?: () => void;
}) {
  const [data, setData] = useState<StudentFinance | null>(null);
  const [loading, setLoading] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/students/${id}/finance`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not load student finance");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && studentId) {
      void load(studentId);
    }
    if (!open) {
      setData(null);
    }
  }, [open, studentId, load]);

  async function voidPayment(id: string) {
    setVoidingId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Entered in error" }),
      });
      if (!res.ok) {
        toast.error("Could not void payment");
        return;
      }
      toast.message("Payment voided");
      if (studentId) await load(studentId);
      onChanged?.();
    } finally {
      setVoidingId(null);
    }
  }

  // Group payments by calendar day for a readable timeline
  const byDay =
    data?.payments.reduce<
      Record<string, StudentFinance["payments"]>
    >((acc, p) => {
      const key = format(new Date(p.date), "yyyy-MM-dd");
      (acc[key] ??= []).push(p);
      return acc;
    }, {}) ?? {};

  const dayKeys = Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Student finance" className="max-w-lg">
        <SheetHeader>
          {loading || !data ? (
            <>
              <SheetTitle>Student finance</SheetTitle>
              <SheetDescription>Loading balance and payments…</SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle>{data.student.name}</SheetTitle>
              <SheetDescription>
                {data.term.name}
                {data.room ? ` · ${data.room}` : ""}
                {!data.hasActiveBooking ? " · No active room booking" : ""}
              </SheetDescription>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Adm {data.student.admissionNo}</span>
                {data.student.roomNumber &&
                data.student.roomNumber !== data.student.admissionNo ? (
                  <span>· Sheet room {data.student.roomNumber}</span>
                ) : null}
                {data.residence ? (
                  <Badge variant="outline">
                    {data.residence.label} ({data.residence.code})
                  </Badge>
                ) : null}
              </div>
            </>
          )}
        </SheetHeader>

        <SheetBody className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Due</p>
                  <MoneyText
                    amount={data.feeDue}
                    className="text-base font-semibold"
                  />
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <MoneyText
                    amount={data.feePaid}
                    className="text-base font-semibold text-primary"
                  />
                </div>
                <div className="rounded-xl border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <MoneyText
                    amount={data.feeBalance}
                    className="text-base font-semibold"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={data.status} />
                {data.feeBalance > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Outstanding <MoneyText amount={data.feeBalance} />
                  </span>
                ) : data.feeDue > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No outstanding balance
                  </span>
                ) : null}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium">Payment history</h3>
                {dayKeys.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    No payments recorded for this term yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {dayKeys.map((day) => (
                      <div key={day}>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {format(new Date(day), "EEE, dd MMM yyyy")}
                        </p>
                        <div className="space-y-2">
                          {(byDay[day] ?? []).map((p) => {
                            const voided = Boolean(p.voidedAt);
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2",
                                  voided && "opacity-60"
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="text-sm">
                                    {p.mode.replace("_", " ")}
                                    {p.referenceNo
                                      ? ` · Ref ${p.referenceNo}`
                                      : ""}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.enteredBy
                                      ? `by ${p.enteredBy.name}`
                                      : "System / sheet"}
                                    {voided ? " · Voided" : ""}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  {voided ? (
                                    <Badge variant="unpaid">Voided</Badge>
                                  ) : null}
                                  <MoneyText
                                    amount={p.amount}
                                    className={cn(
                                      "font-semibold",
                                      voided
                                        ? "line-through"
                                        : "text-primary"
                                    )}
                                  />
                                  {!voided ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={voidingId === p.id}
                                      onClick={() => void voidPayment(p.id)}
                                    >
                                      Void
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Could not load this student.
            </p>
          )}
        </SheetBody>

        {data && onAddPayment ? (
          <SheetFooter>
            <Button
              className="w-full"
              onClick={() => {
                onAddPayment(data.student.id, `${data.student.name} · ${data.room || data.student.admissionNo}`);
              }}
            >
              <Plus className="h-4 w-4" /> Add payment
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
