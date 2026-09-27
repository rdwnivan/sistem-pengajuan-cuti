import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SWRegister } from "@/components/SWRegister";

export const metadata: Metadata = {
  title: "Sistem Pengajuan Cuti - Anime Japan",
  description: "Sistem Pengajuan Cuti Online Anime Regional Japan",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">
        <SWRegister />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
