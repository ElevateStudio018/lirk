import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lirk – plugga smartare inför provet", template: "%s · Lirk" },
  description: "AI-driven studieplattform: från lärarens underlag till en personlig plan, lektioner och övningsprov.",
  appleWebApp: { capable: true, title: "Lirk", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
