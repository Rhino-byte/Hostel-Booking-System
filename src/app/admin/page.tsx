"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyText } from "@/components/money-text";
import { Skeleton } from "@/components/ui/skeleton";
import { ResidenceDetailSheet } from "@/components/admin/residence-detail-sheet";
import { Users, Wallet, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";

type Dash = {
  term: { name: string } | null;
  totals: {
    collected: number;
    outstanding: number;
    paid: number;
    partial: number;
    unpaid: number;
    booked: number;
  };
  byBlock: {
    code: string;
    name: string;
    collected: number;
    outstanding: number;
    students: number;
    capacity: number;
  }[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  function openBlock(code: string) {
    setSelectedBlock(code);
    setSheetOpen(true);
  }

  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Collected this term",
      value: <MoneyText amount={data.totals.collected} className="text-2xl font-semibold" />,
      icon: Wallet,
    },
    {
      label: "Outstanding",
      value: <MoneyText amount={data.totals.outstanding} className="text-2xl font-semibold" />,
      icon: AlertCircle,
    },
    {
      label: "Cleared",
      value: <span className="text-2xl font-semibold">{data.totals.paid}</span>,
      icon: CheckCircle2,
    },
    {
      label: "Booked students",
      value: <span className="text-2xl font-semibold">{data.totals.booked}</span>,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-primary">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {data.term ? `Overview for ${data.term.name}` : "No active term configured"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <div className="mt-2">{value}</div>
              </div>
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Collections by block</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byBlock}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d8e0d6" />
                <XAxis dataKey="code" />
                <YAxis />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? `KES ${value.toLocaleString()}`
                      : String(value ?? "")
                  }
                />
                <Bar dataKey="collected" fill="#14532d" radius={[8, 8, 0, 0]} name="Collected" />
                <Bar dataKey="outstanding" fill="#c9a227" radius={[8, 8, 0, 0]} name="Outstanding" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Occupancy & balances</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Click a residence for occupancy and payment details
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.byBlock.map((b) => (
              <button
                key={b.code}
                type="button"
                onClick={() => openBlock(b.code)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {b.name}{" "}
                    <span className="text-muted-foreground">({b.code})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.students}/{b.capacity} beds occupied ·{" "}
                    {b.capacity > 0
                      ? Math.round((b.students / b.capacity) * 100)
                      : 0}
                    % full
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right text-sm">
                    <p>
                      <MoneyText amount={b.collected} className="font-medium text-primary" />
                    </p>
                    <p className="text-muted-foreground">
                      Due <MoneyText amount={b.outstanding} />
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
            <div className="rounded-xl bg-muted px-4 py-3 text-sm">
              Status mix: {data.totals.paid} cleared · {data.totals.partial} partial
            </div>
          </CardContent>
        </Card>
      </div>

      <ResidenceDetailSheet
        blockCode={selectedBlock}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
