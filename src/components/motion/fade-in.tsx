"use client";

import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "./tokens";

export function FadeIn({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: motionTokens.durationMed,
        delay,
        ease: motionTokens.easeOutSoft,
      }}
    >
      {children}
    </motion.div>
  );
}
