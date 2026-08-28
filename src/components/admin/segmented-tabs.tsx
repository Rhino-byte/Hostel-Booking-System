"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "@/components/motion/tokens";
import { cn } from "@/lib/utils";

export type SegmentedTab<T extends string> = {
  value: T;
  label: string;
};

const pillSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  layoutId,
  "aria-label": ariaLabel,
  className,
}: {
  tabs: SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  "aria-label"?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn(
        "inline-flex rounded-xl border border-border bg-card p-1",
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
            onClick={() => onChange(tab.value)}
          >
            {active ? (
              reduce ? (
                <span
                  className="absolute inset-0 rounded-lg bg-primary"
                  aria-hidden
                />
              ) : (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-lg bg-primary"
                  transition={pillSpring}
                  aria-hidden
                />
              )
            ) : null}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedTabPanels({
  activeKey,
  panels,
  className,
}: {
  activeKey: string;
  panels: Record<string, React.ReactNode>;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const content = panels[activeKey];

  if (reduce) {
    return <div className={className}>{content}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{
          duration: motionTokens.durationFast,
          ease: motionTokens.easeOutSoft,
        }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
