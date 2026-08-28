"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Plus, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MoneyText } from "@/components/money-text";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { StudentFinanceSheet } from "@/components/admin/student-finance-sheet";
import { SegmentedTabs } from "@/components/admin/segmented-tabs";
import { Stagger } from "@/components/motion";
import type { FeeStatus } from "@/lib/utils";

type Payment = {
  id: string;
  studentId: string;
  amount: number;
  date: string;
  mode: string;
  kind: string;
  referenceNo: string | null;
  voidedAt: string | null;
  clearedAt?: string | null;
  student: {
    id: string;
    name: string;
    admissionNo: string;
    roomNumber?: string | null;
  };
  enteredBy: { name: string } | null;
  studentStatus: FeeStatus;
  feeDue: number;
  feePaid: number;
  feeBalance: number;
  isEditable?: boolean;
};

type StudentHit = {
  id: string;
  name: string;
  admissionNo: string;
  roomNumber?: string | null;
  bookings?: {
    bed: { label: string; room: { number: string; block: { code: string } } };
  }[];
};

type StatusFilter = "all" | FeeStatus;

function roomHint(s: StudentHit): string {
  const b = s.bookings?.[0];
  if (b) {
    const bed = b.bed.label !== "1" ? b.bed.label : "";
    return `${b.bed.room.block.code}-${b.bed.room.number}${bed}`;
  }
  return s.roomNumber || s.admissionNo;
}

function PaymentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(true);

  const [lookupQ, setLookupQ] = useState("");
  const [lookupHits, setLookupHits] = useState<StudentHit[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [financeStudentId, setFinanceStudentId] = useState<string | null>(null);
  const [financeOpen, setFinanceOpen] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [selectedStudentLabel, setSelectedStudentLabel] = useState("");
  const [pickerQ, setPickerQ] = useState("");
  const [pickerHits, setPickerHits] = useState<StudentHit[]>([]);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("PAY_BILL");
  const [referenceNo, setReferenceNo] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, hRes] = await Promise.all([
        fetch("/api/payments"),
        fetch("/api/hostel"),
      ]);
      if (!pRes.ok) {
        const p = await pRes.json().catch(() => ({}));
        toast.error(p.error || "Could not load payments");
        return;
      }
      if (!hRes.ok) {
        const h = await hRes.json().catch(() => ({}));
        toast.error(h.error || "Could not load payments");
        return;
      }
      const p = await pRes.json().catch(() => ({}));
      const h = await hRes.json().catch(() => ({}));
      setPayments(p.payments || []);
      setTermId(h.term?.id || "");
    } catch {
      toast.error("Could not load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  // Deep link: ?studentId=
  useEffect(() => {
    const sid = searchParams.get("studentId");
    if (sid) {
      setFinanceStudentId(sid);
      setFinanceOpen(true);
    }
  }, [searchParams]);

  // Debounced student lookup for primary search
  useEffect(() => {
    const q = lookupQ.trim();
    if (!q) {
      setLookupHits([]);
      return;
    }
    const t = setTimeout(async () => {
      setLookupLoading(true);
      try {
        const res = await fetch(
          `/api/students?q=${encodeURIComponent(q)}&limit=12`
        );
        const data = await res.json();
        if (res.ok) setLookupHits(data.students || []);
      } finally {
        setLookupLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [lookupQ]);

  // Debounced picker for add-payment sheet
  useEffect(() => {
    if (!addOpen) return;
    const q = pickerQ.trim();
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/students?q=${encodeURIComponent(q)}&limit=12`
      );
      const data = await res.json();
      if (res.ok) setPickerHits(data.students || []);
    }, 150);
    return () => clearTimeout(t);
  }, [pickerQ, addOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && addOpen) {
        e.preventDefault();
        void savePayment();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen, studentId, amount, mode, referenceNo, date, termId]);

  const filteredLedger = useMemo(() => {
    const byStatus =
      statusFilter === "all"
        ? payments
        : payments.filter((p) => p.studentStatus === statusFilter);

    // Newest first (API is date desc; keep stable for same-day ties via id)
    const sorted = [...byStatus].sort((a, b) => {
      const td = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (td !== 0) return td;
      return b.id.localeCompare(a.id);
    });

    const seen = new Set<string>();
    const unique: Payment[] = [];
    for (const p of sorted) {
      if (p.voidedAt || p.clearedAt) continue;
      if (seen.has(p.studentId)) continue;
      seen.add(p.studentId);
      unique.push(p);
      if (unique.length >= 10) break;
    }
    return unique;
  }, [payments, statusFilter]);

  function openFinance(id: string) {
    setFinanceStudentId(id);
    setFinanceOpen(true);
    router.replace(`/admin/payments?studentId=${encodeURIComponent(id)}`, {
      scroll: false,
    });
  }

  function closeFinance(open: boolean) {
    setFinanceOpen(open);
    if (!open) {
      setFinanceStudentId(null);
      router.replace("/admin/payments", { scroll: false });
    }
  }

  function openAddForStudent(id: string, label?: string) {
    setStudentId(id);
    setSelectedStudentLabel(label || "");
    setPickerQ("");
    setFinanceOpen(false);
    setAddOpen(true);
  }

  async function savePayment() {
    if (!studentId || !amount || !termId) {
      toast.error("Student, amount, and active term are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        termId,
        amount: Number(amount),
        date,
        mode,
        referenceNo: referenceNo || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || "Could not save payment");
      return;
    }
    toast.success("Payment recorded", {
      description: data.balance
        ? `Balance now KES ${data.balance.feeBalance.toLocaleString()}`
        : undefined,
    });
    setAddOpen(false);
    setAmount("");
    setReferenceNo("");
    setStudentId("");
    setSelectedStudentLabel("");
    await loadLedger();
    openFinance(studentId);
  }

  async function voidPayment(id: string) {
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
    void loadLedger();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-primary">
            Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            Look up a student for room, balance, and payment dates — or record a
            new payment.
          </p>
        </div>
        <Button
          onClick={() => {
            setStudentId("");
            setSelectedStudentLabel("");
            setPickerQ("");
            setAddOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add payment
        </Button>
      </div>

      {/* Primary student lookup */}
      <div className="space-y-3">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Find student by name, room, or admission…"
            value={lookupQ}
            onChange={(e) => setLookupQ(e.target.value)}
            autoFocus
          />
        </div>

        {lookupQ.trim() ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {lookupLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : lookupHits.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No students match “{lookupQ.trim()}”
              </p>
            ) : (
              lookupHits.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openFinance(s.id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-0 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {roomHint(s)}
                      {s.admissionNo && s.admissionNo !== s.roomNumber
                        ? ` · Adm ${s.admissionNo}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-primary">View</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Start typing to open a student&apos;s room, balance, and payment
            history.
          </p>
        )}
      </div>

      {/* Secondary ledger */}
      <div className="space-y-3">
        <div>
          <h2 className="font-serif text-xl font-semibold text-primary">
            Recent payments
          </h2>
          <p className="text-xs text-muted-foreground">
            Latest 10 students by most recent payment. Click a row for full
            history.
          </p>
        </div>

        <SegmentedTabs
          layoutId="payments-status-tabs"
          aria-label="Fee status filter"
          value={statusFilter}
          onChange={setStatusFilter}
          loadingOverlay={false}
          tabs={[
            { value: "all", label: "All" },
            { value: "CLEARED", label: "Cleared" },
            { value: "PARTIAL", label: "Partial" },
            { value: "OVERPAID", label: "Overpaid" },
          ]}
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No payments yet"
            description="Record the first payment from a mobile money alert."
            actionLabel="Record first payment"
            onAction={() => setAddOpen(true)}
          />
        ) : filteredLedger.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matching payments"
            description="Try a different fee status filter."
            actionLabel="Clear status filter"
            onAction={() => setStatusFilter("all")}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Showing {filteredLedger.length} recent student
              {filteredLedger.length === 1 ? "" : "s"}
              {statusFilter !== "all" ? ` · ${statusFilter.toLowerCase()}` : ""}
            </p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <Stagger immediate key={statusFilter}>
                {filteredLedger.map((p) => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openFinance(p.studentId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openFinance(p.studentId);
                      }
                    }}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-0 cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">
                        {p.student.name}{" "}
                        <span className="text-sm font-normal text-muted-foreground">
                          {[p.student.roomNumber, p.student.admissionNo]
                            .filter(Boolean)
                            .filter((v, i, a) => a.indexOf(v) === i)
                            .join(" · ")}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.date), "dd MMM yyyy")} ·{" "}
                        {p.mode.replace("_", " ")}
                        {p.referenceNo ? ` · Ref ${p.referenceNo}` : ""}
                        {p.enteredBy ? ` · by ${p.enteredBy.name}` : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={p.studentStatus} />
                        <span className="text-xs text-muted-foreground">
                          Paid <MoneyText amount={p.feePaid} /> of{" "}
                          <MoneyText amount={p.feeDue} />
                          {p.feeBalance > 0 ? (
                            <>
                              {" "}
                              · Balance <MoneyText amount={p.feeBalance} />
                            </>
                          ) : null}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.voidedAt ? (
                        <Badge variant="unpaid">Voided</Badge>
                      ) : null}
                      <MoneyText
                        amount={p.amount}
                        className={`text-lg font-semibold ${
                          p.voidedAt
                            ? "line-through opacity-50"
                            : "text-primary"
                        }`}
                      />
                      {!p.voidedAt && p.isEditable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => voidPayment(p.id)}
                        >
                          Void
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </Stagger>
            </div>
          </div>
        )}
      </div>

      <StudentFinanceSheet
        studentId={financeStudentId}
        open={financeOpen}
        onOpenChange={closeFinance}
        onAddPayment={(id, label) => {
          openAddForStudent(id, label);
        }}
        onChanged={() => void loadLedger()}
      />

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent title="Add payment">
          <SheetHeader>
            <SheetTitle>Add payment</SheetTitle>
            <SheetDescription>
              Enter details from the mobile money SMS. Ctrl+Enter saves.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              {studentId && selectedStudentLabel ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
                  <span className="text-sm font-medium">
                    {selectedStudentLabel}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStudentId("");
                      setSelectedStudentLabel("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Search name, room, admission…"
                    value={pickerQ}
                    onChange={(e) => setPickerQ(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                    {pickerHits.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">
                        {pickerQ.trim()
                          ? "No matches"
                          : "Type to find a student"}
                      </p>
                    ) : (
                      pickerHits.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="flex w-full flex-col border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                          onClick={() => {
                            setStudentId(s.id);
                            setSelectedStudentLabel(
                              `${s.name} · ${roomHint(s)}`
                            );
                          }}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {roomHint(s)} · {s.admissionNo}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (KES)</Label>
              <Input
                id="amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d]/g, ""))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["PAY_BILL", "TILL", "CASH", "BANK", "OTHER"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref">Reference / SMS code (optional)</Label>
              <Input
                id="ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. QK7…"
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button
              className="w-full"
              onClick={savePayment}
              disabled={saving || !studentId}
            >
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      }
    >
      <PaymentsInner />
    </Suspense>
  );
}
