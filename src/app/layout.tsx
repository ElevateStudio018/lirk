import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700", "800"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lirk – plugga smartare inför provet", template: "%s · Lirk" },
  description: "AI-driven studieplattform: från lärarens underlag till en personlig plan, lektioner och övningsprov.",
  appleWebApp: { capable: true, title: "Lirk", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#000000" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" className={poppins.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
