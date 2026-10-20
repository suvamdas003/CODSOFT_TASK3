import Link from "next/link";
import { logoutAction } from "@/features/auth/actions";
import { label } from "@/lib/format";
import { getCurrentUser, homePathFor } from "@/server/auth/session";
import { countUnreadNotifications } from "@/server/notifications";
import { buttonClass } from "@/components/ui/button";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-slate-900 no-underline">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white" aria-hidden>
        CH
      </span>
      <span className="text-lg font-semibold tracking-tight">CareerHub</span>
    </Link>
  );
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const unread = user ? await countUnreadNotifications(user) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            <Link href="/jobs" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-100">
              Find jobs
            </Link>
            {user ? (
              <Link href={homePathFor(user.role)} className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-100">
                Dashboard
              </Link>
            ) : null}
          </nav>
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/notifications"
              className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
              aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unread ? (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-2 pl-1 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800" aria-hidden>
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-sm font-medium text-slate-700 md:inline">{user.name}</span>
                <span className="sr-only">Open account menu</span>
              </summary>
              <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="border-b border-slate-100 px-3 pt-1 pb-2">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{label(user.role)}</p>
                </div>
                <Link href={homePathFor(user.role)} className="block rounded-md px-3 py-2 text-sm text-slate-700 no-underline hover:bg-slate-100">
                  Dashboard
                </Link>
                <Link href="/jobs" className="block rounded-md px-3 py-2 text-sm text-slate-700 no-underline hover:bg-slate-100 sm:hidden">
                  Find jobs
                </Link>
                <Link href="/account" className="block rounded-md px-3 py-2 text-sm text-slate-700 no-underline hover:bg-slate-100">
                  Account settings
                </Link>
                <form action={logoutAction}>
                  <button type="submit" className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/jobs" className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-100 sm:hidden">
              Jobs
            </Link>
            <Link href="/login" className={buttonClass("ghost", "md")}>
              Sign in
            </Link>
            <Link href="/register" className={buttonClass("primary", "md")}>
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
