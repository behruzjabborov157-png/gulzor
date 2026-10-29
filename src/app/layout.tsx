import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa";
import { getDict } from "@/i18n/dict";
import { getLocale } from "@/i18n/server";
import { siteUrl } from "@/lib/settings";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const sans = Manrope({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-manrope", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDict(locale).meta;
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.siteTitle, template: "%s | Gulzor" },
    description: t.siteDescription,
    applicationName: "Gulzor",
    openGraph: { type: "website", locale: t.ogLocale, siteName: "Gulzor" },
    formatDetection: { telephone: false },
    appleWebApp: { capable: true, title: "Gulzor", statusBarStyle: "default" },
    icons: { apple: "/icons/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#7a1732",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={await getLocale()} className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
