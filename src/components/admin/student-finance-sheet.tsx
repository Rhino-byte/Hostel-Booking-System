"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeeStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PAYMENT_MODES = ["PAY_BILL", "TILL", "CASH", "BANK", "OTHER"] as const;

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
  latestEditablePaymentId: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMode, setEditMode] = useState<string>("PAY_BILL");
  const [editRef, setEditRef] = useState("");
  const [canEditPayments, setCanEditPayments] = useState(false);

  const load = useCallback(async (id: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setData(null);
    }
    try {
      const res = await fetch(`/api/students/${id}/finance`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not load student finance");
        return;
      }
      setData(json);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && studentId) {
      void load(studentId);
    }
    if (!open) {
      setData(null);
      setEditingId(null);
    }
  }, [open, studentId, load]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!alive) return;
        const role = json?.user?.role as string | undefined;
        setCanEditPayments(role === "ADMIN" || role === "SECRETARY");
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open]);

  function startEdit(p: StudentFinance["payments"][number]) {
    setEditingId(p.id);
    setEditDate(format(new Date(p.date), "yyyy-MM-dd"));
    setEditAmount(String(p.amount));
    setEditMode(p.mode);
    setEditRef(p.referenceNo || "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const amount = Number(editAmount);
    if (!editDate) {
      toast.error("Date is required");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/payments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          date: editDate,
          mode: editMode,
          referenceNo: editRef.trim() ? editRef.trim() : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Could not update payment");
        return;
      }
      toast.success("Payment updated");
      setEditingId(null);
      if (studentId) await load(studentId, true);
      onChanged?.();
    } finally {
      setSavingEdit(false);
    }
  }

  async function voidPayment(id: string) {
    setVoidingId(id);
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Entered in error" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error || "Could not void payment");
        return;
      }
      toast.message("Payment voided");
      if (studentId) await load(studentId, true);
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
                            const editing = editingId === p.id;
                            const isEditable =
                              canEditPayments &&
                              !voided &&
                              data.latestEditablePaymentId === p.id;
                            return (
                              <div
                                key={p.id}
                                className={cn(
                                  "rounded-xl border border-border px-3 py-2",
                                  voided && "opacity-60"
                                )}
                              >
                                {editing ? (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label htmlFor={`edit-date-${p.id}`}>
                                          Date
                                        </Label>
                                        <Input
                                          id={`edit-date-${p.id}`}
                                          type="date"
                                          value={editDate}
                                          onChange={(e) =>
                                            setEditDate(e.target.value)
                                          }
                                          required
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label htmlFor={`edit-amount-${p.id}`}>
                                          Amount (KES)
                                        </Label>
                                        <Input
                                          id={`edit-amount-${p.id}`}
                                          inputMode="numeric"
                                          value={editAmount}
                                          onChange={(e) =>
                                            setEditAmount(
                                              e.target.value.replace(
                                                /[^\d]/g,
                                                ""
                                              )
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Mode</Label>
                                      <Select
                                        value={editMode}
                                        onValueChange={setEditMode}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {PAYMENT_MODES.map((m) => (
                                            <SelectItem key={m} value={m}>
                                              {m.replace("_", " ")}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor={`edit-ref-${p.id}`}>
                                        Reference
                                      </Label>
                                      <Input
                                        id={`edit-ref-${p.id}`}
                                        value={editRef}
                                        onChange={(e) =>
                                          setEditRef(e.target.value)
                                        }
                                        placeholder="Optional"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={savingEdit}
                                        onClick={() => setEditingId(null)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={savingEdit}
                                        onClick={() => void saveEdit()}
                                      >
                                        {savingEdit ? "Saving…" : "Save"}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-3">
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
                                        <>
                                          {isEditable ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              disabled={
                                                voidingId === p.id ||
                                                Boolean(editingId)
                                              }
                                              onClick={() => startEdit(p)}
                                            >
                                              Edit
                                            </Button>
                                          ) : null}
                                          {isEditable ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              disabled={
                                                voidingId === p.id ||
                                                Boolean(editingId)
                                              }
                                              onClick={() =>
                                                void voidPayment(p.id)
                                              }
                                            >
                                              Void
                                            </Button>
                                          ) : null}
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
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
