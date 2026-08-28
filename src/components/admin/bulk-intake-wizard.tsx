"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  AlertCircle,
  CalendarOff,
  ClipboardList,
  Download,
  Loader2,
  Map as MapIcon,
  Search,
  Upload,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { MoneyText } from "@/components/money-text";
import { IntakeStepper } from "@/components/admin/intake-stepper";
import {
  HostelMap,
  findBed,
  roomBedLabel,
  type BedAppearance,
  type BedClickContext,
  type HostelBlock,
} from "@/components/admin/hostel-map";

type StaffRole = "ADMIN" | "SECRETARY" | "MATRON" | string;

type WizardStep = "students" | "rooms" | "payment" | "done";

type BatchStudent = {
  tempId: string;
  name: string;
  admissionNo: string;
  existingStudentId?: string;
};

type UnbookedStudent = {
  id: string;
  name: string;
  admissionNo: string;
};

type Block = HostelBlock;

type RowAssignment = {
  bedId: string;
  label: string;
};

type PaymentMode = "PAY_BILL" | "TILL" | "CASH" | "BANK" | "OTHER";

type PaymentStyle = "skip" | "same" | "custom";

type RowError = {
  studentId: string;
  name: string;
  reason: string;
};

const PAYMENT_MODES: PaymentMode[] = [
  "PAY_BILL",
  "TILL",
  "CASH",
  "BANK",
  "OTHER",
];

const MAX_BATCH = 500;

const NAME_HEADERS = new Set(["name", "full name", "fullname"]);

function canRecordPayments(role: StaffRole | null) {
  if (role === "MATRON") return false;
  return true;
}

function findBedMeta(blocks: Block[], bedId: string) {
  const found = findBed(blocks, bedId);
  if (!found) return null;
  return {
    ...found,
    label: roomBedLabel(found.block.code, found.room.number, found.bed),
    feeKes: found.block.residenceType.feeKes,
    residenceLabel: found.block.residenceType.label,
  };
}

function parsePastedNames(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines[0] &&
    NAME_HEADERS.has(lines[0].toLowerCase().replace(/[_-]+/g, " "))
  ) {
    lines.shift();
  }
  return lines;
}

function newTempId() {
  return crypto.randomUUID();
}

function mergeStudents(
  current: BatchStudent[],
  incoming: BatchStudent[]
): { next: BatchStudent[]; added: number; skippedDup: number } {
  const ids = new Set(current.map((s) => s.tempId));
  const existingIds = new Set(
    current
      .map((s) => s.existingStudentId)
      .filter((id): id is string => Boolean(id))
  );
  const next = [...current];
  let added = 0;
  let skippedDup = 0;
  for (const s of incoming) {
    if (
      ids.has(s.tempId) ||
      (s.existingStudentId && existingIds.has(s.existingStudentId))
    ) {
      skippedDup += 1;
      continue;
    }
    if (next.length >= MAX_BATCH) break;
    ids.add(s.tempId);
    if (s.existingStudentId) existingIds.add(s.existingStudentId);
    next.push(s);
    added += 1;
  }
  return { next, added, skippedDup };
}

export function BulkIntakeWizard({
  onBootstrapComplete,
}: {
  onBootstrapComplete?: () => void;
}) {
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [termId, setTermId] = useState("");
  const [termName, setTermName] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [unbooked, setUnbooked] = useState<UnbookedStudent[]>([]);

  const [step, setStep] = useState<WizardStep>("students");

  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [studentQuery, setStudentQuery] = useState("");
  const [importing, setImporting] = useState(false);

  const [roomQuery, setRoomQuery] = useState("");
  const [fillBlockId, setFillBlockId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, RowAssignment>>(
    {}
  );
  const [saving, setSaving] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickBedId, setPickBedId] = useState("");
  const [pickBedLabel, setPickBedLabel] = useState("");
  const [pickStudentId, setPickStudentId] = useState("");

  const [paymentStyle, setPaymentStyle] = useState<PaymentStyle>("skip");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mode, setMode] = useState<PaymentMode>("PAY_BILL");
  const [referenceNo, setReferenceNo] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {}
  );
  const [createdCount, setCreatedCount] = useState(0);
  const [existingCount, setExistingCount] = useState(0);
  const [assignedCount, setAssignedCount] = useState(0);
  const [paymentsRecorded, setPaymentsRecorded] = useState(0);
  const [paymentsSkipped, setPaymentsSkipped] = useState(0);
  const [rowErrors, setRowErrors] = useState<RowError[]>([]);

  const canPay = canRecordPayments(role);

  const steps = useMemo(
    () =>
      canPay
        ? [
            { id: "students" as const, label: "Students" },
            { id: "rooms" as const, label: "Rooms" },
            { id: "payment" as const, label: "Payments" },
            { id: "done" as const, label: "Done" },
          ]
        : [
            { id: "students" as const, label: "Students" },
            { id: "rooms" as const, label: "Rooms" },
            { id: "done" as const, label: "Done" },
          ],
    [canPay]
  );

  const loadHostelAndStudents = useCallback(async () => {
    try {
      const [hostelRes, studentsRes] = await Promise.all([
        fetch("/api/hostel"),
        fetch("/api/students?unbooked=1&limit=500"),
      ]);
      const hostel = await hostelRes.json().catch(() => ({}));
      const studs = await studentsRes.json().catch(() => ({}));
      if (!hostelRes.ok) {
        return {
          ok: false as const,
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
      return { ok: true as const, blocks: nextBlocks };
    } catch {
      return {
        ok: false as const,
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

  useEffect(() => {
    if (!bootstrapping) onBootstrapComplete?.();
  }, [bootstrapping, onBootstrapComplete]);

  const batchIds = useMemo(
    () =>
      new Set(
        students
          .map((s) => s.existingStudentId)
          .filter((id): id is string => Boolean(id))
      ),
    [students]
  );

  const filteredUnbooked = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return unbooked.filter((s) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q)
      );
    });
  }, [unbooked, studentQuery]);

  const claimedBedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of Object.values(assignments)) {
      if (row.bedId) ids.add(row.bedId);
    }
    return ids;
  }, [assignments]);

  const assignedStudents = useMemo(
    () => students.filter((s) => Boolean(assignments[s.tempId]?.bedId)),
    [students, assignments]
  );

  const unassignedStudents = useMemo(
    () => students.filter((s) => !assignments[s.tempId]?.bedId),
    [students, assignments]
  );

  const pickableStudents = useMemo(
    () => students.filter((s) => !assignments[s.tempId]?.bedId),
    [students, assignments]
  );

  const filteredBatchRows = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q)
    );
  }, [students, roomQuery]);

  const assignmentByBedId = useMemo(() => {
    const map = new Map<string, { student: BatchStudent; row: RowAssignment }>();
    for (const s of students) {
      const row = assignments[s.tempId];
      if (row?.bedId) map.set(row.bedId, { student: s, row });
    }
    return map;
  }, [students, assignments]);

  function addToBatch(incoming: BatchStudent[], silent = false) {
    const { next, added, skippedDup } = mergeStudents(students, incoming);
    const truncated = incoming.length - added - skippedDup;
    const addedExisting = incoming.filter(
      (s) =>
        s.existingStudentId &&
        next.some((n) => n.tempId === s.tempId) &&
        !students.some((n) => n.tempId === s.tempId)
    ).length;
    setStudents(next);
    setExistingCount((n) => n + addedExisting);
    setUnbooked((prev) =>
      prev.filter(
        (u) => !next.some((n) => n.existingStudentId === u.id)
      )
    );
    if (!silent) {
      if (added) {
        toast.success(
          `Added ${added} student${added === 1 ? "" : "s"} to this batch`
        );
      } else if (skippedDup && !truncated) {
        toast.message("Those students are already in this batch");
      }
    }
    if (truncated > 0) {
      toast.error(`Batch is full (max ${MAX_BATCH}). ${truncated} not added.`);
    }
    return added;
  }

  function removeFromBatch(tempId: string) {
    const removed = students.find((s) => s.tempId === tempId);
    setStudents((prev) => prev.filter((s) => s.tempId !== tempId));
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
    const existingId = removed?.existingStudentId;
    if (removed && existingId) {
      setExistingCount((n) => Math.max(0, n - 1));
      setUnbooked((prev) =>
        prev.some((s) => s.id === existingId)
          ? prev
          : [
              ...prev,
              {
                id: existingId,
                name: removed.name,
                admissionNo: removed.admissionNo,
              },
            ].sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  }

  function toggleExisting(s: UnbookedStudent, checked: boolean) {
    if (checked) {
      addToBatch(
        [
          {
            tempId: s.id,
            name: s.name,
            admissionNo: s.admissionNo,
            existingStudentId: s.id,
          },
        ],
        true
      );
    } else {
      const match = students.find((row) => row.existingStudentId === s.id);
      if (match) removeFromBatch(match.tempId);
    }
  }

  function addPastedNames() {
    const names = parsePastedNames(pasteText);
    if (names.length === 0) {
      toast.error("Paste at least one name (one per line)");
      return;
    }
    const remaining = MAX_BATCH - students.length;
    if (remaining <= 0) {
      toast.error(`Batch is full (max ${MAX_BATCH})`);
      return;
    }
    const toAdd = names.slice(0, remaining);
    const dropped = names.length - toAdd.length;
    const skippedShort = toAdd.filter((name) => name.length < 2).length;
    const valid = toAdd.filter((name) => name.length >= 2);
    if (valid.length === 0) {
      toast.error("Name is required (min 2 characters)");
      return;
    }
    addToBatch(
      valid.map((name) => ({
        tempId: newTempId(),
        name,
        admissionNo: "New",
      }))
    );
    setPasteText("");
    if (dropped > 0) {
      toast.error(`Batch is full (max ${MAX_BATCH}). ${dropped} not added.`);
    }
    if (skippedShort > 0) {
      toast.message(`${skippedShort} name(s) skipped`);
    }
  }

  async function importFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) {
      toast.error("Choose a CSV or Excel file");
      return;
    }
    const remaining = MAX_BATCH - students.length;
    if (remaining <= 0) {
      toast.error(`Batch is full (max ${MAX_BATCH})`);
      return;
    }
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", importFile);
      body.append("limit", String(remaining));
      body.append("preview", "1");
      const res = await fetch("/api/students/import", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not read file");
        return;
      }
      const names = (data.names || []) as string[];
      if (names.length === 0 && (data.skipped ?? 0) === 0 && !(data.truncated > 0)) {
        toast.error("No names found in that file");
        return;
      }
      addToBatch(
        names.map((name) => ({
          tempId: newTempId(),
          name,
          admissionNo: "New",
        }))
      );
      setImportFile(null);
      if (data.truncated > 0) {
        toast.error(
          `Batch is full (max ${MAX_BATCH}). ${data.truncated} not added.`
        );
      }
      if (data.skipped > 0) {
        toast.message(`${data.skipped} row(s) skipped`);
      }
    } catch {
      toast.error("Could not read file");
    } finally {
      setImporting(false);
    }
  }

  function clearPending(tempId: string) {
    const row = assignments[tempId];
    if (!row) return;
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  }

  function onMapBedClick({ block, room, bed }: BedClickContext) {
    if (saving) return;
    const occupant = bed.bookings[0]?.student;
    if (occupant) {
      toast.message(occupant.name, {
        description: `${occupant.admissionNo} · occupied`,
      });
      return;
    }
    const existing = assignmentByBedId.get(bed.id);
    if (existing) {
      clearPending(existing.student.tempId);
      toast.message(`Cleared ${existing.row.label} for ${existing.student.name}`);
      return;
    }
    if (pickableStudents.length === 0) {
      toast.message("Every student in this batch already has a bed selected");
      return;
    }
    setPickBedId(bed.id);
    setPickBedLabel(roomBedLabel(block.code, room.number, bed));
    setPickStudentId(
      pickableStudents.length === 1 ? pickableStudents[0]!.tempId : ""
    );
    setPickOpen(true);
  }

  function confirmPick() {
    if (!pickBedId || !pickStudentId) {
      toast.error("Choose a student");
      return;
    }
    if (claimedBedIds.has(pickBedId)) {
      toast.error("That bed is already selected for another student");
      return;
    }
    setAssignments((prev) => ({
      ...prev,
      [pickStudentId]: {
        bedId: pickBedId,
        label: pickBedLabel,
      },
    }));
    setPickOpen(false);
    setPickStudentId("");
    setPickBedId("");
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
    const existing = assignmentByBedId.get(bed.id);
    if (existing) {
      return {
        tone: "pending",
        caption:
          existing.student.name.split(" ")[0] || existing.student.name,
        title: `${existing.student.name} · pending — click to undo`,
      };
    }
    return { tone: "free", caption: "Free", title: "Assign student from this batch" };
  }

  function fillNextFreeInBlock() {
    if (!fillBlockId) {
      toast.error("Choose a block first");
      return;
    }
    const block = blocks.find((b) => b.id === fillBlockId);
    if (!block) return;

    const taken = new Set<string>();
    for (const row of Object.values(assignments)) {
      if (row.bedId) taken.add(row.bedId);
    }

    const freeBeds: { bedId: string; label: string }[] = [];
    for (const room of block.rooms) {
      const beds = [...room.beds].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true })
      );
      for (const bed of beds) {
        if (bed.bookings.length === 0 && !taken.has(bed.id)) {
          freeBeds.push({
            bedId: bed.id,
            label: roomBedLabel(block.code, room.number, bed),
          });
        }
      }
    }

    let i = 0;
    const next = { ...assignments };
    let filled = 0;
    for (const s of students) {
      if (next[s.tempId]?.bedId) continue;
      const free = freeBeds[i];
      if (!free) break;
      next[s.tempId] = {
        bedId: free.bedId,
        label: free.label,
      };
      i += 1;
      filled += 1;
    }
    setAssignments(next);
    if (filled === 0) {
      toast.message("No empty rows, or no free beds left in that block");
    } else {
      toast.success(
        `Filled ${filled} bed${filled === 1 ? "" : "s"} in ${block.name}`
      );
    }
  }

  function paymentRowsForCommit():
    | { tempId: string; amount: number }[]
    | "invalid"
    | null {
    if (!canPay || paymentStyle === "skip" || assignedStudents.length === 0) {
      return null;
    }
    if (paymentStyle === "same") {
      const kes = Number(amount);
      if (!Number.isInteger(kes) || kes <= 0) return "invalid";
      return assignedStudents.map((s) => ({ tempId: s.tempId, amount: kes }));
    }
    const rows: { tempId: string; amount: number }[] = [];
    for (const s of assignedStudents) {
      const raw = (customAmounts[s.tempId] || "").trim();
      if (!raw) continue;
      const kes = Number(raw);
      if (!Number.isInteger(kes) || kes <= 0) {
        toast.error(`Invalid amount for ${s.name}`);
        return "invalid";
      }
      rows.push({ tempId: s.tempId, amount: kes });
    }
    return rows.length ? rows : null;
  }

  async function confirmBatch() {
    if (!termId || students.length === 0) return;
    const payRows = canPay ? paymentRowsForCommit() : null;
    if (payRows === "invalid") {
      if (paymentStyle === "same") {
        toast.error("Enter a positive amount in KES");
      }
      return;
    }
    if (canPay && payRows && payRows.length > 0 && !date) {
      toast.error("Choose a payment date");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/intake/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termId,
          students: students.map((s) =>
            s.existingStudentId
              ? { tempId: s.tempId, existingStudentId: s.existingStudentId }
              : { tempId: s.tempId, name: s.name }
          ),
          assignments: assignedStudents.map((s) => ({
            tempId: s.tempId,
            bedId: assignments[s.tempId]!.bedId,
          })),
          payments:
            canPay && payRows
              ? {
                  date,
                  mode,
                  referenceNo: referenceNo.trim() || undefined,
                  rows: payRows,
                }
              : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not save this batch");
        return;
      }
      const created = (data.created || []) as {
        tempId: string;
        id: string;
        name: string;
        admissionNo: string;
      }[];
      const assigned = (data.assigned || []) as { tempId: string }[];
      const errs = (data.errors || []) as {
        tempId: string;
        name: string;
        reason: string;
      }[];
      setCreatedCount(created.length);
      setExistingCount(data.existingCount ?? existingCount);
      setAssignedCount(assigned.length);
      setPaymentsRecorded(data.paymentsRecorded ?? 0);
      setPaymentsSkipped(
        Math.max(0, assigned.length - (data.paymentsRecorded ?? 0))
      );
      setRowErrors(
        errs.map((e) => ({
          studentId: e.tempId,
          name: e.name,
          reason: e.reason,
        }))
      );
      if (created.length) {
        const byTemp = new Map(created.map((s) => [s.tempId, s]));
        setStudents((prev) =>
          prev.map((s) => {
            const row = byTemp.get(s.tempId);
            return row ? { ...s, admissionNo: row.admissionNo } : s;
          })
        );
      }
      toast.success("Batch saved");
      if (errs.length) {
        toast.error(
          `${errs.length} row${errs.length === 1 ? "" : "s"} could not be completed`
        );
      }
      setStep("done");
    } catch {
      toast.error("Could not save this batch");
    } finally {
      setSaving(false);
    }
  }

  function goToPaymentOrDone() {
    if (!canPay) {
      void confirmBatch();
      return;
    }
    setStep("payment");
  }

  function resetWizard() {
    setStep("students");
    setStudents([]);
    setPasteText("");
    setImportFile(null);
    setStudentQuery("");
    setRoomQuery("");
    setFillBlockId("");
    setAssignments({});
    setPickOpen(false);
    setPickBedId("");
    setPickBedLabel("");
    setPickStudentId("");
    setPaymentStyle("skip");
    setAmount("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setMode("PAY_BILL");
    setReferenceNo("");
    setCustomAmounts({});
    setCreatedCount(0);
    setExistingCount(0);
    setAssignedCount(0);
    setPaymentsRecorded(0);
    setPaymentsSkipped(0);
    setRowErrors([]);
    setSaving(false);
    void loadHostelAndStudents();
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

      {step === "students" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Build the list</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Upload a file, paste names, or tick existing unbooked students.
                Nothing is saved until you confirm at the end. Max {MAX_BATCH}{" "}
                in one run.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={(e) => void importFileSubmit(e)} className="space-y-3">
                <Label htmlFor="bulk-import-file">Upload CSV or Excel</Label>
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    id="bulk-import-file"
                    type="file"
                    className="max-w-md"
                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  />
                  <Button type="submit" disabled={importing || !importFile}>
                    {importing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {importing ? "Reading…" : "Load file"}
                  </Button>
                </div>
                <a
                  href="/templates/students-import.csv"
                  download
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV template
                </a>
              </form>

              <div className="space-y-2 border-t border-border pt-5">
                <Label htmlFor="bulk-paste">Or paste names (one per line)</Label>
                <textarea
                  id="bulk-paste"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Jane Wanjiku\nMary Achieng"}
                  rows={6}
                  className="flex min-h-[140px] w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button
                  type="button"
                  onClick={() => addPastedNames()}
                  disabled={!pasteText.trim()}
                >
                  Add names
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This batch ({students.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No students in this run yet.
                </p>
              ) : (
                <ul className="max-h-56 overflow-y-auto rounded-xl border border-border">
                  {students.map((s) => (
                    <li
                      key={s.tempId}
                      className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.existingStudentId
                            ? `Adm ${s.admissionNo} · existing`
                            : "New · not saved yet"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => removeFromBatch(s.tempId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing unbooked students</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Tick names already in the system who do not have a bed yet.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search name or admission…"
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
                {filteredUnbooked.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    {studentQuery.trim()
                      ? "No unbooked students match that search."
                      : "No unbooked students available."}
                  </p>
                ) : (
                  filteredUnbooked.map((s) => {
                    const checked = batchIds.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={checked}
                          onChange={(e) =>
                            toggleExisting(s, e.target.checked)
                          }
                        />
                        <span className="min-w-0">
                          <span className="block font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">
                            Adm {s.admissionNo}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={students.length === 0 || importing}
              onClick={() => setStep("rooms")}
            >
              Continue to rooms
            </Button>
          </div>
        </div>
      ) : null}

      {step === "rooms" ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle>Assign beds</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Click a free bed, then pick a student from this batch. Occupied
                beds are locked. Click a pending bed to undo. Nothing is saved
                until you confirm the batch.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bulk-fill-block">Fill next free beds in</Label>
                  <Select
                    value={fillBlockId || undefined}
                    onValueChange={setFillBlockId}
                    disabled={saving}
                  >
                    <SelectTrigger id="bulk-fill-block" className="w-56">
                      <SelectValue placeholder="Choose block" />
                    </SelectTrigger>
                    <SelectContent>
                      {blocks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={fillNextFreeInBlock}
                  disabled={saving}
                >
                  Fill empty rows
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <HostelMap
                blocks={blocks}
                appearance={bedAppearance}
                onBedClick={onMapBedClick}
                disabled={saving}
                legend={["free", "occupied", "pending"]}
              />

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">This batch</p>
                  <p className="text-xs text-muted-foreground">
                    {assignedStudents.length} selected · {pickableStudents.length}{" "}
                    without a bed
                  </p>
                </div>
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Filter students…"
                    value={roomQuery}
                    onChange={(e) => setRoomQuery(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto rounded-xl border border-border">
                  {filteredBatchRows.length === 0 ? (
                    <li className="px-3 py-4 text-sm text-muted-foreground">
                      {roomQuery.trim()
                        ? "No students match that search."
                        : "No students in this batch."}
                    </li>
                  ) : (
                    filteredBatchRows.map((s) => {
                      const row = assignments[s.tempId];
                      return (
                        <li
                          key={s.tempId}
                          className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.existingStudentId
                                ? `Adm ${s.admissionNo}`
                                : "New"}
                              {row?.label ? ` · ${row.label}` : ""}
                            </p>
                            {row?.bedId ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Pending
                              </p>
                            ) : null}
                          </div>
                          {row?.bedId ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Clear bed for ${s.name}`}
                              onClick={() => clearPending(s.tempId)}
                              disabled={saving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("students")}
              disabled={saving}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={goToPaymentOrDone}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving
                ? "Saving…"
                : canPay
                  ? "Continue to payments"
                  : "Confirm batch"}
            </Button>
          </div>

          <Dialog
            open={pickOpen}
            onOpenChange={(open) => {
              if (saving) return;
              setPickOpen(open);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign bed</DialogTitle>
                <DialogDescription>
                  {pickBedLabel
                    ? `Choose who gets ${pickBedLabel}. Only students in this batch who do not have a bed yet.`
                    : "Choose a student from this batch."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {pickableStudents.length === 0 ? (
                  <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Every student in this batch already has a bed selected.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="bulk-pick-student">Student</Label>
                    <Select
                      value={pickStudentId || undefined}
                      onValueChange={setPickStudentId}
                    >
                      <SelectTrigger id="bulk-pick-student">
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickableStudents.map((s) => (
                          <SelectItem key={s.tempId} value={s.tempId}>
                            {s.name}
                            {s.existingStudentId ? ` · ${s.admissionNo}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button
                  className="w-full"
                  type="button"
                  onClick={confirmPick}
                  disabled={!pickStudentId || pickableStudents.length === 0}
                >
                  Select bed
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : null}

      {step === "payment" ? (
        <Card>
          <CardHeader>
            <CardTitle>Record payments</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Optional. Only students with a bed selected can be paid. Confirm
              saves names, rooms, and payments together.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {assignedStudents.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                No one in this batch has a bed yet, so there is nothing to
                charge. Continue to finish, or go back and assign rooms.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["skip", "Skip all"],
                      ["same", "Same payment for all"],
                      ["custom", "Per-row amount"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={paymentStyle === value ? "default" : "outline"}
                      disabled={saving}
                      onClick={() => setPaymentStyle(value)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {paymentStyle !== "skip" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {paymentStyle === "same" ? (
                      <div className="space-y-2">
                        <Label htmlFor="bulk-amount">Amount (KES)</Label>
                        <Input
                          id="bulk-amount"
                          inputMode="numeric"
                          value={amount}
                          onChange={(e) =>
                            setAmount(e.target.value.replace(/[^\d]/g, ""))
                          }
                          placeholder="e.g. 15000"
                          disabled={saving}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label htmlFor="bulk-date">Date</Label>
                      <Input
                        id="bulk-date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bulk-mode">Mode</Label>
                      <Select
                        value={mode}
                        onValueChange={(v) => setMode(v as PaymentMode)}
                      >
                        <SelectTrigger id="bulk-mode">
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
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="bulk-ref">
                        Reference / SMS code (optional)
                      </Label>
                      <Input
                        id="bulk-ref"
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                        placeholder="e.g. QK7…"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Bed / fee due</th>
                        {paymentStyle === "custom" ? (
                          <th className="px-3 py-2 font-medium">Amount</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {assignedStudents.map((s) => {
                        const meta = assignments[s.tempId]?.bedId
                          ? findBedMeta(blocks, assignments[s.tempId]!.bedId)
                          : null;
                        return (
                          <tr key={s.tempId} className="border-t border-border">
                            <td className="px-3 py-2">
                              <p className="font-medium">{s.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {s.existingStudentId
                                  ? `Adm ${s.admissionNo}`
                                  : "New"}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-sm">
                              {meta ? (
                                <>
                                  {meta.label} · {meta.residenceLabel} ·{" "}
                                  <MoneyText amount={meta.feeKes} />
                                </>
                              ) : (
                                <span className="text-muted-foreground">
                                  Assigned
                                </span>
                              )}
                            </td>
                            {paymentStyle === "custom" ? (
                              <td className="px-3 py-2">
                                <Input
                                  inputMode="numeric"
                                  className="h-9 max-w-[8rem]"
                                  placeholder="Skip"
                                  value={customAmounts[s.tempId] ?? ""}
                                  onChange={(e) =>
                                    setCustomAmounts((prev) => ({
                                      ...prev,
                                      [s.tempId]: e.target.value.replace(
                                        /[^\d]/g,
                                        ""
                                      ),
                                    }))
                                  }
                                />
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {unassignedStudents.length > 0 ? (
              <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
                <p className="font-medium">
                  {unassignedStudents.length} without a room
                </p>
                <p className="text-muted-foreground">
                  Assign a room first before recording a fee. They will not be
                  charged in this step.
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("rooms")}
                disabled={saving}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => void confirmBatch()}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving…" : "Confirm batch"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" ? (
        <Card>
          <CardHeader>
            <CardTitle>Batch complete</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              {termName ? `Recorded for ${termName}.` : "This run is saved."}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryStat label="Created" value={createdCount} />
              <SummaryStat
                label="Already on file"
                value={existingCount}
              />
              <SummaryStat label="Beds assigned" value={assignedCount} />
              <SummaryStat
                label="Left unassigned"
                value={Math.max(0, students.length - assignedCount)}
              />
              <SummaryStat
                label="Payments recorded"
                value={paymentsRecorded}
              />
              <SummaryStat label="Payments skipped" value={paymentsSkipped} />
            </dl>

            {!canPay ? (
              <p className="text-sm text-muted-foreground">
                Payment was skipped for this role. A secretary or administrator
                can record fees on the Payments page.
              </p>
            ) : null}

            {rowErrors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Row errors</p>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
                  {rowErrors.map((err, i) => (
                    <div
                      key={`${err.studentId}-${i}`}
                      className="border-b border-border px-3 py-2 text-xs last:border-0"
                    >
                      <p className="font-medium">{err.name}</p>
                      <p className="text-muted-foreground">{err.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <Button onClick={resetWizard}>
              <ClipboardList className="h-4 w-4" /> Start another batch
            </Button>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/students">
                  <Users className="h-4 w-4" /> Students
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/hostel">
                  <MapIcon className="h-4 w-4" /> Hostel
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/payments">
                  <Wallet className="h-4 w-4" /> Payments
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-serif text-2xl font-semibold text-primary">
        {value}
      </dd>
    </div>
  );
}
