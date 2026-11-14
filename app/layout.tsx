import type { Metadata, Viewport } from "next";
import { PWARegister } from "@/components/PWARegister";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pushkar Suraksha | Family Safety",
  description: "Family safety and member identification for Pushkaram in Andhra Pradesh.",
  applicationName: "Pushkar Suraksha",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Pushkar Suraksha", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7A1C1C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <PWARegister />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
