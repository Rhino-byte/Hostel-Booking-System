"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Stagger } from "@/components/motion";

type Student = {
  id: string;
  name: string;
  admissionNo: string;
  roomNumber: string | null;
  hasLivePayments?: boolean;
  canDelete?: boolean;
  bookings: {
    residenceType: { label: string; code: string };
    bed: { label: string; room: { number: string; block: { code: string } } };
  }[];
};

type ImportError = {
  row: number;
  name: string;
  reason: string;
};

function bookedRoomLabel(s: Student): string | null {
  const booking = s.bookings[0];
  if (!booking) return null;
  const bed =
    booking.bed.label !== "1" ? booking.bed.label : "";
  return `${booking.bed.room.block.code}-${booking.bed.room.number}${bed}`;
}

const PAGE_SIZE = 10;

function StudentsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const searchFirstLoad = useRef(true);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    errors: ImportError[];
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (query: string, pageOffset: number) => {
    setLoading(true);
    try {
      const offset = pageOffset * PAGE_SIZE;
      const res = await fetch(
        `/api/students?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${offset}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not load students");
        return;
      }
      setStudents(data.students || []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search — resets to first page
  useEffect(() => {
    const delay = searchFirstLoad.current ? 0 : 300;
    searchFirstLoad.current = false;
    const t = setTimeout(() => {
      setPage(0);
      void load(q, 0);
    }, delay);
    return () => clearTimeout(t);
  }, [q, load]);

  // Page navigation (skip page 0 — handled by search effect)
  useEffect(() => {
    if (page === 0) return;
    void load(q, page);
  }, [page, q, load]);

  useEffect(() => {
    const focus = params.get("focus");
    if (focus && students.length) {
      document
        .getElementById(`student-${focus}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [params, students]);

  const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const hasPagination = total > PAGE_SIZE;
  const canGoPrev = page > 0;
  const canGoNext = (page + 1) * PAGE_SIZE < total;

  function reloadFromStart() {
    setPage(0);
    void load(q, 0);
  }

  async function createStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not create student");
        return;
      }
      toast.success("Student added");
      setOpen(false);
      reloadFromStart();
    } catch {
      toast.error("Could not create student");
    } finally {
      setSaving(false);
    }
  }

  async function runImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) {
      toast.error("Choose a CSV or Excel file");
      return;
    }
    setImporting(true);
    setImportResult(null);
    const body = new FormData();
    body.append("file", importFile);
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      setImportResult({
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
        errors: data.errors ?? [],
      });
      toast.success(
        `Imported ${data.created ?? 0} student${(data.created ?? 0) === 1 ? "" : "s"}`,
        {
          description:
            (data.skipped ?? 0) > 0
              ? `${data.skipped} row(s) skipped`
              : undefined,
        }
      );
      setImportFile(null);
      reloadFromStart();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function deleteStudent() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/students/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        toast.error(
          data.error ||
            "Cannot delete this student because a payment is recorded."
        );
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "Could not delete student");
        return;
      }
      toast.success(`${deleteTarget.name} removed from the roster`);
      setDeleteTarget(null);
      const remainingOnPage = students.length - 1;
      if (remainingOnPage === 0 && page > 0) {
        setPage(page - 1);
      } else {
        await load(q, page);
      }
    } catch {
      toast.error("Could not delete student");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-primary">
            Students
          </h1>
          <p className="text-sm text-muted-foreground">
            Add or import names, then assign rooms on the hostel map. Or use{" "}
            <Link href="/admin/intake?mode=bulk" className="text-primary hover:underline">
              Intake → Batches
            </Link>{" "}
            to also assign rooms.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setImportResult(null);
              setImportFile(null);
              setImportOpen(true);
            }}
          >
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/intake">
              <ClipboardList className="h-4 w-4" /> Guided intake
            </Link>
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add student
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search name, room, admission…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!loading && hasPagination ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canGoPrev}
              onClick={() => {
                const nextPage = page - 1;
                setPage(nextPage);
                if (nextPage === 0) void load(q, 0);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canGoNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : total === 0 && !q.trim() ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Add the first student or import a CSV/Excel file of names."
          actionLabel="Add student"
          onAction={() => setOpen(true)}
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description={`No students match "${q.trim()}". Try a different search.`}
          actionLabel="Clear search"
          onAction={() => setQ("")}
        />
      ) : (
        <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-12 gap-2 border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div className="col-span-4">Full name</div>
            <div className="col-span-3">Room</div>
            <div className="col-span-3">Residence</div>
            <div className="col-span-2" />
          </div>
          <Stagger immediate key={`${q}-${page}`}>
            {students.map((s) => {
              const booking = s.bookings[0];
              const room = bookedRoomLabel(s);
              const focused = params.get("focus") === s.id;
              return (
                <div
                  id={`student-${s.id}`}
                  key={s.id}
                  className={cn(
                    "grid gap-2 border-b border-border px-4 py-3 last:border-0 md:grid-cols-12 md:items-center",
                    focused && "bg-gold/15 ring-2 ring-inset ring-gold"
                  )}
                >
                  <div className="col-span-4 font-medium">{s.name}</div>
                  <div className="col-span-3 text-sm tabular-nums text-muted-foreground">
                    {room || "—"}
                  </div>
                  <div className="col-span-3 text-sm">
                    {booking ? (
                      <Badge variant="outline">
                        {booking.bed.room.block.code}-{booking.bed.room.number}
                        {booking.bed.label !== "1" ? booking.bed.label : ""} ·{" "}
                        {booking.residenceType.code}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Unbooked</span>
                    )}
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-1 md:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/admin/payments?studentId=${encodeURIComponent(s.id)}`
                        )
                      }
                    >
                      Payments
                    </Button>
                    {s.canDelete ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(s)}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </Stagger>
        </div>
        {!hasPagination && total > 0 ? (
          <p className="text-sm text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
        ) : null}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add student</DialogTitle>
            <DialogDescription>
              Enter the student&apos;s full name. Assign a room later on the
              hostel map.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createStudent} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required autoFocus minLength={2} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save student"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(v) => {
          setImportOpen(v);
          if (!v) {
            setImportFile(null);
            setImportResult(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import students</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file with a <strong>name</strong> column.
              Or use Intake → Batches to also assign rooms.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={runImport} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="importFile">File</Label>
              <Input
                id="importFile"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                  setImportResult(null);
                }}
              />
              <a
                href="/templates/students-import.csv"
                download
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV template
              </a>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={importing || !importFile}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {importing ? "Importing…" : "Import file"}
            </Button>
          </form>

          {importResult ? (
            <div className="space-y-3 border-t border-border pt-4">
              <p className="text-sm">
                <span className="font-medium text-primary">
                  {importResult.created} created
                </span>
                {importResult.skipped > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {importResult.skipped} skipped
                  </span>
                ) : null}
              </p>
              {importResult.errors.length > 0 ? (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border">
                  {importResult.errors.map((err, i) => (
                    <div
                      key={`${err.row}-${err.name}-${i}`}
                      className="border-b border-border px-3 py-2 text-xs last:border-0"
                    >
                      <p className="font-medium">
                        {err.row > 0 ? `Row ${err.row}` : "Row"}
                        {err.name ? `: ${err.name}` : ""}
                      </p>
                      <p className="text-muted-foreground">{err.reason}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete student</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <strong>{deleteTarget?.name}</strong>
              {deleteTarget?.admissionNo
                ? ` (${deleteTarget.admissionNo})`
                : ""}{" "}
              from this semester&apos;s roster? Any assigned bed will be freed.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={deleting}
              onClick={() => void deleteStudent()}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {deleting ? "Deleting…" : "Delete student"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      }
    >
      <StudentsInner />
    </Suspense>
  );
}
