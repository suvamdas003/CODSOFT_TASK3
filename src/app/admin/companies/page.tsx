import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-form";
import { Badge, EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/filter-bar";
import { setCompanyVerifiedAction } from "@/features/admin/actions";
import { listCompanies } from "@/features/admin/service";
import { formatDate } from "@/lib/format";
import { param, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Recruiters & companies" };

export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requirePageUser(["ADMIN"], "/admin/companies");
  const sp = await searchParams;
  const verifiedParam = param(sp.verified);
  const filters = {
    q: param(sp.q),
    verified: verifiedParam === "true" ? true : verifiedParam === "false" ? false : undefined,
    page: parsePage(sp.page),
  };
  const result = await listCompanies(admin, filters);

  return (
    <>
      <PageHeader title="Recruiters & companies" description="Verify employers and review the recruiters attached to them. Manage recruiter accounts from Users." />
      <FilterBar action="/admin/companies" resetHref="/admin/companies">
        <FilterInput label="Company" name="q" defaultValue={filters.q} />
        <FilterSelect
          label="Verification"
          name="verified"
          defaultValue={verifiedParam}
          options={[
            { value: "true", label: "Verified" },
            { value: "false", label: "Not verified" },
          ]}
        />
      </FilterBar>
      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Company</th>
                <th>Recruiters</th>
                <th className="text-right">Jobs</th>
                <th>Created</th>
                <th className="text-right">Verification</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/companies/${c.slug}`} className="font-medium">
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500">{[c.industry, c.location].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td>
                    <ul className="space-y-1">
                      {c.recruiters.map(({ user }) => (
                        <li key={user.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-medium text-slate-800">{user.name}</span>
                          <span className="text-slate-500">{user.email}</span>
                          {user.status !== "ACTIVE" ? <StatusBadge status={user.status} /> : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="text-right tabular-nums">{c._count.jobs}</td>
                  <td className="whitespace-nowrap">{formatDate(c.createdAt)}</td>
                  <td className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {c.verified ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Unverified</Badge>}
                      <ActionButton action={setCompanyVerifiedAction} fields={{ companyId: c.id, verified: c.verified ? "false" : "true" }} variant={c.verified ? "ghost" : "success"}>
                        {c.verified ? "Unverify" : "Verify"}
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No companies found" />
      )}
      <Pagination basePath="/admin/companies" page={result.page} pageSize={result.pageSize} total={result.total} params={{ q: filters.q, verified: verifiedParam }} />
    </>
  );
}
