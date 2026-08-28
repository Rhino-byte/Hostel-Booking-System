"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { IntakeWizard } from "@/components/admin/intake-wizard";
import { BulkIntakeWizard } from "@/components/admin/bulk-intake-wizard";
import {
  SegmentedTabs,
  SegmentedTabPanels,
} from "@/components/admin/segmented-tabs";
import { useAdminNavigation } from "@/components/admin/admin-navigation-context";

type IntakeMode = "one" | "bulk";

function isBatchesMode(value: string | null) {
  return value === "bulk" || value === "batches";
}

function IntakeInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { endSegmentLoad } = useAdminNavigation();
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
        <SegmentedTabs
          layoutId="intake-mode-tabs"
          aria-label="Intake mode"
          value={mode}
          onChange={setMode}
          tabs={[
            { value: "one", label: "One student" },
            { value: "bulk", label: "Batches" },
          ]}
        />
      </div>
      <SegmentedTabPanels
        activeKey={mode}
        autoEndLoad={false}
        panels={{
          one: (
            <IntakeWizard onBootstrapComplete={endSegmentLoad} />
          ),
          bulk: (
            <BulkIntakeWizard onBootstrapComplete={endSegmentLoad} />
          ),
        }}
      />
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
