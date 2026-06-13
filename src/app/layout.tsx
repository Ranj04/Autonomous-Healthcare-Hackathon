import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import HowItWorks from "@/components/HowItWorks";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Paperwork Advocate",
  description:
    "Voice-first advocate for the paperwork the healthcare system buries patients in.",
};

// viewport-fit=cover lets env(safe-area-inset-*) take effect on notched phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${plexMono.variable} h-full antialiased`}
    >
      {/* overflow-x-clip backstops the off-canvas How-it-works panel/tab so it
          can't create a sideways scroll on mobile (desktop has no h-scroll). */}
      <body
        className="flex min-h-full flex-col overflow-x-clip"
        suppressHydrationWarning
      >
        {children}
        <HowItWorks />
      </body>
    </html>
  );
}
