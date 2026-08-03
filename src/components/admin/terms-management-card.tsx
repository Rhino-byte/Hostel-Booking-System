"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

type Term = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  hiddenAt: string | null;
};

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultSemesterDates() {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 4);
  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

export function TermsManagementCard({ isAdmin }: { isAdmin: boolean }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const defaults = defaultSemesterDates();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [activateOnCreate, setActivateOnCreate] = useState(true);

  const [clearTerm, setClearTerm] = useState<Term | null>(null);
  const [confirmName, setConfirmName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = showHidden && isAdmin ? "?includeHidden=1" : "";
    const res = await fetch(`/api/terms${qs}`);
    const data = await res.json();
    if (res.ok) setTerms(data.terms || []);
    setLoading(false);
  }, [showHidden, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateDialog() {
    const d = defaultSemesterDates();
    setName("");
    setStartDate(d.startDate);
    setEndDate(d.endDate);
    setActivateOnCreate(true);
    setCreateOpen(true);
  }

  async function createTerm() {
    if (!isAdmin) return;
    setBusyId("create");
    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          activate: activateOnCreate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not create semester");
        return;
      }
      const createdName = data.term?.name || name.trim();
      toast.success(
        activateOnCreate
          ? `${createdName} created and activated`
          : `${createdName} created (inactive)`
      );
      setCreateOpen(false);
      const d = defaultSemesterDates();
      setName("");
      setStartDate(d.startDate);
      setEndDate(d.endDate);
      setActivateOnCreate(true);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function runAction(
    termId: string,
    action: "clear" | "activate" | "hide" | "unhide",
    extra?: Record<string, string>
  ) {
    setBusyId(termId + action);
    try {
      const res = await fetch(`/api/terms/${termId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      if (action === "clear") {
        toast.success(
          `Cleared ${data.ended ?? 0} room(s) · ${data.paymentsCleared ?? 0} payment(s) · ${data.studentsCleared ?? 0} student(s) hidden from UX`
        );
        setClearTerm(null);
        setConfirmName("");
      } else if (action === "activate") {
        const activated = terms.find((t) => t.id === termId);
        toast.success(
          activated
            ? `${activated.name} is now the active semester`
            : "Semester activated"
        );
      } else if (action === "hide") {
        toast.success("Hidden from list (data kept in database)");
      } else {
        toast.success("Semester restored to list");
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const visible = showHidden ? terms : terms.filter((t) => !t.hiddenAt);
  const activeTerm = terms.find((t) => t.isActive && !t.hiddenAt);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Semesters</CardTitle>
            <CardDescription>
              Create and activate a semester, then clear rooms, payments, and
              students from the UI for a clean start. Cleared data stays in the
              database.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 px-3 py-3">
              <div>
                <p className="font-medium">Start new semester</p>
                <p className="text-xs text-muted-foreground">
                  Enter the semester name and dates. Activating switches booking
                  and payments to the new semester (previous active one is
                  deactivated).
                </p>
              </div>
              <Button onClick={openCreateDialog}>Start new semester</Button>
              {activeTerm ? (
                <p className="text-xs text-muted-foreground">
                  Currently active:{" "}
                  <span className="font-medium text-foreground">
                    {activeTerm.name}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-amber-800">
                  No active semester — create one and activate it.
                </p>
              )}
            </div>
          ) : null}

          {isAdmin ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
                className="rounded border-border"
              />
              Show hidden semesters
            </label>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium">All semesters</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No semesters to show.
              </p>
            ) : (
              <div className="space-y-3">
                {visible.map((t) => {
                  const hidden = Boolean(t.hiddenAt);
                  return (
                    <div
                      key={t.id}
                      className="space-y-2 rounded-xl border border-border px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(t.startDate)} – {formatDate(t.endDate)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {t.isActive ? (
                            <Badge variant="paid">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                          {hidden ? (
                            <Badge variant="outline">Hidden</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId !== null}
                            onClick={() => {
                              setConfirmName("");
                              setClearTerm(t);
                            }}
                          >
                            Clear rooms, payments & students
                          </Button>
                        ) : null}
                        {isAdmin && !t.isActive && !hidden ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busyId !== null}
                            onClick={() => void runAction(t.id, "activate")}
                          >
                            Activate
                          </Button>
                        ) : null}
                        {isAdmin && !t.isActive && !hidden ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busyId !== null}
                            title="Removes from this list only. Database row stays."
                            onClick={() => void runAction(t.id, "hide")}
                          >
                            Hide from list
                          </Button>
                        ) : null}
                        {isAdmin && t.isActive ? (
                          <span className="self-center text-xs text-muted-foreground">
                            Ongoing semester cannot be removed from view
                          </span>
                        ) : null}
                        {isAdmin && hidden ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId !== null}
                            onClick={() => void runAction(t.id, "unhide")}
                          >
                            Restore
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (open) {
            const d = defaultSemesterDates();
            setStartDate(d.startDate);
            setEndDate(d.endDate);
            setActivateOnCreate(true);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start new semester</DialogTitle>
            <DialogDescription>
              Name the semester and set its dates. Activating it makes it the
              current semester for bookings and payments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="term-name">Semester name</Label>
              <Input
                id="term-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Semester 2 2026"
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="term-start">Start date</Label>
                <Input
                  id="term-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="term-end">End date</Label>
                <Input
                  id="term-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={activateOnCreate}
                onChange={(e) => setActivateOnCreate(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <span>
                Activate this semester now
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Deactivates the current active semester automatically.
                </span>
              </span>
            </label>
            <Button
              className="w-full"
              disabled={
                !name.trim() || !startDate || !endDate || busyId === "create"
              }
              onClick={() => void createTerm()}
            >
              {busyId === "create"
                ? "Saving…"
                : activateOnCreate
                  ? "Create & activate"
                  : "Create semester"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(clearTerm)}
        onOpenChange={(open) => {
          if (!open) {
            setClearTerm(null);
            setConfirmName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear rooms, payments & students</DialogTitle>
            <DialogDescription>
              For <strong>{clearTerm?.name}</strong>: ends active room bookings,
              and hides payments and students from the app UI. All records stay
              in the database. Beds become free; re-sync or import to bring the
              next roster back.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="confirm-term">
                Type <span className="font-medium">{clearTerm?.name}</span> to
                confirm
              </Label>
              <Input
                id="confirm-term"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <Button
              className="w-full"
              variant="danger"
              disabled={
                !clearTerm ||
                confirmName !== clearTerm.name ||
                busyId !== null
              }
              onClick={() => {
                if (!clearTerm) return;
                void runAction(clearTerm.id, "clear", { confirmName });
              }}
            >
              Clear rooms, payments & students
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
