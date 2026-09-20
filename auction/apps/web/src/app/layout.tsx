import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Self-hosted by next/font: no render-blocking request, no layout shift.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono-geist", display: "swap" });
const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "HowzTheBid — live cricket auctions",
  description: "Run a cricket auction that feels like an event. Rooms, captains, live bidding, and a final table worth framing.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "HowzTheBid" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0b0a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${display.variable}`}>
      <body className="grain antialiased">{children}</body>
    </html>
  );
}
