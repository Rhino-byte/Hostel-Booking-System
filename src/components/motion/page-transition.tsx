"use client";

import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "./tokens";

export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: motionTokens.durationMed,
        ease: motionTokens.easeOutSoft,
      }}
    >
      {children}
    </motion.div>
  );
}
