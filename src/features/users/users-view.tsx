"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, Eye, KeyRound, MoreVertical, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserRound, Users, UserX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ManagedUser } from "@/types/api";
import { USERS_PATH, USER_STATUS, usersService } from "./api";
import { UserActionDialogs, userMenuItems, type UserAction } from "./user-actions";

const ICONS: Record<string, ReactNode> = { Activate: <UserCheck />, Deactivate: <UserX />, Suspend: <Ban />, "Reset password": <KeyRound />, Delete: <Trash2 /> };

export function UsersView() {
  const router = useRouter();
  const me = useCurrentUser();
  const { can, isSuperAdmin } = usePermissions();
  const role = useSearchParams().get("role");
  const { params, update, setPage } = useListParams({ sort: "-created_at", status: "", role_id: role && /^\d+$/.test(role) ? role : "", created_from: "", created_to: "" });
  const [target, setTarget] = useState<{ user: ManagedUser; action: UserAction } | null>(null);

  const list = useQuery({ queryKey: ["admin-users", params], queryFn: () => usersService.list(params), placeholderData: keepPreviousData });
  const options = useQuery({ queryKey: ["admin-user-options"], queryFn: () => usersService.options().then((r) => r.data) });
  const counts = list.data?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Users"
        description="Manage who can sign in to BlitzMove, their role and account status."
        actions={
          can("users.create") && (
            <Button size="lg" onClick={() => router.push(`${USERS_PATH}/create`)}>
              <Plus className="h-5 w-5" /> Add User
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total Users" value={total} icon={Users} loading={list.isLoading} />
        <StatCard label="Active" value={counts.active ?? 0} icon={UserCheck} tone="green" loading={list.isLoading} />
        <StatCard label="Inactive" value={counts.inactive ?? 0} icon={UserX} tone="gray" loading={list.isLoading} />
        <StatCard label="Suspended" value={counts.suspended ?? 0} icon={Ban} tone="amber" loading={list.isLoading} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 p-4 lg:flex-row">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search name, username or email…" className="flex-1" />
          <Select
            value={params.role_id as string}
            onChange={(e) => update({ role_id: e.target.value })}
            options={(options.data?.roles ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
            placeholder="All roles"
            className="lg:w-48"
            aria-label="Filter by role"
          />
          <Select
            value={params.status as string}
            onChange={(e) => update({ status: e.target.value })}
            options={Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label }))}
            placeholder="All statuses"
            className="lg:w-40"
            aria-label="Filter by status"
          />
          <div className="lg:w-64">
            <DateRangeFilter from={params.created_from as string} to={params.created_to as string} onChange={(created_from, created_to) => update({ created_from, created_to })} emptyLabel="Any created date" />
          </div>
        </div>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(u) => u.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(u) => router.push(`${USERS_PATH}/${u.id}`)}
          empty={{ title: "No users found", description: "Adjust the search or filters." }}
          columns={[
            { key: "id", header: "ID", sortKey: "id", cell: (u) => <span className="text-ink-500">#{u.id}</span> },
            {
              key: "name",
              header: "Full Name",
              sortKey: "name",
              cell: (u) => (
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-ink-900">{u.name}</span>
                  {u.id === me.id && <Badge tone="blue">You</Badge>}
                  {u.is_sample && <Badge tone="violet">Sample</Badge>}
                </span>
              ),
            },
            { key: "username", header: "Username", sortKey: "username", cell: (u) => u.username ?? "—" },
            { key: "email", header: "Email Address", sortKey: "email", cell: (u) => u.email },
            { key: "phone", header: "Mobile Number", cell: (u) => u.phone ?? <span className="text-ink-400">—</span> },
            {
              key: "role",
              header: "Role",
              cell: (u) =>
                u.role ? (
                  <Badge tone={u.role.is_active ? "red" : "gray"}>
                    <ShieldCheck className="h-3 w-3" /> {u.role.name}
                  </Badge>
                ) : (
                  <span className="text-ink-400">No role</span>
                ),
            },
            { key: "title", header: "Job Title", cell: (u) => u.job_title ?? <span className="text-ink-400">—</span> },
            { key: "status", header: "Status", sortKey: "status", cell: (u) => <StatusBadge status={u.status} map={USER_STATUS} /> },
            { key: "login", header: "Last Login", sortKey: "last_login_at", cell: (u) => (u.last_login_at ? formatDateTime(u.last_login_at) : <span className="text-ink-400">Never</span>) },
            { key: "created", header: "Created", sortKey: "created_at", cell: (u) => formatDate(u.created_at) },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              className: "text-right",
              cell: (u) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={({ toggle }) => (
                      <button onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${u.name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                    items={[
                      { label: "View details", icon: <Eye />, onSelect: () => router.push(`${USERS_PATH}/${u.id}`) },
                      // Only a Super Admin can act on Super Admin accounts.
                      ...(u.role?.slug === "super-admin" && !isSuperAdmin ? [] : [
                      ...(can("users.update") ? [{ label: "Edit", icon: <Pencil />, onSelect: () => router.push(`${USERS_PATH}/${u.id}/edit`) }] : []),
                      ...userMenuItems({ user: u, self: u.id === me.id, can, onAction: (action) => setTarget({ user: u, action }) }).map((item) => ({
                        ...item,
                        icon: ICONS[item.label] ?? <UserRound />,
                      })),
                      ]),
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="users" />
      </Card>

      <UserActionDialogs user={target?.user ?? null} action={target?.action ?? null} onClose={() => setTarget(null)} />
    </>
  );
}
