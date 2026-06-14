import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import Topbar from "@/components/topbar.jsx";
import AutoRefresh from "@/components/hud/auto-refresh.jsx";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Mission Control · Project Tracker",
  description: "Live HUD view of every project's STATUS.md plus Claude session telemetry",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)} suppressHydrationWarning>
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <Topbar />
        <AutoRefresh />
        {children}
      </body>
    </html>
  );
}
