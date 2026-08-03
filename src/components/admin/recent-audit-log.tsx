"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

const INITIAL_VISIBLE = 5;

export type AuditLogItem = {
  id: string;
  action: string;
  entity: string;
  userName: string;
  createdAt: string;
};

export function RecentAuditLog({ audits }: { audits: AuditLogItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? audits : audits.slice(0, INITIAL_VISIBLE);
  const hasMore = audits.length > INITIAL_VISIBLE;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent audit log</CardTitle>
        <CardDescription>
          Latest admin actions
          {audits.length > 0
            ? ` · showing ${visible.length} of ${audits.length}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {audits.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <>
            {visible.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                <p className="font-medium">
                  {a.action} {a.entity}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.userName} · {formatDateTime(a.createdAt)}
                </p>
              </div>
            ))}
            {hasMore ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Show less" : `View more (${audits.length - INITIAL_VISIBLE} more)`}
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
