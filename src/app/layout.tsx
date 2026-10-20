import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { getPlatformSettings } from "@/server/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CareerHub — Find your next role", template: "%s · CareerHub" },
  description: "CareerHub connects candidates with recruiters: search jobs, apply, and manage hiring pipelines.",
};

export const viewport: Viewport = { themeColor: "#2554e8" };

async function Announcement() {
  // A database outage must not take down every page; the banner is optional.
  const settings = await getPlatformSettings().catch(() => null);
  if (!settings?.announcement) return null;
  return (
    <div className="bg-brand-700 px-4 py-2 text-center text-sm text-white" role="status">
      {settings.announcement}
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Announcement />
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-6">
            <p>© {new Date().getFullYear()} CareerHub. Demo recruitment platform.</p>
            <nav aria-label="Footer" className="flex gap-4">
              <Link href="/jobs" className="text-slate-500">
                Browse jobs
              </Link>
              <Link href="/register" className="text-slate-500">
                Post a job
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
