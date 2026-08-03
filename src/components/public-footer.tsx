import Link from "next/link";
import { siteContent } from "@/lib/site-content";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div className="space-y-2">
          <p className="font-serif text-lg font-semibold">{siteContent.brand}</p>
          <p className="text-sm text-primary-foreground/80">{siteContent.tagline}</p>
          <p className="pt-2 text-sm text-primary-foreground/75">
            {siteContent.landmark}
          </p>
        </div>
        <div className="space-y-2 text-sm text-primary-foreground/85">
          <p className="font-medium text-primary-foreground">Contact</p>
          {siteContent.phones.map((p) => (
            <a key={p.href} href={p.href} className="block hover:underline">
              {p.display}
            </a>
          ))}
          <a
            href={`mailto:${siteContent.email}`}
            className="block hover:underline"
          >
            {siteContent.email}
          </a>
          <a
            href={siteContent.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:underline"
          >
            Directions on Maps
          </a>
        </div>
        <div className="flex flex-col gap-2 text-sm text-primary-foreground/85">
          <p className="font-medium text-primary-foreground">Explore</p>
          <Link href="/residences" className="hover:underline">
            Residences
          </Link>
          <Link href="/amenities" className="hover:underline">
            Amenities
          </Link>
          <Link href="/contact" className="hover:underline">
            Contact
          </Link>
          <Link href="/login" className="hover:underline">
            Staff / Parent sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}
