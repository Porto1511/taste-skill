import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";

export const metadata: Metadata = {
  title: { default: "MSW Site", template: "%s · MSW Site" },
  description: "Drawings, RAMS and site reporting for MSW UK Ltd.",
  applicationName: "MSW Site",
  appleWebApp: { capable: true, title: "MSW Site", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-[100dvh] antialiased">{children}<ServiceWorkerRegister /></body>
    </html>
  );
}
