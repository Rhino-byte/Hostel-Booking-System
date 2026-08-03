"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bath, BedDouble, Check, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/money-text";
import { SiteImage } from "@/components/patterns";
import { Stagger } from "@/components/motion";
import { residenceImageKeys, type SiteImageKey } from "@/lib/site-content";
import { cn } from "@/lib/utils";

type Residence = {
  id: string;
  code: string;
  label: string;
  feeKes: number;
  depositKes: number;
  bathroom: string;
  config: string;
  features: string;
};

const configLabel: Record<string, string> = {
  PRIVATE_SINGLE: "Private / Single",
  SHARED_SINGLE: "Shared / Single beds",
  SHARED_BUNK: "Shared / Bunk beds",
};

export function ResidenceCompare({ residences }: { residences: Residence[] }) {
  const [compare, setCompare] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(residences[0]?.id ?? null);

  useEffect(() => {
    if (compare) setExpanded(null);
  }, [compare]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tap a card to expand details, or compare all side by side.
        </p>
        <Button
          variant={compare ? "default" : "outline"}
          onClick={() => setCompare((v) => !v)}
        >
          <Columns2 className="h-4 w-4" />
          {compare ? "Exit compare" : "Compare all"}
        </Button>
      </div>

      <Stagger
        className={cn(
          "grid gap-4",
          compare ? "lg:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-2"
        )}
      >
        {residences.map((r) => {
          const isOpen = compare || expanded === r.id;
          const imageKey =
            (residenceImageKeys[r.code] as SiteImageKey | undefined) ??
            "campusHero";
          return (
            <motion.div key={r.id} layout transition={{ duration: 0.2 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => !compare && setExpanded(isOpen ? null : r.id)}
                onKeyDown={(e) => {
                  if (!compare && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setExpanded(isOpen ? null : r.id);
                  }
                }}
                className={cn(
                  "h-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift",
                  isOpen && "ring-2 ring-gold/50"
                )}
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  <SiteImage
                    imageKey={imageKey}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    wrapperClassName="absolute inset-0"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/50 to-transparent" />
                  <Badge variant="gold" className="absolute bottom-3 left-3">
                    {r.code}
                  </Badge>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif text-xl font-semibold">{r.label}</h3>
                    {isOpen ? (
                      <Check className="h-5 w-5 shrink-0 text-primary" />
                    ) : null}
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Semester fee</p>
                    <MoneyText
                      amount={r.feeKes}
                      className="text-2xl font-semibold text-primary"
                    />
                    <p className="mt-1 text-sm text-muted-foreground">
                      Deposit <MoneyText amount={r.depositKes} />
                    </p>
                  </div>

                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-3 overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline">
                            <BedDouble className="h-3 w-3" />
                            {configLabel[r.config] ?? r.config}
                          </Badge>
                          <Badge variant="outline">
                            <Bath className="h-3 w-3" />
                            {r.bathroom === "PRIVATE"
                              ? "Private bath"
                              : "Shared bath"}
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {r.features}
                        </p>
                        <ul className="space-y-1 text-sm text-foreground">
                          {[
                            "Wi-Fi & electricity included",
                            "Breakfast & dinner daily",
                            "3 meals on weekends & holidays",
                            "Laundry & ironing facilities",
                          ].map((f) => (
                            <li key={f} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    ) : (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {r.features}
                      </p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </Stagger>
    </div>
  );
}
