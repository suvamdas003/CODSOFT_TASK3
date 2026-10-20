import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePageUser } from "@/server/auth/session";

const NAV = [
  { href: "/recruiter", label: "Overview", exact: true },
  { href: "/recruiter/jobs", label: "Jobs" },
  { href: "/recruiter/applicants", label: "Applicants" },
  { href: "/recruiter/interviews", label: "Interviews" },
  { href: "/recruiter/company", label: "Company profile" },
];

export default async function RecruiterLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["RECRUITER"], "/recruiter");
  return (
    <DashboardShell title="Recruiter" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
