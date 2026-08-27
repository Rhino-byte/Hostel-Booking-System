"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/money-text";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FeeStatus } from "@/lib/utils";

type StatusFilter = "all" | FeeStatus;

type BlockDetail = {
  block: { code: string; name: string };
  term: { name: string };
  occupancy: {
    occupied: number;
    capacity: number;
    free: number;
    ratePercent: number;
  };
  payments: {
    collected: number;
    outstanding: number;
    paid: number;
    partial: number;
    unpaid: number;
  };
  students: {
    id: string;
    name: string;
    roomNumber: string | null;
    bedLabel: string;
    feeDue: number;
    feePaid: number;
    balance: number;
    status: FeeStatus;
  }[];
};

const OCCUPANCY_COLORS = ["#14532d", "#d8e0d6"];
const STATUS_COLORS = {
  CLEARED: "#14532d",
  PARTIAL: "#c9a227",
  UNPAID: "#b4534a",
  OVERPAID: "#c9a227",
};

export function ResidenceDetailSheet({
  blockCode,
  open,
  onOpenChange,
}: {
  blockCode: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    if (!open || !blockCode) {
      setData(null);
      setError(null);
      setStatusFilter("all");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/dashboard/${encodeURIComponent(blockCode)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load");
        return json as BlockDetail;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, blockCode]);

  const occupancyChart = data
    ? [
        { name: "Occupied", value: data.occupancy.occupied },
        { name: "Free", value: data.occupancy.free },
      ].filter((d) => d.value > 0)
    : [];

  const statusChart = data
    ? [
        { name: "Cleared", value: data.payments.paid, key: "CLEARED" as const },
        {
          name: "Paid partially",
          value: data.payments.partial,
          key: "PARTIAL" as const,
        },
        {
          name: "Outstanding",
          value: data.payments.unpaid,
          key: "UNPAID" as const,
        },
      ].filter((d) => d.value > 0)
    : [];

  const filteredStudents = data
    ? statusFilter === "all"
      ? data.students
      : data.students.filter((s) => s.status === statusFilter)
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={data ? `${data.block.name} details` : "Residence details"}
        className="max-w-xl"
      >
        <SheetHeader>
          <SheetTitle>
            {data ? data.block.name : blockCode ? `Block ${blockCode}` : "Residence"}
            {data ? (
              <Badge variant="gold" className="ml-2 align-middle">
                {data.block.code}
              </Badge>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {data
              ? `${data.term.name} · occupancy, payment status, and student balances`
              : "Loading residence details…"}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : data ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl border border-border px-2 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Occupancy
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
                    {data.occupancy.occupied}/{data.occupancy.capacity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.occupancy.ratePercent}%
                  </p>
                </div>
                <div className="rounded-xl border border-border px-2 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Collected
                  </p>
                  <MoneyText
                    amount={data.payments.collected}
                    className="mt-1 block text-sm font-semibold text-primary"
                  />
                </div>
                <div className="rounded-xl border border-border px-2 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Outstanding
                  </p>
                  <MoneyText
                    amount={data.payments.outstanding}
                    className="mt-1 block text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border p-3">
                  <p className="mb-2 text-sm font-medium">Occupancy rate</p>
                  {occupancyChart.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No beds configured
                    </p>
                  ) : (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={occupancyChart}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={40}
                            outerRadius={64}
                            paddingAngle={2}
                          >
                            {occupancyChart.map((_, i) => (
                              <Cell
                                key={occupancyChart[i]!.name}
                                fill={OCCUPANCY_COLORS[i % OCCUPANCY_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border p-3">
                  <p className="mb-2 text-sm font-medium">Payment status</p>
                  {statusChart.length === 0 ? (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No students booked yet
                    </p>
                  ) : (
                    <div className="h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusChart}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={40}
                            outerRadius={64}
                            paddingAngle={2}
                            cursor="pointer"
                            onClick={(_, index) => {
                              const slice = statusChart[index];
                              if (slice) setStatusFilter(slice.key);
                            }}
                          >
                            {statusChart.map((d) => (
                              <Cell
                                key={d.key}
                                fill={STATUS_COLORS[d.key]}
                                className="cursor-pointer outline-none"
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Occupancy summary</p>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Capacity</th>
                        <th className="px-3 py-2 font-medium">Occupied</th>
                        <th className="px-3 py-2 font-medium">Free</th>
                        <th className="px-3 py-2 font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2 tabular-nums">
                          {data.occupancy.capacity}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {data.occupancy.occupied}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {data.occupancy.free}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {data.occupancy.ratePercent}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Students (
                    {statusFilter === "all"
                      ? data.students.length
                      : `${filteredStudents.length} of ${data.students.length}`}
                    )
                  </p>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                  >
                    <SelectTrigger className="h-9 w-full sm:w-48">
                      <SelectValue placeholder="Fee status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="CLEARED">Cleared</SelectItem>
                      <SelectItem value="PARTIAL">Paid partially</SelectItem>
                      <SelectItem value="UNPAID">Outstanding</SelectItem>
                      <SelectItem value="OVERPAID">Overpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {data.students.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    No students assigned to this residence yet.
                  </p>
                ) : filteredStudents.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    No students match this status.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/90 text-left text-xs text-muted-foreground backdrop-blur">
                          <tr>
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium">Bed</th>
                            <th className="px-3 py-2 font-medium">Paid</th>
                            <th className="px-3 py-2 font-medium">Balance</th>
                            <th className="px-3 py-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((s) => (
                            <tr
                              key={s.id}
                              className="border-t border-border align-top"
                            >
                              <td className="px-3 py-2">
                                <p className="font-medium">{s.name}</p>
                                {s.roomNumber ? (
                                  <p className="text-xs text-muted-foreground">
                                    Room {s.roomNumber}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                {s.bedLabel}
                              </td>
                              <td className="px-3 py-2">
                                <MoneyText
                                  amount={s.feePaid}
                                  className="tabular-nums text-xs"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <MoneyText
                                  amount={s.balance}
                                  className="tabular-nums text-xs font-medium"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={s.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline" className="w-full">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
