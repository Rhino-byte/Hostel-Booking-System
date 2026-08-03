"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/patterns";
import { PageTransition, Reveal } from "@/components/motion";
import { siteContent } from "@/lib/site-content";

export default function ContactPage() {
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          phone: form.get("phone"),
          email: form.get("email"),
          message: form.get("message"),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Message sent — the hostel office will be in touch.");
      e.currentTarget.reset();
    } catch {
      toast.error("Could not send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal>
          <PageHeader
            eyebrow="Contact"
            title="We'd love to hear from you"
            description="Enquire about residences, admissions timing, or payment guidance. Parents can also sign in to view a student's hostel balance."
          />
        </Reveal>

        <div className="grid gap-10 lg:grid-cols-2">
          <Reveal className="space-y-8">
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Phone</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {siteContent.phones.map((p) => (
                      <a
                        key={p.href}
                        href={p.href}
                        className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        {p.display}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <a
                    href={`mailto:${siteContent.email}`}
                    className="mt-1 block text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    {siteContent.email}
                  </a>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Location</p>
                  <p className="mt-1 text-muted-foreground">
                    {siteContent.landmark}
                  </p>
                  <a
                    href={siteContent.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-primary underline-offset-2 hover:underline"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>
              <p>
                <span className="font-medium">Office hours:</span>{" "}
                {siteContent.officeHours}
              </p>
              <p>
                <span className="font-medium">Payments:</span>{" "}
                {siteContent.paymentsNote}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border shadow-soft">
              <iframe
                title="St. Clare's Girls Hostels on Google Maps"
                src={siteContent.mapsEmbedSrc}
                className="h-[280px] w-full border-0 sm:h-[320px]"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <h2 className="font-serif text-xl font-semibold text-primary">
                Send an enquiry
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We typically respond within one working day.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="+254…"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={4}
                    className="flex w-full rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? "Sending…" : "Send message"}
                </Button>
              </form>
            </div>
          </Reveal>
        </div>
      </div>
    </PageTransition>
  );
}
