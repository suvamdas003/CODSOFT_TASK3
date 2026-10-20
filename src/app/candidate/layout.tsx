import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requirePageUser } from "@/server/auth/session";

const NAV = [
  { href: "/candidate", label: "Overview", exact: true },
  { href: "/candidate/applications", label: "Applications" },
  { href: "/candidate/saved", label: "Saved jobs" },
  { href: "/candidate/resumes", label: "Resumes" },
  { href: "/candidate/profile", label: "Profile" },
  { href: "/jobs", label: "Find jobs" },
];

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser(["CANDIDATE"], "/candidate");
  return (
    <DashboardShell title="Candidate" nav={NAV}>
      {children}
    </DashboardShell>
  );
}
