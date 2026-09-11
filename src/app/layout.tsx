import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meteor Monitoring · NEO Impact Dashboard",
  description:
    "Live NASA/JPL Sentry impact risks, close approaches, fireballs, and SBDB orbits",
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#05080f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg">☄️</span>
              <span className="font-semibold tracking-tight text-slate-100">
                Meteor Monitoring
              </span>
              <span className="hidden rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] font-medium uppercase text-cyan-300 sm:inline">
                MVP
              </span>
            </Link>
            <p className="text-[11px] text-slate-500">
              Zoom Earth → solar system
            </p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-3 py-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4 sm:py-4">
          {children}
        </main>
        <footer className="mx-auto max-w-6xl border-t border-slate-800/60 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-[11px] text-slate-500">
          Impact % = Sentry <code className="text-slate-400">ip × 100</code>.
          Education / monitoring only.{" "}
          <a
            className="text-cyan-400 hover:underline"
            href="https://ssd-api.jpl.nasa.gov/"
            target="_blank"
            rel="noreferrer noopener"
          >
            NASA/JPL SSD APIs
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
