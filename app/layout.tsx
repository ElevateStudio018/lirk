import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kleo — Den anställde du inte har råd att anställa",
  description:
    "Kleo är ett team av digitala medarbetare som sköter sälj, fakturor, kundservice, marknadsföring och HR åt dig. Anställ på tre minuter. Du har alltid sista ordet.",
  openGraph: {
    title: "Kleo — Den anställde du inte har råd att anställa",
    description: "Det digitala teamet för svenska småföretagare.",
    locale: "sv_SE",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f8f8f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv" className={inter.variable} data-theme="light">
      <head>
        {/* Switzer — the display face on the current Kleo site (Fontshare, free licence). */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
