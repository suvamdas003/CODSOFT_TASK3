import type { Metadata } from "next";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/display";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/filter-bar";
import { listAuditEvents } from "@/features/admin/service";
import { formatDateTime } from "@/lib/format";
import { enumParam, param, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Audit log" };

const ACTION_PREFIXES = ["user.", "company.", "job.", "report.", "settings."] as const;
const ENTITY_TYPES = ["User", "Company", "Job", "JobReport", "PlatformSettings"] as const;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requirePageUser(["ADMIN"], "/admin/audit");
  const sp = await searchParams;
  const filters = {
    action: enumParam(sp.action, ACTION_PREFIXES),
    entityType: enumParam(sp.entityType, ENTITY_TYPES),
    q: param(sp.q),
    page: parsePage(sp.page),
  };
  const result = await listAuditEvents(admin, filters);
  const { page: _p, ...params } = filters;
  void _p;

  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of significant account and administrative actions." />
      <FilterBar action="/admin/audit" resetHref="/admin/audit">
        <FilterSelect label="Action" name="action" defaultValue={filters.action} options={ACTION_PREFIXES.map((a) => ({ value: a, label: `${a}*` }))} />
        <FilterSelect label="Entity" name="entityType" defaultValue={filters.entityType} options={ENTITY_TYPES.map((e) => ({ value: e, label: e }))} />
        <FilterInput label="Actor" name="q" defaultValue={filters.q} placeholder="Name or email" />
      </FilterBar>
      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</td>
                  <td>
                    <p>{e.actor?.name ?? "System / deleted user"}</p>
                    <p className="text-xs text-slate-500">{e.actor?.email}</p>
                  </td>
                  <td>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{e.action}</code>
                  </td>
                  <td className="text-xs">
                    {e.entityType}
                    <p className="text-slate-500">{e.entityId}</p>
                  </td>
                  <td>
                    {e.metadata ? <pre className="max-w-md overflow-x-auto text-xs whitespace-pre-wrap text-slate-600">{JSON.stringify(e.metadata, null, 1)}</pre> : null}
                    {e.ipAddress ? <p className="text-xs text-slate-500">IP {e.ipAddress}</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No audit events match these filters" />
      )}
      <Pagination basePath="/admin/audit" page={result.page} pageSize={result.pageSize} total={result.total} params={params} />
    </>
  );
}
