import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import Topbar from "@/components/topbar.jsx";
import AutoRefresh from "@/components/hud/auto-refresh.jsx";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Command Central",
  description: "Live HUD view of every project's STATUS.md plus Claude session telemetry",
  applicationName: "Command Central",
  appleWebApp: {
    capable: true,
    title: "Command Central",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

// Without this, mobile browsers render the page at desktop width and zoom out —
// the single biggest reason the HUD felt unusable on a phone.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
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
