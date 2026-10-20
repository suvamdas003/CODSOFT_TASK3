import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePageUser } from "@/server/auth/session";

const NAV = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/companies", label: "Recruiters & companies" },
  { href: "/admin/jobs", label: "Job moderation" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["ADMIN"], "/admin");
  return (
    <DashboardShell title="Administration" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
