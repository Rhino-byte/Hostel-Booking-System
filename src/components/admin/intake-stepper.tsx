"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function IntakeStepper<T extends string>({
  steps,
  current,
}: {
  steps: { id: T; label: string }[];
  current: T;
}) {
  const currentIdx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex w-full items-start" aria-label="Intake progress">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li
            key={step.id}
            className={cn("flex items-start", i < steps.length - 1 && "min-w-0 flex-1")}
          >
            <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 sm:w-16">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-4 ring-primary/15",
                  !done && !active && "bg-muted text-muted-foreground"
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-center text-[10px] font-medium sm:text-xs",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div
                className={cn(
                  "mt-4 h-0.5 min-w-2 flex-1 rounded-full",
                  i < currentIdx ? "bg-primary" : "bg-border"
                )}
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
