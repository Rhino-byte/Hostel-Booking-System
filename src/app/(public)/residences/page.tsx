import { ResidenceCompare } from "@/components/residence-compare";
import { PageHeader } from "@/components/patterns";
import { PageTransition, Reveal } from "@/components/motion";
import { prisma } from "@/lib/db";
import { siteContent } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Residences",
};

export default async function ResidencesPage() {
  const residences = await prisma.residenceType.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const count = residences.length;
  const description =
    count === 4
      ? "Every residence includes Wi-Fi, electricity, daily breakfast and dinner, weekend meals, laundry, and a peaceful study environment. Fees are per semester in Kenyan Shillings."
      : `Explore ${count} residence options. Every home includes Wi-Fi, electricity, daily breakfast and dinner, weekend meals, laundry, and a peaceful study environment. Fees are per semester in Kenyan Shillings.`;

  return (
    <PageTransition>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Reveal>
          <PageHeader
            eyebrow={siteContent.tagline}
            title="Find the right room"
            description={description}
          />
        </Reveal>
        <ResidenceCompare residences={residences} />
      </div>
    </PageTransition>
  );
}
