"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Eye, KeyRound, Lock, MoreVertical, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/types/api";
import { ROLES_PATH, USERS_PATH, rolesService } from "../users/api";
import { DeleteRoleDialog } from "./role-dialogs";

export function RolesView() {
  const router = useRouter();
  const { can, isSuperAdmin } = usePermissions();
  const { params, update, setPage } = useListParams({ sort: "id", status: "", per_page: 25 });
  const [deleting, setDeleting] = useState<Role | null>(null);
  const list = useQuery({ queryKey: ["admin-roles", params], queryFn: () => rolesService.list(params), placeholderData: keepPreviousData });
  const editable = (r: Role) => !r.is_super_admin || isSuperAdmin;

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Roles decide which modules a user can open and what they can do there."
        actions={
          can("roles.create") && (
            <Button size="lg" onClick={() => router.push(`${ROLES_PATH}/create`)}>
              <Plus className="h-5 w-5" /> Add Role
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-col gap-3 p-4 md:flex-row">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search roles…" className="flex-1" />
          <Select
            value={params.status as string}
            onChange={(e) => update({ status: e.target.value })}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            placeholder="All statuses"
            className="md:w-44"
            aria-label="Filter by status"
          />
        </div>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(r) => r.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(r) => router.push(`${ROLES_PATH}/${r.id}`)}
          empty={{ title: "No roles found", description: "Adjust the search or add a role." }}
          columns={[
            { key: "id", header: "ID", sortKey: "id", cell: (r) => <span className="text-ink-500">#{r.id}</span> },
            {
              key: "name",
              header: "Role Name",
              sortKey: "name",
              cell: (r) => (
                <span>
                  <span className="flex items-center gap-2 font-semibold text-ink-900">
                    {r.name}
                    {r.is_system && (
                      <Badge tone="indigo">
                        <Lock className="h-3 w-3" /> System
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-ink-500">{r.slug}</span>
                </span>
              ),
            },
            { key: "description", header: "Description", className: "max-w-sm", cell: (r) => <span className="line-clamp-2 text-ink-600">{r.description ?? "—"}</span> },
            { key: "users", header: "Users", sortKey: "users_count", cell: (r) => r.users_count ?? 0 },
            { key: "permissions", header: "Permissions", sortKey: "permissions_count", cell: (r) => (r.is_super_admin ? <Badge tone="green">All ({r.permissions_count})</Badge> : (r.permissions_count ?? 0)) },
            { key: "status", header: "Status", cell: (r) => <Badge tone={r.is_active ? "green" : "gray"} dot>{r.is_active ? "Active" : "Inactive"}</Badge> },
            { key: "created", header: "Created", sortKey: "created_at", cell: (r) => formatDate(r.created_at) },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              className: "text-right",
              cell: (r) => (
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={({ toggle }) => (
                      <button onClick={toggle} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Actions for ${r.name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                    items={[
                      { label: "View details", icon: <Eye />, onSelect: () => router.push(`${ROLES_PATH}/${r.id}`) },
                      ...(editable(r) && can("roles.update") ? [{ label: "Edit role", icon: <Pencil />, onSelect: () => router.push(`${ROLES_PATH}/${r.id}/edit`) }] : []),
                      ...(editable(r) && !r.is_super_admin && can("roles.assign_permissions")
                        ? [{ label: "Manage permissions", icon: <KeyRound />, onSelect: () => router.push(`${ROLES_PATH}/${r.id}/edit#permissions`) }]
                        : []),
                      ...(can("users.view") ? [{ label: "View assigned users", icon: <Users />, onSelect: () => router.push(`${USERS_PATH}?role=${r.id}`) }] : []),
                      ...(!r.is_system && can("roles.delete") ? [{ label: "Delete role", icon: <Trash2 />, danger: true, onSelect: () => setDeleting(r) }] : []),
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="roles" />
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-500">
        <ShieldCheck className="h-3.5 w-3.5" /> System roles can be edited but not deleted. Super Admin always has every permission.
      </p>
      <DeleteRoleDialog role={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
