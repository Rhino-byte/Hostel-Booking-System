"use client";

import { Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  HostelMap,
  type BedClickContext,
  type HostelBlock,
} from "@/components/admin/hostel-map";

type Student = {
  id: string;
  name: string;
  admissionNo: string;
  roomNumber?: string | null;
};

function HostelMapInner() {
  const [blocks, setBlocks] = useState<HostelBlock[]>([]);
  const [termId, setTermId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState<BedClickContext["bed"] | null>(
    null
  );
  const [studentId, setStudentId] = useState<string>("");

  async function load() {
    setLoading(true);
    try {
      const [hostelRes, studentsRes] = await Promise.all([
        fetch("/api/hostel"),
        fetch("/api/students?unbooked=1&limit=200"),
      ]);
      const hostel = await hostelRes.json().catch(() => ({}));
      const studs = await studentsRes.json().catch(() => ({}));
      setBlocks(hostel.blocks || []);
      setTermId(hostel.term?.id || "");
      setStudents(studs.students || []);
      setStudentId("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function onBedClick({ bed }: BedClickContext) {
    if (bed.bookings.length) {
      toast.message(bed.bookings[0]!.student.name, {
        description: `${bed.bookings[0]!.student.admissionNo} · occupied`,
      });
      return;
    }
    setSelectedBed(bed);
    setAssignOpen(true);
  }

  async function assign() {
    if (!selectedBed || !studentId || !termId || assigning) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedId: selectedBed.id, studentId, termId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not assign bed");
        return;
      }
      toast.success("Bed assigned");
      setAssignOpen(false);
      setStudentId("");
      await load();
    } catch {
      toast.error("Could not assign bed");
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className={cn("h-64", i < 2 && "lg:col-span-2")}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-primary">
          Hostel map
        </h1>
        <p className="text-sm text-muted-foreground">
          Click a free bed to assign a student. Occupied beds are locked.
        </p>
      </div>

      <HostelMap blocks={blocks} onBedClick={onBedClick} />

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          if (assigning) return;
          setAssignOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign bed</DialogTitle>
            <DialogDescription>
              Choose a student for this free bed. Double-booking is blocked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Student</Label>
              {students.length === 0 ? (
                <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  No unassigned students available. Everyone already has a room,
                  or add students first.
                </p>
              ) : (
                <Select
                  value={studentId}
                  onValueChange={setStudentId}
                  disabled={assigning}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unassigned student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.roomNumber || s.admissionNo
                          ? ` · ${s.roomNumber || s.admissionNo}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button
              className="w-full"
              onClick={() => void assign()}
              disabled={!studentId || students.length === 0 || assigning}
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {assigning ? "Assigning…" : "Confirm assignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function HostelPage() {
  return (
    <Suspense>
      <HostelMapInner />
    </Suspense>
  );
}
