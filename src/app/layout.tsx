import type { Metadata } from "next";
import { Lora, Source_Sans_3 } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const serif = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "St. Clare's Girls Hostel",
    template: "%s · St. Clare's Girls Hostel",
  },
  description:
    "Four Residences. One Family. Peaceful, supportive and faith-filled hostel living with booking and payment tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} min-h-screen antialiased`}>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}
