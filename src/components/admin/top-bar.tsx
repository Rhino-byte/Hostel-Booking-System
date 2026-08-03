"use client";

import { useEffect, useState } from "react";
import { Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Me = {
  user: { name: string; role: string };
  idleRemainingMs: number;
  idleMs: number;
};

export function TopBar({
  termName,
  onOpenCommand,
}: {
  termName?: string;
  onOpenCommand: () => void;
}) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;
      const data = await res.json();
      if (alive) setMe(data);
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const minutesLeft = me ? Math.ceil(me.idleRemainingMs / 60000) : null;
  const warn = minutesLeft !== null && minutesLeft <= 3;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="outline"
          className="hidden max-w-xs justify-start gap-2 text-muted-foreground sm:flex"
          onClick={onOpenCommand}
        >
          <Search className="h-4 w-4" />
          <span className="truncate">Search students or jump…</span>
          <kbd className="ml-auto rounded border border-border bg-muted px-1.5 text-[10px]">
            ⌘K
          </kbd>
        </Button>
        <Button variant="outline" size="icon" className="sm:hidden" onClick={onOpenCommand}>
          <Search className="h-4 w-4" />
        </Button>
        {termName ? (
          <Badge variant="outline" className="hidden md:inline-flex">
            Active term: {termName}
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {minutesLeft !== null ? (
          <Badge variant={warn ? "unpaid" : "secondary"} className="gap-1">
            <Clock className="h-3 w-3" />
            Idle {minutesLeft}m
          </Badge>
        ) : null}
        {me ? (
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight">{me.user.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{me.user.role.toLowerCase()}</p>
          </div>
        ) : null}
      </div>
    </header>
  );
}
