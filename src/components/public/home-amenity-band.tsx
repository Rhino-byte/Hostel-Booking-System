"use client";

import {
  Wifi,
  UtensilsCrossed,
  Shirt,
  BookOpen,
} from "lucide-react";
import { Stagger, Reveal } from "@/components/motion";

const amenities = [
  { icon: Wifi, label: "Wi-Fi & Electricity" },
  { icon: UtensilsCrossed, label: "Breakfast & Dinner Daily" },
  { icon: Shirt, label: "Laundry & Ironing" },
  { icon: BookOpen, label: "Peaceful Study Spaces" },
];

export function HomeAmenityBand() {
  return (
    <section className="border-b border-border bg-secondary/60">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {amenities.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
            ))}
          </Stagger>
        </Reveal>
      </div>
    </section>
  );
}
