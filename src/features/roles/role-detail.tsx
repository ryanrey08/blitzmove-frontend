"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound, Lock, Pencil, ShieldCheck, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { BackLink, DetailPageState } from "@/components/ui/detail-page";
import { LoadingState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-current-user";
import { formatDate, formatDateTime } from "@/lib/utils";
import { DetailRow } from "../orders/order-detail";
import { ROLES_PATH, USERS_PATH, USER_STATUS, rolesService } from "../users/api";
import { PermissionSummary } from "./permission-matrix";
import { DeleteRoleDialog } from "./role-dialogs";

export function RoleDetail({ id }: { id: number }) {
  const router = useRouter();
  const { can, isSuperAdmin } = usePermissions();
  const [deleting, setDeleting] = useState(false);
  const query = useQuery({ queryKey: ["admin-role", id], queryFn: () => rolesService.get(id) });
  const modules = useQuery({ queryKey: ["admin-permissions"], queryFn: () => rolesService.permissions().then((r) => r.data), staleTime: 5 * 60_000 });
  const role = query.data?.data;

  if (!role) return <DetailPageState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} backHref={ROLES_PATH} backLabel="Back to roles" noun="role" />;
  const editable = !role.is_super_admin || isSuperAdmin;
  const users = query.data?.users ?? [];

  return (
    <>
      <BackLink href={ROLES_PATH}>Back to roles</BackLink>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{role.name}</h1>
            <Badge tone={role.is_active ? "green" : "gray"} dot>
              {role.is_active ? "Active" : "Inactive"}
            </Badge>
            {role.is_system && (
              <Badge tone="indigo">
                <Lock className="h-3 w-3" /> System role
              </Badge>
            )}
          </div>
          <p className="mt-1 max-w-2xl text-ink-500">{role.description ?? "No description."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!role.is_system && can("roles.delete") && (
            <Button variant="secondary" onClick={() => setDeleting(true)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          {editable && can(["roles.update", "roles.assign_permissions"]) && (
            <Button onClick={() => router.push(`${ROLES_PATH}/${role.id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit Role
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Role Information" icon={<ShieldCheck />} />
          <CardBody>
            <dl>
              <DetailRow label="Role ID">#{role.id}</DetailRow>
              <DetailRow label="Identifier">
                <code className="rounded bg-ink-50 px-1.5 py-0.5 text-xs">{role.slug}</code>
              </DetailRow>
              <DetailRow label="Assigned users">{role.users_count ?? 0}</DetailRow>
              <DetailRow label="Permissions">{role.permissions_count ?? 0}</DetailRow>
              <DetailRow label="Created">{formatDateTime(role.created_at)}</DetailRow>
              <DetailRow label="Last updated">{formatDateTime(role.updated_at)}</DetailRow>
            </dl>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={`Assigned Users (${role.users_count ?? 0})`} icon={<Users />} description={users.length < (role.users_count ?? 0) ? `Showing the first ${users.length}.` : undefined} />
          <DataTable
            rows={users}
            rowKey={(u) => u.id}
            onRowClick={can("users.view") ? (u) => router.push(`${USERS_PATH}/${u.id}`) : undefined}
            empty={{ title: "No users have this role" }}
            columns={[
              { key: "name", header: "Name", cell: (u) => <span className="font-medium text-ink-900">{u.name}</span> },
              { key: "email", header: "Email", cell: (u) => u.email },
              { key: "status", header: "Status", cell: (u) => <StatusBadge status={u.status} map={USER_STATUS} /> },
              { key: "login", header: "Last Login", cell: (u) => (u.last_login_at ? formatDate(u.last_login_at) : "Never") },
            ]}
          />
        </Card>
      </div>

      <Card>
        <CardHeader title="Permissions" icon={<KeyRound />} description={role.is_super_admin ? "Super Admin always has every permission." : undefined} />
        {modules.data ? <PermissionSummary modules={modules.data} selected={new Set(role.permissions ?? [])} /> : <LoadingState />}
      </Card>

      <DeleteRoleDialog role={deleting ? role : null} onClose={() => setDeleting(false)} onDeleted={() => router.push(ROLES_PATH)} />
    </>
  );
}
