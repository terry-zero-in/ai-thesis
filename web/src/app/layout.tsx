import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalShell } from "@/components/shell/ConditionalShell";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getUnseenAlertCount } from "@/lib/alerts-data";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// JetBrains Mono — the Basis design-system monospace companion for every
// number, eyebrow, hex, keycap, and pill. Bound to --font-jetbrains-mono,
// which globals.css points --m at.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AI Thesis",
  description: "Multi-factor AI investing scoring engine + portfolio dashboard",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Resolve user once at layout level so chrome (TopBar email + logout)
  // doesn't need to round-trip to Supabase per client component. Bare-page
  // routes (/login etc.) ignore this.
  const sb = await getSupabaseServer();
  const { data } = sb ? await sb.auth.getUser() : { data: { user: null } };
  const userEmail = data?.user?.email ?? null;
  const unseenAlerts = await getUnseenAlertCount();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ConditionalShell userEmail={userEmail} unseenAlerts={unseenAlerts}>
          {children}
        </ConditionalShell>
      </body>
    </html>
  );
}
