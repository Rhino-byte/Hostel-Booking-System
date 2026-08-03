"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { siteContent } from "@/lib/site-content";

const links = [
  { href: "/", label: "Home" },
  { href: "/residences", label: "Residences" },
  { href: "/amenities", label: "Amenities" },
  { href: "/contact", label: "Contact" },
];

/** Routes whose first viewport is a dark full-bleed hero under the sticky header */
const DARK_HERO_PATHS = new Set(["/", "/amenities"]);

export function PublicHeader() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const inverted = DARK_HERO_PATHS.has(pathname) && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-[var(--duration-fast)]",
        scrolled || open
          ? "border-b border-border bg-surface/95 shadow-soft backdrop-blur"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className={cn(
            "font-serif text-lg font-semibold tracking-tight",
            inverted ? "text-primary-foreground" : "text-primary"
          )}
        >
          <span className="hidden sm:inline">{siteContent.brand}</span>
          <span className="sm:hidden">St. Clare</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? inverted
                      ? "text-primary-foreground"
                      : "text-primary"
                    : inverted
                      ? "text-primary-foreground/80 hover:text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? (
                  reduceMotion ? (
                    <span
                      className={cn(
                        "absolute inset-0 rounded-lg",
                        inverted ? "bg-primary-foreground/15" : "bg-primary/10"
                      )}
                      aria-hidden
                    />
                  ) : (
                    <motion.span
                      layoutId="public-nav-pill"
                      className={cn(
                        "absolute inset-0 rounded-lg",
                        inverted ? "bg-primary-foreground/15" : "bg-primary/10"
                      )}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                        mass: 0.8,
                      }}
                      aria-hidden
                    />
                  )
                ) : null}
                <span className="relative z-10">{l.label}</span>
              </Link>
            );
          })}
          <Button
            asChild
            size="sm"
            className="ml-2"
            variant={inverted ? "gold" : "default"}
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "md:hidden",
            inverted && "text-primary-foreground hover:bg-primary-foreground/10"
          )}
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open ? (
        <div className="border-t border-border bg-surface px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-xl px-4 py-3 text-base font-medium",
                  pathname === l.href
                    ? "bg-primary/10 text-primary"
                    : "text-foreground"
                )}
              >
                {l.label}
              </Link>
            ))}
            <Button asChild className="mt-2">
              <Link href="/login">Sign in</Link>
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
