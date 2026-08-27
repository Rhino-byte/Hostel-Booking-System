"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarOff,
  ClipboardList,
  Loader2,
  Map,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatKes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { MoneyText } from "@/components/money-text";
import { IntakeStepper } from "@/components/admin/intake-stepper";
import {
  HostelMap,
  blockOccupancy,
  findBed,
  roomBedLabel,
  type BedAppearance,
  type BedClickContext,
  type HostelBlock,
} from "@/components/admin/hostel-map";

type StaffRole = "ADMIN" | "SECRETARY" | "MATRON" | string;

type WizardStep = "student" | "room" | "payment" | "done";

type WizardStudent = {
  id: string;
  name: string;
  admissionNo: string;
};

type UnbookedStudent = WizardStudent & {
  roomNumber?: string | null;
};

type Block = HostelBlock;

type AssignedBed = {
  id: string;
  label: string;
  roomNumber: string;
  blockCode: string;
  residenceLabel: string;
  feeKes: number;
};

type PaymentMode = "PAY_BILL" | "TILL" | "CASH" | "BANK" | "OTHER";

const PAYMENT_MODES: PaymentMode[] = [
  "PAY_BILL",
  "TILL",
  "CASH",
  "BANK",
  "OTHER",
];

function isBedFree(blocks: Block[], bedId: string) {
  return findBed(blocks, bedId)?.bed.bookings.length === 0;
}

function canRecordPayments(role: StaffRole | null) {
  // Hide the payment step only when we know the user cannot POST /api/payments.
  if (role === "MATRON") return false;
  return true;
}

export function IntakeWizard() {
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [termId, setTermId] = useState("");
  const [termName, setTermName] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [unbooked, setUnbooked] = useState<UnbookedStudent[]>([]);

  const [step, setStep] = useState<WizardStep>("student");

  const [name, setName] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [student, setStudent] = useState<WizardStudent | null>(null);

  const [blockFilter, setBlockFilter] = useState("all");
  const [selectedBed, setSelectedBed] = useState<AssignedBed | null>(null);
  const [assigned, setAssigned] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mode, setMode] = useState<PaymentMode>("PAY_BILL");
  const [referenceNo, setReferenceNo] = useState("");
  const [paying, setPaying] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [paymentSkipped, setPaymentSkipped] = useState(false);
  const [feeBalance, setFeeBalance] = useState<number | null>(null);

  const canPay = canRecordPayments(role);

  const steps = useMemo(
    () =>
      canPay
        ? [
            { id: "student" as const, label: "Student" },
            { id: "room" as const, label: "Room" },
            { id: "payment" as const, label: "Payment" },
            { id: "done" as const, label: "Done" },
          ]
        : [
            { id: "student" as const, label: "Student" },
            { id: "room" as const, label: "Room" },
            { id: "done" as const, label: "Done" },
          ],
    [canPay]
  );

  const loadHostelAndStudents = useCallback(async () => {
    try {
      const [hostelRes, studentsRes] = await Promise.all([
        fetch("/api/hostel"),
        fetch("/api/students?unbooked=1&limit=200"),
      ]);
      const hostel = await hostelRes.json().catch(() => ({}));
      const studs = await studentsRes.json().catch(() => ({}));
      if (!hostelRes.ok) {
        return {
          ok: false as const,
          hasTerm: false,
          blocks: [] as Block[],
          error: (hostel.error as string) || "Could not load hostel data",
        };
      }
      const nextBlocks: Block[] = hostel.blocks || [];
      setBlocks(nextBlocks);
      setTermId(hostel.term?.id || "");
      setTermName(hostel.term?.name || "");
      if (studentsRes.ok) {
        setUnbooked(studs.students || []);
      }
      setLoadError(null);
      return {
        ok: true as const,
        hasTerm: Boolean(hostel.term?.id),
        blocks: nextBlocks,
      };
    } catch {
      return {
        ok: false as const,
        hasTerm: false,
        blocks: [] as Block[],
        error: "Could not load hostel data",
      };
    }
  }, []);

  const bootstrap = useCallback(async () => {
    setBootstrapping(true);
    setLoadError(null);
    const [meRes, hostel] = await Promise.all([
      fetch("/api/auth/me"),
      loadHostelAndStudents(),
    ]);
    if (meRes.ok) {
      const me = await meRes.json().catch(() => null);
      setRole(me?.user?.role ?? null);
    }
    if (!hostel.ok) {
      setLoadError(hostel.error || "Could not load hostel data");
    }
    setBootstrapping(false);
  }, [loadHostelAndStudents]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const filteredUnbooked = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const list = unbooked.filter((s) => (student ? s.id !== student.id : true));
    if (!q) return list.slice(0, 12);
    return list
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [unbooked, studentQuery, student]);

  const visibleBlocks = useMemo(
    () =>
      blockFilter === "all"
        ? blocks
        : blocks.filter((b) => b.id === blockFilter),
    [blocks, blockFilter]
  );

  const freeBedCount = useMemo(
    () => visibleBlocks.reduce((n, b) => n + blockOccupancy(b).free, 0),
    [visibleBlocks]
  );

  function clearSelectedStudent() {
    setStudent(null);
    setName("");
    setSelectedBed(null);
    setAssigned(false);
  }

  function resetWizard() {
    setStep("student");
    setName("");
    setStudentQuery("");
    setStudent(null);
    setSelectedBed(null);
    setAssigned(false);
    setBlockFilter("all");
    setAmount("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setMode("PAY_BILL");
    setReferenceNo("");
    setPaidAmount(null);
    setPaymentSkipped(false);
    setFeeBalance(null);
    void loadHostelAndStudents();
  }

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    if (student) {
      setStep("room");
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Enter a name of at least 2 characters");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not create student");
        return;
      }
      const created = data.student as WizardStudent;
      setStudent(created);
      toast.success("Student added", {
        description: created.admissionNo
          ? `Admission ${created.admissionNo}`
          : undefined,
      });
      setStep("room");
    } catch {
      toast.error("Could not create student");
    } finally {
      setCreating(false);
    }
  }

  function pickExisting(s: UnbookedStudent) {
    setStudent({ id: s.id, name: s.name, admissionNo: s.admissionNo });
    setName(s.name);
    setStep("room");
  }

  function onMapBedClick({ block, room, bed }: BedClickContext) {
    if (assigned || assigning) return;
    const occupant = bed.bookings[0]?.student;
    if (occupant) {
      toast.message(occupant.name, {
        description: `${occupant.admissionNo} · occupied`,
      });
      return;
    }
    setSelectedBed({
      id: bed.id,
      label: roomBedLabel(block.code, room.number, bed),
      roomNumber: room.number,
      blockCode: block.code,
      residenceLabel: block.residenceType.label,
      feeKes: block.residenceType.feeKes,
    });
  }

  function bedAppearance({ bed }: BedClickContext): BedAppearance {
    const occupant = bed.bookings[0]?.student;
    if (occupant) {
      return {
        tone: "occupied",
        caption: occupant.name.split(" ")[0] || occupant.name,
        title: `${occupant.name} · occupied`,
      };
    }
    if (selectedBed?.id === bed.id) {
      return {
        tone: "selected",
        caption: student?.name.split(" ")[0] || "Selected",
        title: "Selected — confirm below",
      };
    }
    return { tone: "free", caption: "Free", title: "Select bed" };
  }

  async function assignBed() {
    if (!student || !selectedBed || !termId || assigned) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bedId: selectedBed.id,
          studentId: student.id,
          termId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not assign bed");
        const refreshed = await loadHostelAndStudents();
        if (refreshed.ok && !isBedFree(refreshed.blocks, selectedBed.id)) {
          setSelectedBed(null);
        }
        return;
      }
      setAssigned(true);
      toast.success("Bed assigned", {
        description: `${selectedBed.label} · ${selectedBed.residenceLabel}`,
      });
      setFeeBalance(selectedBed.feeKes);
      if (canPay) {
        setStep("payment");
      } else {
        setPaymentSkipped(true);
        setStep("done");
      }
    } catch {
      toast.error("Could not assign bed");
    } finally {
      setAssigning(false);
    }
  }

  async function savePayment(e?: React.FormEvent) {
    e?.preventDefault();
    if (!student || !termId || !canPay) return;
    const kes = Number(amount);
    if (!Number.isInteger(kes) || kes <= 0) {
      toast.error("Enter a positive amount in KES");
      return;
    }
    if (!date) {
      toast.error("Choose a payment date");
      return;
    }
    setPaying(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          termId,
          amount: kes,
          date,
          mode,
          referenceNo: referenceNo.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not save payment");
        return;
      }
      const remaining =
        typeof data.balance?.feeBalance === "number"
          ? data.balance.feeBalance
          : null;
      setPaidAmount(kes);
      setPaymentSkipped(false);
      setFeeBalance(remaining);
      toast.success("Payment recorded", {
        description:
          remaining !== null
            ? `Balance now ${formatKes(remaining)}`
            : undefined,
      });
      setStep("done");
    } catch {
      toast.error("Could not save payment");
    } finally {
      setPaying(false);
    }
  }

  function skipPayment() {
    setPaidAmount(null);
    setPaymentSkipped(true);
    setFeeBalance(selectedBed?.feeKes ?? null);
    toast.message("Payment skipped");
    setStep("done");
  }

  if (bootstrapping) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <Skeleton className="h-16" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not load intake"
        description={loadError}
        actionLabel="Try again"
        onAction={() => void bootstrap()}
      />
    );
  }

  if (!termId) {
    return (
      <EmptyState
        icon={CalendarOff}
        title="No active term"
        description="Ask an administrator to activate a term in Settings before you can intake students."
        actionLabel={role === "ADMIN" ? "Open Settings" : undefined}
        onAction={
          role === "ADMIN" ? () => router.push("/admin/settings") : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <IntakeStepper steps={steps} current={step} />

      {step === "student" ? (
        <Card>
          <CardHeader>
            <CardTitle>Add student</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Create a new student or continue with someone already on the
              unbooked list.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {student ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                <div>
                  <p className="font-medium">{student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Admission {student.admissionNo}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearSelectedStudent}
                  >
                    Choose a different student
                  </Button>
                  <Button type="button" onClick={() => setStep("room")}>
                    Continue with this student
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={createStudent} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="intake-name">Full name</Label>
                  <Input
                    id="intake-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jane Wanjiku"
                    autoFocus
                    minLength={2}
                    required
                  />
                </div>
                <Button type="submit" className="w-full sm:w-auto" disabled={creating}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {creating ? "Saving…" : "Add and continue"}
                </Button>
              </form>
            )}

            <div className="space-y-3 border-t border-border pt-5">
              <Label htmlFor="intake-student-search">
                Or pick an existing unbooked student
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="intake-student-search"
                  className="pl-9"
                  placeholder="Search name or admission…"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-border">
                {filteredUnbooked.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    {studentQuery.trim()
                      ? "No unbooked students match that search."
                      : "No unbooked students available."}
                  </p>
                ) : (
                  filteredUnbooked.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={cn(
                        "flex w-full flex-col border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset",
                        student?.id === s.id && "bg-muted"
                      )}
                      onClick={() => pickExisting(s)}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        Adm {s.admissionNo}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "room" && student ? (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-medium">{student.name}</p>
                <p className="text-xs text-muted-foreground">
                  Admission {student.admissionNo}
                </p>
              </div>
              {!assigned ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("student")}
                  disabled={assigning}
                >
                  Back
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Assign a bed</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Click a free bed. Occupied beds are locked. Residence fee is set
                by the block.
              </p>
              <div className="max-w-xs">
                <Label htmlFor="intake-block-filter" className="sr-only">Filter by block</Label>
                <Select
                  value={blockFilter}
                  onValueChange={setBlockFilter}
                  disabled={assigned || assigning}
                >
                  <SelectTrigger id="intake-block-filter">
                    <SelectValue placeholder="All blocks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All blocks</SelectItem>
                    {blocks.map((b) => {
                      const { free, total } = blockOccupancy(b);
                      return (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.code}) · {free}/{total} free
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {freeBedCount === 0 && visibleBlocks.length > 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  No free beds
                  {blockFilter === "all"
                    ? " in any block"
                    : " in this block"}
                  . Choose another block, or ask an administrator to add
                  rooms.
                </p>
              ) : null}
              <HostelMap
                blocks={visibleBlocks}
                appearance={bedAppearance}
                onBedClick={onMapBedClick}
                disabled={assigned || assigning}
                legend={["free", "occupied", "selected"]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                {selectedBed ? (
                  <>
                    <p className="font-medium">{selectedBed.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedBed.residenceLabel} ·{" "}
                      <MoneyText amount={selectedBed.feeKes} />
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a free bed to see the residence fee.
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={() => void assignBed()}
                disabled={!selectedBed || assigning || assigned}
              >
                {assigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {assigning ? "Assigning…" : "Confirm assignment"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {step === "payment" && student && selectedBed ? (
        <Card>
          <CardHeader>
            <CardTitle>Record payment</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Optional — skip if the family will pay later.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium">{student.name}</p>
              <p className="text-muted-foreground">
                Adm {student.admissionNo} · {selectedBed.label} ·{" "}
                {selectedBed.residenceLabel}
              </p>
              <p className="mt-1">
                Fee due <MoneyText amount={selectedBed.feeKes} className="font-medium" />
              </p>
            </div>
            <form onSubmit={(e) => void savePayment(e)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intake-amount">Amount (KES)</Label>
              <Input
                id="intake-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                placeholder={String(selectedBed.feeKes)}
                autoFocus
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="intake-date">Date</Label>
                <Input
                  id="intake-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-mode">Mode</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as PaymentMode)}
                >
                  <SelectTrigger id="intake-mode">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-ref">Reference / SMS code (optional)</Label>
              <Input
                id="intake-ref"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. QK7…"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={paying || !amount}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {paying ? "Recording…" : "Save payment"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={skipPayment}
                disabled={paying}
              >
                Skip payment
              </Button>
            </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" && student && selectedBed ? (
        <Card>
          <CardHeader>
            <CardTitle>Intake complete</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              {termName ? `Recorded for ${termName}.` : "Student is booked."}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border px-4 py-3">
                <dt className="text-xs text-muted-foreground">Student</dt>
                <dd className="font-medium">{student.name}</dd>
                <dd className="text-sm text-muted-foreground">
                  Adm {student.admissionNo}
                </dd>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <dt className="text-xs text-muted-foreground">Room / bed</dt>
                <dd className="font-medium">{selectedBed.label}</dd>
                <dd className="text-sm text-muted-foreground">
                  {selectedBed.residenceLabel} ·{" "}
                  <MoneyText amount={selectedBed.feeKes} />
                </dd>
              </div>
              <div className="rounded-xl border border-border px-4 py-3 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Payment</dt>
                <dd className="font-medium">
                  {paymentSkipped || paidAmount === null
                    ? "Payment skipped"
                    : formatKes(paidAmount)}
                </dd>
                {feeBalance !== null ? (
                  <dd className="text-sm text-muted-foreground">
                    Remaining balance <MoneyText amount={feeBalance} />
                  </dd>
                ) : null}
                {!canPay ? (
                  <dd className="mt-1 text-sm text-muted-foreground">
                    A secretary or administrator can record payment on the
                    Payments page.
                  </dd>
                ) : null}
              </div>
            </dl>

            <Button onClick={resetWizard}>
              <ClipboardList className="h-4 w-4" /> Intake another student
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/admin/students?focus=${encodeURIComponent(student.id)}`}
                >
                  <Users className="h-4 w-4" /> View on Students
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/admin/payments?studentId=${encodeURIComponent(student.id)}`}
                >
                  <Wallet className="h-4 w-4" /> Payments
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/hostel">
                  <Map className="h-4 w-4" /> Hostel map
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
