"use client";

import { useEffect, useRef, useState } from "react";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Download, Users, Wallet, AlertCircle, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyText } from "@/components/money-text";
import { StatusBadge } from "@/components/status-badge";
import { Stagger } from "@/components/motion";
import { SegmentedTabs } from "@/components/admin/segmented-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  escapeCsvField,
  slugifyTermName,
  type CollectionBucket,
  type ReportGranularity,
  type ReportRow,
  type ReportTotals,
} from "@/lib/reports";

type TermOption = {
  id: string;
  name: string;
  isActive: boolean;
};

type ReportData = {
  term: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  } | null;
  totals: ReportTotals;
  collectionsOverTime: CollectionBucket[];
  rows: ReportRow[];
};

const GAUGE_COLORS = {
  collected: "#14532d",
  outstanding: "#eab308",
};

export default function ReportsPage() {
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [termId, setTermId] = useState<string>("");
  const [granularity, setGranularity] = useState<ReportGranularity>("week");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const skipGranularityFetch = useRef(true);

  useEffect(() => {
    async function initTerms() {
      try {
        const res = await fetch("/api/terms");
        if (res.ok) {
          const json = (await res.json()) as { terms?: TermOption[] };
          const list = json.terms || [];
          setTerms(list);
          const active = list.find((t) => t.isActive);
          if (active) setTermId(active.id);
          else if (list[0]) setTermId(list[0].id);
          return;
        }
      } catch {
        /* fall through to active-term fallback */
      }

      try {
        const res = await fetch("/api/reports");
        if (!res.ok) return;
        const json = (await res.json()) as ReportData;
        if (json.term) {
          setTermId(json.term.id);
          setTerms([
            {
              id: json.term.id,
              name: json.term.name,
              isActive: json.term.isActive,
            },
          ]);
        }
      } catch {
        /* no term available */
      }
    }
    void initTerms();
  }, []);

  useEffect(() => {
    if (!termId) return;

    skipGranularityFetch.current = true;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams({ termId, granularity });
        const res = await fetch(`/api/reports?${params}`);
        if (!res.ok) {
          if (!cancelled) setData(null);
          return;
        }
        const json = (await res.json()) as ReportData;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // granularity intentionally omitted — term switches only; chart toggles use chartLoading effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termId]);

  useEffect(() => {
    if (!termId || loading) return;
    if (skipGranularityFetch.current) {
      skipGranularityFetch.current = false;
      return;
    }

    let cancelled = false;
    setChartLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ termId, granularity });
        const res = await fetch(`/api/reports?${params}`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as ReportData;
        if (cancelled) return;
        setData((prev) =>
          prev
            ? { ...prev, collectionsOverTime: json.collectionsOverTime }
            : json
        );
      } catch {
        /* keep previous chart data */
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [granularity, termId, loading]);

  function exportCsv() {
    if (!data?.rows.length || !data.term) return;
    const header = [
      "Name",
      "Admission",
      "Block",
      "FeeDue",
      "FeePaid",
      "Balance",
      "Status",
    ];
    const lines = data.rows.map((r) =>
      [
        escapeCsvField(r.name),
        escapeCsvField(r.admissionNo),
        escapeCsvField(r.block),
        r.feeDue,
        r.feePaid,
        Math.max(0, r.feeDue - r.feePaid),
        escapeCsvField(r.status),
      ].join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `st-clare-balances-${slugifyTermName(data.term.name)}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printStatement(row: ReportRow) {
    const termName = data?.term?.name || "";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Statement — ${row.name}</title>
      <style>body{font-family:Georgia,serif;padding:40px;color:#1f2421} h1{color:#14532d}</style>
      </head><body>
      <h1>St. Clare's Girls Hostel</h1>
      <p>Student statement · ${termName}</p>
      <p><strong>${row.name}</strong> (${row.admissionNo}) · Block ${row.block}</p>
      <p>Fee due: KES ${row.feeDue.toLocaleString()}<br/>
      Paid: KES ${row.feePaid.toLocaleString()}<br/>
      Balance: KES ${Math.max(0, row.feeDue - row.feePaid).toLocaleString()}<br/>
      Status: ${row.status}</p>
      <p style="margin-top:40px;font-size:12px;color:#666">Generated ${new Date().toLocaleString()}</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  }

  const termName = data?.term?.name || "";
  const totals = data?.totals;
  const rows = data?.rows || [];
  const collected = totals?.collected ?? 0;
  const outstanding = totals?.outstanding ?? 0;
  const gaugeSlices = [
    { name: "Collected", value: collected },
    { name: "Outstanding", value: Math.max(outstanding, 0) },
  ];
  const showCollectedArc = collected > 0;

  const kpiCards = totals
    ? [
        {
          label: "Collected",
          value: <MoneyText amount={totals.collected} className="text-2xl font-semibold" />,
          icon: Wallet,
        },
        {
          label: "Outstanding",
          value: <MoneyText amount={totals.outstanding} className="text-2xl font-semibold" />,
          icon: AlertCircle,
        },
        {
          label: "Collection rate",
          value: <span className="text-2xl font-semibold">{totals.collectionRate}%</span>,
          icon: Percent,
        },
        {
          label: "Booked students",
          value: <span className="text-2xl font-semibold">{totals.booked}</span>,
          icon: Users,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-primary">Reports</h1>
            <p className="text-sm text-muted-foreground">
              Outstanding balances{termName ? ` for ${termName}` : ""}. Export or print statements.
            </p>
          </div>
          {terms.length > 0 ? (
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger className="w-[min(100%,280px)]">
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.isActive ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={loading || rows.length === 0}
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {loading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </CardContent>
          </Card>
        </>
      ) : !data?.term ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No semester selected. Configure a term in Settings to view reports.
          </CardContent>
        </Card>
      ) : (
        <>
          <Stagger immediate className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map(({ label, value, icon: Icon }) => (
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
          </Stagger>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Collection progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative mx-auto h-56 max-w-sm">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{ value: 1 }]}
                        dataKey="value"
                        startAngle={180}
                        endAngle={0}
                        innerRadius="60%"
                        outerRadius="90%"
                        cx="50%"
                        cy="70%"
                        stroke="none"
                        fill={GAUGE_COLORS.outstanding}
                        isAnimationActive={false}
                      />
                      {showCollectedArc ? (
                        <Pie
                          data={gaugeSlices}
                          dataKey="value"
                          startAngle={180}
                          endAngle={0}
                          innerRadius="60%"
                          outerRadius="90%"
                          cx="50%"
                          cy="70%"
                          stroke="none"
                        >
                          <Cell fill={GAUGE_COLORS.collected} />
                          <Cell fill="transparent" />
                        </Pie>
                      ) : null}
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center">
                    <p className="text-3xl font-semibold tabular-nums text-primary">
                      {totals?.collectionRate ?? 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">collected</p>
                  </div>
                </div>
                <div className="mt-2 flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: GAUGE_COLORS.collected }}
                    />
                    <span>
                      Collected{" "}
                      <MoneyText amount={totals?.collected ?? 0} className="font-medium" />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: GAUGE_COLORS.outstanding }}
                    />
                    <span>
                      Outstanding{" "}
                      <MoneyText amount={totals?.outstanding ?? 0} className="font-medium" />
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <CardTitle>Collections over time</CardTitle>
                <SegmentedTabs
                  tabs={[
                    { value: "week" as const, label: "Week" },
                    { value: "day" as const, label: "Day" },
                  ]}
                  value={granularity}
                  onChange={setGranularity}
                  layoutId="reports-granularity"
                  loadingOverlay={false}
                  aria-label="Chart granularity"
                />
              </CardHeader>
              <CardContent className="relative h-72">
                {chartLoading ? (
                  <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-lg" />
                ) : null}
                {!data || data.collectionsOverTime.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No payments recorded for this semester yet.
                  </p>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    className={chartLoading ? "opacity-40" : undefined}
                  >
                    <LineChart data={data.collectionsOverTime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d8e0d6" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value) =>
                          typeof value === "number"
                            ? `KES ${value.toLocaleString()}`
                            : String(value ?? "")
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        name="Cumulative"
                        stroke={GAUGE_COLORS.collected}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        name={granularity === "week" ? "This week" : "This day"}
                        stroke={GAUGE_COLORS.outstanding}
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Balance register</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                {rows.length} student{rows.length === 1 ? "" : "s"} ·{" "}
                {totals?.paid ?? 0} cleared · {totals?.partial ?? 0} partial ·{" "}
                {totals?.unpaid ?? 0} outstanding
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No booked students for this semester.
                </p>
              ) : (
                <Stagger immediate>
                  {rows.map((r) => (
                    <div
                      key={r.studentId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">
                          {r.name}{" "}
                          <span className="text-sm font-normal text-muted-foreground">
                            {r.admissionNo} · {r.block}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Paid <MoneyText amount={r.feePaid} /> of{" "}
                          <MoneyText amount={r.feeDue} />
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={r.status} />
                        <MoneyText
                          amount={Math.max(0, r.feeDue - r.feePaid)}
                          className="font-semibold text-primary"
                        />
                        <Button size="sm" variant="ghost" onClick={() => printStatement(r)}>
                          Statement
                        </Button>
                      </div>
                    </div>
                  ))}
                </Stagger>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
