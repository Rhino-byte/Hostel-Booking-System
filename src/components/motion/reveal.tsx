"use client";

import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "./tokens";

export function Reveal({
  children,
  delay = 0,
  y = 24,
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
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
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
