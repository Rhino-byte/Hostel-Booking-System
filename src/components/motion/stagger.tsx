"use client";

import { Children } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { motionTokens } from "./tokens";
import { cn } from "@/lib/utils";

export function Stagger({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const items = Children.toArray(children);

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: motionTokens.stagger,
            delayChildren: delay,
          },
        },
      }}
    >
      {items.map((child, i) => (
        <motion.div
          key={i}
          variants={{
            hidden: { opacity: 0, y: 14 },
            show: {
              opacity: 1,
              y: 0,
              transition: {
                duration: motionTokens.durationMed,
                ease: motionTokens.easeOutSoft,
              },
            },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
