"use client";

import { cn, formatKes } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type HostelBed = {
  id: string;
  label: string;
  bookings: {
    student: { id: string; name: string; admissionNo: string };
    residenceType: { code: string };
  }[];
};

export type HostelRoom = {
  id: string;
  number: string;
  capacity: number;
  beds: HostelBed[];
};

export type HostelBlock = {
  id: string;
  code: string;
  name: string;
  residenceType: { label: string; feeKes: number };
  rooms: HostelRoom[];
};

export type BedTone = "free" | "occupied" | "pending" | "selected";

export type BedAppearance = {
  tone: BedTone;
  caption: string;
  title: string;
};

export type BedClickContext = {
  block: HostelBlock;
  room: HostelRoom;
  bed: HostelBed;
};

const FULL_WIDTH_CODES = new Set(["A", "B", "C"]);

const TONE_CLASS: Record<BedTone, string> = {
  free: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:shadow-soft",
  occupied:
    "border-primary/30 bg-primary text-primary-foreground hover:shadow-soft",
  pending: "border-gold bg-gold/20 text-foreground ring-2 ring-gold",
  selected: "border-gold bg-gold/20 text-foreground ring-2 ring-gold",
};

export function roomBedLabel(
  blockCode: string,
  roomNumber: string,
  bed: { label: string }
): string {
  const extra = bed.label !== "1" ? bed.label : "";
  return `${blockCode}-${roomNumber}${extra}`;
}

export function blockOccupancy(block: HostelBlock) {
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

function blockVisualOccupancy(
  block: HostelBlock,
  appearance?: (ctx: BedClickContext) => BedAppearance | undefined
) {
  let total = 0;
  let occupied = 0;
  for (const room of block.rooms) {
    for (const bed of room.beds) {
      total += 1;
      const look = appearance?.({ block, room, bed });
      const taken = look ? look.tone !== "free" : bed.bookings.length > 0;
      if (taken) occupied += 1;
    }
  }
  return { total, occupied, free: total - occupied };
}

export function findBed(blocks: HostelBlock[], bedId: string) {
  for (const block of blocks) {
    for (const room of block.rooms) {
      for (const bed of room.beds) {
        if (bed.id === bedId) {
          return { block, room, bed };
        }
      }
    }
  }
  return null;
}

function defaultAppearance(bed: HostelBed): BedAppearance {
  const occupant = bed.bookings[0]?.student;
  if (occupant) {
    return {
      tone: "occupied",
      caption: occupant.name.split(" ")[0] || occupant.name,
      title: `${occupant.name} · change bed`,
    };
  }
  return { tone: "free", caption: "Free", title: "Assign student" };
}

export function HostelMap({
  blocks,
  appearance,
  onBedClick,
  disabled,
  legend = ["free", "occupied"],
}: {
  blocks: HostelBlock[];
  appearance?: (ctx: BedClickContext) => BedAppearance | undefined;
  onBedClick: (ctx: BedClickContext) => void;
  disabled?: boolean;
  legend?: BedTone[];
}) {
  if (blocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No hostel blocks to show.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs">
        {legend.includes("free") ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-emerald-500" /> Free
          </span>
        ) : null}
        {legend.includes("occupied") ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-primary" /> Occupied
          </span>
        ) : null}
        {legend.includes("pending") ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-gold" /> Pending
          </span>
        ) : null}
        {legend.includes("selected") ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded bg-gold" /> Selected
          </span>
        ) : null}
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        {blocks.map((block) => {
          const fullWidth = FULL_WIDTH_CODES.has(block.code);
          const counts = blockVisualOccupancy(block, appearance);

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
                    {formatKes(block.residenceType.feeKes)} · {counts.occupied}/
                    {counts.total} beds
                    {counts.free > 0 ? ` · ${counts.free} free` : ""}
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
                        const ctx = { block, room, bed };
                        const look =
                          appearance?.(ctx) ?? defaultAppearance(bed);
                        return (
                          <button
                            key={bed.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => onBedClick(ctx)}
                            title={look.title}
                            className={cn(
                              "min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-default",
                              TONE_CLASS[look.tone]
                            )}
                          >
                            <div className="font-semibold">
                              {room.beds.length === 1
                                ? "Bed"
                                : `Bed ${bed.label}`}
                            </div>
                            <div className="truncate opacity-80">
                              {look.caption}
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
    </div>
  );
}
