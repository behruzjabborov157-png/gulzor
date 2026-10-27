import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { siteUrl } from "@/lib/settings";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});
const sans = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Gulzor — Toshkentda gul yetkazib berish va onlayn gul buyurtma qilish",
    template: "%s | Gulzor",
  },
  description:
    "Gulzor — onlayn gul do‘koni: guldastalar, atirgullar, lolalar, qutidagi gullar va sovg‘alar. Narxlar so‘mda, yetkazib berish sanasi va vaqtini o‘zingiz tanlaysiz.",
  applicationName: "Gulzor",
  openGraph: { type: "website", locale: "uz_UZ", siteName: "Gulzor" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2e4a3b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
