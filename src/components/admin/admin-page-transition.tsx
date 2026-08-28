"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { motionTokens } from "@/components/motion/tokens";

/** Snappy fade/slide when navigating between admin routes. */
export function AdminPageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) {
    return <div key={pathname}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{
          duration: motionTokens.durationFast,
          ease: motionTokens.easeOutSoft,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
