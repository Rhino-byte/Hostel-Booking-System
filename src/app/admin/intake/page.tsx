"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { IntakeWizard } from "@/components/admin/intake-wizard";
import { BulkIntakeWizard } from "@/components/admin/bulk-intake-wizard";

type IntakeMode = "one" | "bulk";

function isBatchesMode(value: string | null) {
  return value === "bulk" || value === "batches";
}

function IntakeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const mode: IntakeMode = isBatchesMode(params.get("mode")) ? "bulk" : "one";

  function setMode(next: IntakeMode) {
    router.replace(
      next === "bulk" ? "/admin/intake?mode=bulk" : "/admin/intake",
      { scroll: false }
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-primary">
            Student intake
          </h1>
          <p className="text-sm text-muted-foreground">
            Add one student, or process a start-of-term list in batches: names,
            beds, optional payments — then confirm once.
          </p>
        </div>
        <div
          className="inline-flex rounded-xl border border-border bg-card p-1"
          role="group"
          aria-label="Intake mode"
        >
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "one"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={mode === "one"}
            onClick={() => setMode("one")}
          >
            One student
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              mode === "bulk"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={mode === "bulk"}
            onClick={() => setMode("bulk")}
          >
            Batches
          </button>
        </div>
      </div>
      {mode === "bulk" ? <BulkIntakeWizard /> : <IntakeWizard />}
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-72" />
        </div>
      }
    >
      <IntakeInner />
    </Suspense>
  );
}
