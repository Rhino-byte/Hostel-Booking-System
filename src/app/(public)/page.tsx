import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/money-text";
import { SiteImage } from "@/components/patterns";
import { Reveal, Stagger, PageTransition } from "@/components/motion";
import { HomeHero } from "@/components/public/home-hero";
import { HomeAmenityBand } from "@/components/public/home-amenity-band";
import { prisma } from "@/lib/db";
import { siteContent, residenceImageKeys } from "@/lib/site-content";
import type { SiteImageKey } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const residences = await prisma.residenceType.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const count = residences.length;
  const residencesLabel =
    count === 4
      ? "Compare all four"
      : `Compare ${count} residence options`;

  return (
    <PageTransition>
      <HomeHero />
      <HomeAmenityBand />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <SiteImage
            imageKey="courtyardQuiet"
            fill
            sizes="100vw"
            wrapperClassName="absolute inset-0 h-full w-full"
            className="object-cover object-[center_40%] opacity-30"
          />
          <div className="absolute inset-0 bg-surface/85" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="max-w-xl space-y-4">
            <p className="text-sm font-medium uppercase tracking-wider text-gold">
              {siteContent.tagline}
            </p>
            <h2 className="font-serif text-3xl font-semibold text-primary sm:text-4xl">
              Stone walls. Warm welcome.
            </h2>
            <p className="text-muted-foreground sm:text-lg">
              Secure grounds, shared study rooms, and a community built on care
              and faith — on Bogani East Road, and 300m from CUEA Gate B.
            </p>
            <Button asChild variant="outline">
              <Link href="/amenities">
                See what&apos;s included <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-border bg-card/50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-gold">
                Residences
              </p>
              <h2 className="font-serif text-3xl font-semibold text-primary">
                Choose the home that fits
              </h2>
            </div>
            <Button asChild variant="outline">
              <Link href="/residences">{residencesLabel}</Link>
            </Button>
          </Reveal>
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {residences.map((r) => {
              const imageKey =
                (residenceImageKeys[r.code] as SiteImageKey | undefined) ??
                "campusHero";
              return (
                <Link
                  key={r.id}
                  href="/residences"
                  className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-lift"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <SiteImage
                      imageKey={imageKey}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      wrapperClassName="absolute inset-0"
                      className="object-cover transition-transform duration-[var(--duration-slow)] group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent" />
                    <p className="absolute bottom-3 left-4 text-xs font-semibold uppercase tracking-wide text-gold">
                      {r.code}
                    </p>
                  </div>
                  <div className="space-y-2 p-5">
                    <h3 className="font-serif text-xl font-semibold">{r.label}</h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {r.features}
                    </p>
                    <div className="pt-1">
                      <p className="text-xs text-muted-foreground">Per semester</p>
                      <MoneyText
                        amount={r.feeKes}
                        className="text-lg font-semibold text-primary"
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </Stagger>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-gold/25 bg-primary px-8 py-12 text-primary-foreground sm:px-12">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(201,162,39,0.28),_transparent_55%)]" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-lg space-y-2">
                <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
                  Ready to enquire or check a balance?
                </h2>
                <p className="text-sm text-primary-foreground/80">
                  Call the office, visit near CUEA, or sign in as a parent to view
                  payment status.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="gold" size="lg">
                  <Link href="/contact">Contact us</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-primary-foreground/35 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  <Link href="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </PageTransition>
  );
}
