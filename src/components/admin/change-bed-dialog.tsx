"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  roomBedLabel,
  type HostelBlock,
} from "@/components/admin/hostel-map";
import { formatKes } from "@/lib/utils";

export type ChangeBedStudent = {
  id: string;
  name: string;
  admissionNo: string;
};

export type ChangeBedCurrent = {
  bedId?: string;
  bedLabel: string;
  blockCode: string;
  residenceLabel: string;
  feeKes: number;
};

type FreeBedOption = {
  bedId: string;
  label: string;
  blockCode: string;
  residenceLabel: string;
  feeKes: number;
};

function freeBedsFromBlocks(
  blocks: HostelBlock[],
  excludeBedId?: string
): FreeBedOption[] {
  const options: FreeBedOption[] = [];
  for (const block of blocks) {
    for (const room of block.rooms) {
      for (const bed of room.beds) {
        if (bed.bookings.length > 0) continue;
        if (excludeBedId && bed.id === excludeBedId) continue;
        options.push({
          bedId: bed.id,
          label: roomBedLabel(block.code, room.number, bed),
          blockCode: block.code,
          residenceLabel: block.residenceType.label,
          feeKes: block.residenceType.feeKes,
        });
      }
    }
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function ChangeBedDialog({
  open,
  onOpenChange,
  student,
  termId,
  current,
  blocks,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: ChangeBedStudent | null;
  termId: string;
  current: ChangeBedCurrent | null;
  blocks: HostelBlock[];
  onDone: () => void | Promise<void>;
}) {
  const [bedId, setBedId] = useState("");
  const [saving, setSaving] = useState(false);

  const freeBeds = useMemo(
    () => freeBedsFromBlocks(blocks, current?.bedId),
    [blocks, current?.bedId]
  );

  const selected = freeBeds.find((b) => b.bedId === bedId) || null;
  const feeChanges =
    selected != null &&
    current != null &&
    selected.feeKes !== current.feeKes;

  function handleOpenChange(next: boolean) {
    if (saving) return;
    if (!next) setBedId("");
    onOpenChange(next);
  }

  async function confirm() {
    if (!student || !selected || !termId || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hostel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          bedId: selected.bedId,
          termId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not move student");
        return;
      }
      const fromLabel =
        data.from?.bedLabel || current?.bedLabel || "previous bed";
      const toLabel = data.to?.bedLabel || selected.label;
      toast.success(`Moved ${student.name} from ${fromLabel} to ${toLabel}`);
      setBedId("");
      onOpenChange(false);
      await onDone();
    } catch {
      toast.error("Could not move student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change bed</DialogTitle>
          <DialogDescription>
            {student
              ? `Move ${student.name} (${student.admissionNo}) to another free bed.`
              : "Move this student to another free bed."}
          </DialogDescription>
        </DialogHeader>

        {current ? (
          <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
            Current:{" "}
            <span className="font-medium">
              {current.bedLabel} · {current.residenceLabel} ·{" "}
              {formatKes(current.feeKes)}
            </span>
          </p>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>New bed</Label>
            {freeBeds.length === 0 ? (
              <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                No free beds available this term.
              </p>
            ) : (
              <Select
                value={bedId}
                onValueChange={setBedId}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select free bed" />
                </SelectTrigger>
                <SelectContent>
                  {freeBeds.map((b) => (
                    <SelectItem key={b.bedId} value={b.bedId}>
                      {b.label} · {b.residenceLabel} · {formatKes(b.feeKes)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {feeChanges && selected && current ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Residence fee changes from {formatKes(current.feeKes)} to{" "}
              {formatKes(selected.feeKes)}. Amounts already paid stay recorded;
              the outstanding balance will use the new fee.
            </p>
          ) : null}

          <Button
            className="w-full"
            onClick={() => void confirm()}
            disabled={!bedId || freeBeds.length === 0 || saving || !termId}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Moving…" : "Confirm move"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
