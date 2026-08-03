"use client";

import {
  Wifi,
  UtensilsCrossed,
  Shirt,
  BookOpen,
  Sun,
  HeartHandshake,
} from "lucide-react";
import { SiteImage } from "@/components/patterns";
import { PageTransition, Reveal, Stagger } from "@/components/motion";
import { siteContent } from "@/lib/site-content";

const items = [
  {
    icon: Wifi,
    title: "Wi-Fi & Electricity",
    body: "Reliable connectivity and power so students can study and stay in touch with home.",
  },
  {
    icon: UtensilsCrossed,
    title: "Meals included",
    body: "Breakfast and dinner daily, plus three meals on weekends and public holidays.",
  },
  {
    icon: Shirt,
    title: "Laundry & ironing",
    body: "Shared laundry and ironing facilities available across all residences.",
  },
  {
    icon: BookOpen,
    title: "Study & TV rooms",
    body: "Quiet, conducive spaces for homework, revision, and downtime.",
  },
  {
    icon: Sun,
    title: "Secure grounds",
    body: "A peaceful campus setting designed for safety and belonging.",
  },
  {
    icon: HeartHandshake,
    title: "Faith-filled community",
    body: "A supportive environment where girls live, learn, and grow as one family.",
  },
];

export function AmenitiesContent() {
  return (
    <PageTransition>
      <section className="relative -mt-16 min-h-[22rem] overflow-hidden text-primary-foreground">
        <SiteImage
          imageKey="groundsDusk"
          fill
          priority
          sizes="100vw"
          wrapperClassName="absolute inset-0 h-full w-full"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/70 to-primary/35" />
        <div className="relative mx-auto flex min-h-[22rem] max-w-6xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-wider text-gold">
              Included for all
            </p>
            <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
              Amenities that feel like home
            </h1>
            <p className="mt-3 max-w-xl text-primary-foreground/85">
              Universal features shared across every residence at{" "}
              {siteContent.brand}.
            </p>
          </Reveal>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <Stagger className="divide-y divide-border border-y border-border">
          {items.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-3 py-8 sm:flex-row sm:items-start sm:gap-8"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h2 className="font-serif text-xl font-semibold text-primary">
                  {title}
                </h2>
                <p className="max-w-2xl text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </Stagger>

        <Reveal className="mt-14 overflow-hidden rounded-3xl">
          <div className="relative aspect-[21/9] min-h-[12rem]">
            <SiteImage
              imageKey="courtyardQuiet"
              fill
              sizes="100vw"
              wrapperClassName="absolute inset-0"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-primary/45" />
            <p className="absolute bottom-6 left-6 right-6 font-serif text-2xl font-semibold text-primary-foreground sm:text-3xl">
              {siteContent.tagline}
            </p>
          </div>
        </Reveal>
      </div>
    </PageTransition>
  );
}
