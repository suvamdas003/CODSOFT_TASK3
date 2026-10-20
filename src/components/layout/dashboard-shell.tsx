"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; exact?: boolean };

/** Dashboard layout with a sidebar on desktop and a scrollable tab bar on mobile. */
export function DashboardShell({ title, nav, children }: { title: string; nav: NavItem[]; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:py-8">
      <aside className="lg:w-56 lg:shrink-0">
        <p className="mb-2 hidden px-3 text-xs font-semibold tracking-wide text-slate-500 uppercase lg:block">{title}</p>
        <nav aria-label={`${title} navigation`} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item) ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap no-underline",
                    isActive(item) ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
