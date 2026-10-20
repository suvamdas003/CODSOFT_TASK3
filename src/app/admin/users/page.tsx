import type { Metadata } from "next";
import { ActionButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader, Pagination, StatusBadge } from "@/components/ui/display";
import { FilterBar, FilterInput, FilterSelect } from "@/components/ui/filter-bar";
import { setUserStatusAction } from "@/features/admin/actions";
import { SuspendUserForm } from "@/features/admin/components/admin-forms";
import { listUsers } from "@/features/admin/service";
import { formatDate, formatRelative, label, optionsFor, ROLES } from "@/lib/format";
import { enumParam, param, parsePage, type SearchParams } from "@/lib/utils";
import { requirePageUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await requirePageUser(["ADMIN"], "/admin/users");
  const sp = await searchParams;
  const filters = {
    q: param(sp.q),
    role: enumParam(sp.role, ROLES),
    status: enumParam(sp.status, ["ACTIVE", "SUSPENDED"] as const),
    page: parsePage(sp.page),
  };
  const result = await listUsers(admin, filters);
  const { page: _p, ...params } = filters;
  void _p;

  return (
    <>
      <PageHeader title="Users" description="Search accounts and suspend or reactivate access. Every change is audited." />
      <FilterBar action="/admin/users" resetHref="/admin/users">
        <FilterInput label="Search" name="q" defaultValue={filters.q} placeholder="Name or email" />
        <FilterSelect label="Role" name="role" defaultValue={filters.role} options={optionsFor(ROLES)} />
        <FilterSelect label="Status" name="status" defaultValue={filters.status} options={optionsFor(["ACTIVE", "SUSPENDED"])} />
      </FilterBar>
      {result.items.length ? (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last sign-in</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                    {u.recruiterProfile ? <p className="text-xs text-slate-500">{u.recruiterProfile.company.name}</p> : null}
                  </td>
                  <td>{label(u.role)}</td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                  <td className="whitespace-nowrap">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}</td>
                  <td className="text-right">
                    {u.id === admin.id ? (
                      <span className="text-xs text-slate-500">You</span>
                    ) : u.status === "ACTIVE" ? (
                      <SuspendUserForm userId={u.id} name={u.name} />
                    ) : (
                      <ActionButton action={setUserStatusAction} fields={{ userId: u.id, status: "ACTIVE" }} variant="success">
                        Reactivate
                      </ActionButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No users match these filters" />
      )}
      <Pagination basePath="/admin/users" page={result.page} pageSize={result.pageSize} total={result.total} params={params} />
    </>
  );
}
