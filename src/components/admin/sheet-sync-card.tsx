"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Sheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

type SyncStatus = {
  configured: boolean;
  lastSync: {
    id: string;
    direction: string;
    pulled: number;
    pushed: number;
    created: number;
    updated: number;
    conflicts: number;
    errors: string[];
    notes: {
      paymentsImported?: number;
      bookingsAssigned?: number;
      unbooked?: string[];
      notes?: string[];
    };
    createdAt: string;
    userName: string | null;
  } | null;
};

export function SheetSyncCard() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/sync");
    if (!res.ok) return;
    setStatus(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function syncNow() {
    setLoading(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed");
        return;
      }
      if (data.errors?.length) {
        toast.error(data.errors[0], {
          description: `${data.created} created · ${data.updated} updated · ${data.pushed} pushed`,
        });
      } else {
        toast.success("Sheet synced", {
          description: `${data.created} students created · ${data.paymentsImported ?? 0} payments imported · ${data.pushed} rows pushed`,
        });
      }
      await refresh();
    } catch {
      toast.error("Could not reach sync endpoint");
    } finally {
      setLoading(false);
    }
  }

  const last = status?.lastSync;
  const unbooked = last?.notes?.unbooked ?? [];

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sheet className="h-5 w-5 text-primary" />
            Google Sheet sync
          </CardTitle>
          <CardDescription>
            Live roster and payment mirror for Sheet1 (NAME, NO, DATE, AMOUNT, BLOCK, MODE).
          </CardDescription>
        </div>
        <Button onClick={syncNow} disabled={loading || status?.configured === false}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing…" : "Sync now"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {status?.configured ? (
            <Badge variant="paid">Configured</Badge>
          ) : (
            <Badge variant="unpaid">Not configured</Badge>
          )}
          {last ? (
            <span className="text-xs text-muted-foreground">
              Last sync {formatDateTime(last.createdAt)}
              {last.userName ? ` · ${last.userName}` : " · cron"}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No syncs yet</span>
          )}
        </div>

        {!status?.configured ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Add <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and{" "}
            <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code> to{" "}
            <code className="text-xs">.env</code>, then share the Google Sheet with that email as
            Editor.
          </p>
        ) : null}

        {last ? (
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["Pulled rows", last.pulled],
              ["Created", last.created],
              ["Updated", last.updated],
              ["Pushed", last.pushed],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-border px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {last?.notes?.paymentsImported != null || last?.notes?.bookingsAssigned != null ? (
          <p className="text-sm text-muted-foreground">
            Imported {last.notes.paymentsImported ?? 0} sheet payment(s) · assigned{" "}
            {last.notes.bookingsAssigned ?? 0} bed(s)
            {last.conflicts ? ` · ${last.conflicts} conflict(s)` : ""}
          </p>
        ) : null}

        {last?.errors?.length ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p className="font-medium">Errors</p>
            <ul className="mt-1 list-disc pl-4">
              {last.errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {unbooked.length ? (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">Could not auto-assign beds</p>
            <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-4 text-muted-foreground">
              {unbooked.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
