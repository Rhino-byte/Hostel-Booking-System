"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteImage } from "@/components/patterns";
import { FadeIn } from "@/components/motion";
import { motionTokens } from "@/components/motion/tokens";
import { siteContent } from "@/lib/site-content";

export function HomeHero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative -mt-16 min-h-[min(100dvh,52rem)] overflow-hidden text-primary-foreground">
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { scale: 1.08 }}
        animate={{ scale: 1 }}
        transition={{
          duration: motionTokens.durationSlow * 2.2,
          ease: motionTokens.easeOutSoft,
        }}
      >
        <SiteImage
          imageKey="campusHero"
          fill
          priority
          sizes="100vw"
          wrapperClassName="absolute inset-0 h-full w-full"
          className="object-cover object-center"
        />
      </motion.div>
      <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary/55 to-primary/25" />
      <div className="absolute inset-0 bg-gradient-to-r from-primary/70 via-transparent to-transparent" />

      <div className="relative mx-auto flex min-h-[min(100dvh,52rem)] max-w-6xl flex-col justify-end px-4 pb-16 pt-28 sm:px-6 sm:pb-20">
        <FadeIn className="max-w-2xl space-y-5">
          <p className="font-serif text-3xl font-semibold tracking-tight text-gold sm:text-4xl">
            {siteContent.brand}
          </p>
          <h1 className="font-serif text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-6xl">
            A peaceful home for girls to live, learn and grow
          </h1>
          <p className="max-w-xl text-base text-primary-foreground/90 sm:text-lg">
            Supportive, faith-filled hostel living near CUEA — with residence
            options, daily meals, and staff who treat every student like family.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="gold" size="lg">
              <Link href="/residences">
                Explore residences <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary-foreground/35 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link href="/contact">Enquire</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
