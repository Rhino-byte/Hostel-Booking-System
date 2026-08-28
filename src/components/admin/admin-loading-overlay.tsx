"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { motionTokens } from "@/components/motion/tokens";
import { cn } from "@/lib/utils";
import { useAdminNavigation } from "@/components/admin/admin-navigation-context";

export function AdminLoadingOverlay() {
  const { isLoading } = useAdminNavigation();
  const reduce = useReducedMotion();

  if (reduce) {
    if (!isLoading) return null;
    return (
      <div
        className="absolute inset-0 z-20 flex items-center justify-center bg-surface/70"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading intake…</p>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isLoading ? (
        <motion.div
          key="admin-loading-overlay"
          className={cn(
            "absolute inset-0 z-20 flex flex-col items-center justify-center gap-3",
            "bg-surface/60 backdrop-blur-sm"
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: motionTokens.durationFast,
            ease: motionTokens.easeOutSoft,
          }}
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading intake…</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
