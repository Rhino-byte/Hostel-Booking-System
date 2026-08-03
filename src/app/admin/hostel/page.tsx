"use client";

import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { cn, formatKes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Bed = {
  id: string;
  label: string;
  bookings: {
    student: { id: string; name: string; admissionNo: string };
    residenceType: { code: string };
  }[];
};

type Room = { id: string; number: string; capacity: number; beds: Bed[] };
type Block = {
  id: string;
  code: string;
  name: string;
  residenceType: { label: string; feeKes: number };
  rooms: Room[];
};

type Student = {
  id: string;
  name: string;
  admissionNo: string;
  roomNumber?: string | null;
};

const FULL_WIDTH_CODES = new Set(["A", "B", "C"]);

function blockOccupancy(block: Block) {
  let total = 0;
  let occupied = 0;
  for (const room of block.rooms) {
    for (const bed of room.beds) {
      total += 1;
      if (bed.bookings.length > 0) occupied += 1;
    }
  }
  return { total, occupied, free: total - occupied };
}

function HostelMapInner() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [termId, setTermId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [studentId, setStudentId] = useState<string>("");

  async function load() {
    setLoading(true);
    const [hostelRes, studentsRes] = await Promise.all([
      fetch("/api/hostel"),
      fetch("/api/students?unbooked=1&limit=200"),
    ]);
    const hostel = await hostelRes.json();
    const studs = await studentsRes.json();
    setBlocks(hostel.blocks || []);
    setTermId(hostel.term?.id || "");
    setStudents(studs.students || []);
    setStudentId("");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function onBedClick(bed: Bed) {
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
    if (!selectedBed || !studentId || !termId) return;
    const res = await fetch("/api/hostel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bedId: selectedBed.id, studentId, termId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Could not assign bed");
      return;
    }
    toast.success("Bed assigned");
    setAssignOpen(false);
    setStudentId("");
    load();
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

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500" /> Free
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-primary" /> Occupied
        </span>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {blocks.map((block) => {
          const fullWidth = FULL_WIDTH_CODES.has(block.code);
          const { total, occupied, free } = blockOccupancy(block);

          return (
            <Card
              key={block.id}
              className={cn(
                "flex max-h-[min(70vh,560px)] flex-col overflow-hidden",
                fullWidth && "lg:col-span-2"
              )}
            >
              <CardHeader className="shrink-0 space-y-1 pb-3">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-lg">
                  <span className="inline-flex items-center gap-2">
                    {block.name}
                    <Badge variant="outline">{block.code}</Badge>
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatKes(block.residenceType.feeKes)} · {occupied}/{total}{" "}
                    beds
                    {free > 0 ? ` · ${free} free` : ""}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto",
                  fullWidth
                    ? "grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
                    : "grid grid-cols-2 gap-2 sm:grid-cols-3"
                )}
              >
                {block.rooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-xl border border-border/80 bg-muted/20 p-2"
                  >
                    <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {room.number}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {room.beds.map((bed) => {
                        const occupiedBed = bed.bookings.length > 0;
                        return (
                          <button
                            key={bed.id}
                            type="button"
                            onClick={() => onBedClick(bed)}
                            title={
                              occupiedBed
                                ? bed.bookings[0]!.student.name
                                : "Assign student"
                            }
                            className={cn(
                              "min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                              occupiedBed
                                ? "cursor-default border-primary/30 bg-primary text-primary-foreground"
                                : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:shadow-soft"
                            )}
                          >
                            <div className="font-semibold">
                              {room.beds.length === 1
                                ? "Bed"
                                : `Bed ${bed.label}`}
                            </div>
                            <div className="truncate opacity-80">
                              {occupiedBed
                                ? bed.bookings[0]!.student.name.split(" ")[0]
                                : "Free"}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
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
                <Select value={studentId} onValueChange={setStudentId}>
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
              onClick={assign}
              disabled={!studentId || students.length === 0}
            >
              Confirm assignment
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
