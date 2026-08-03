import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { WhatsAppFloat } from "@/components/public/whatsapp-float";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
      <WhatsAppFloat />
    </div>
  );
}
