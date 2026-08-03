"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Search, Upload, Users } from "lucide-react";
import { toast } from "sonner";
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

type Student = {
  id: string;
  name: string;
  admissionNo: string;
  roomNumber: string | null;
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

function StudentsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
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

  async function load(query = q) {
    setLoading(true);
    const res = await fetch(`/api/students?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const focus = params.get("focus");
    if (focus && students.length) {
      document
        .getElementById(`student-${focus}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [params, students]);

  const filtered = useMemo(() => students, [students]);

  async function createStudent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || "Could not create student");
      return;
    }
    toast.success("Student added");
    setOpen(false);
    load();
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
    const res = await fetch("/api/students/import", {
      method: "POST",
      body,
    });
    const data = await res.json().catch(() => ({}));
    setImporting(false);
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
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-primary">
            Students
          </h1>
          <p className="text-sm text-muted-foreground">
            Add or import names, then assign rooms on the hostel map.
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
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add student
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          description="Add the first student or import a CSV/Excel file of names."
          actionLabel="Add student"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-12 gap-2 border-b border-border bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <div className="col-span-4">Full name</div>
            <div className="col-span-3">Room</div>
            <div className="col-span-3">Residence</div>
            <div className="col-span-2" />
          </div>
          {filtered.map((s) => {
            const booking = s.bookings[0];
            const room = bookedRoomLabel(s);
            return (
              <div
                id={`student-${s.id}`}
                key={s.id}
                className="grid gap-2 border-b border-border px-4 py-3 last:border-0 md:grid-cols-12 md:items-center"
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
                <div className="col-span-2 md:text-right">
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
                </div>
              </div>
            );
          })}
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
              Rooms are assigned later on the hostel map.
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
