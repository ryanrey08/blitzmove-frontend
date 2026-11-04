"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, MoreVertical, Pencil, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BackLink, DetailPageState } from "@/components/ui/detail-page";
import { Dropdown } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/states";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import { formatDateTime } from "@/lib/utils";
import { DetailRow } from "../orders/order-detail";
import { ROLES_PATH, USERS_PATH, USER_STATUS, usersService } from "./api";
import { UserActionDialogs, userMenuItems, type UserAction } from "./user-actions";

export function UserDetail({ id }: { id: number }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { can, isSuperAdmin } = usePermissions();
  const [action, setAction] = useState<UserAction | null>(null);
  const query = useQuery({ queryKey: ["admin-user", id], queryFn: () => usersService.get(id) });
  const user = query.data?.data;

  if (!user) return <DetailPageState loading={query.isLoading} error={query.error} onRetry={() => query.refetch()} backHref={USERS_PATH} backLabel="Back to users" noun="user" />;

  const locked = user.role?.slug === "super-admin" && !isSuperAdmin;
  const menu = locked ? [] : userMenuItems({ user, self: user.id === me.id, can, onAction: setAction });
  const modules = query.data?.permissions ?? [];
  const permissionCount = modules.reduce((n, m) => n + m.permissions.length, 0);

  return (
    <>
      <BackLink href={USERS_PATH}>Back to users</BackLink>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{user.name}</h1>
              <StatusBadge status={user.status} map={USER_STATUS} />
              {user.is_sample && <Badge tone="violet">Sample account</Badge>}
            </div>
            <p className="mt-1 text-ink-500">
              @{user.username} · {user.email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("users.update") && !locked && (
            <Button onClick={() => router.push(`${USERS_PATH}/${user.id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit User
            </Button>
          )}
          {menu.length > 0 && (
            <Dropdown
              trigger={({ toggle }) => (
                <Button variant="secondary" onClick={toggle} aria-label="More actions">
                  <MoreVertical className="h-4 w-4" /> More
                </Button>
              )}
              items={menu}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Personal Information" icon={<UserRound />} />
          <CardBody>
            <dl>
              <DetailRow label="First name">{user.first_name}</DetailRow>
              <DetailRow label="Middle name">{user.middle_name}</DetailRow>
              <DetailRow label="Last name">{user.last_name}</DetailRow>
              <DetailRow label="Username">{user.username}</DetailRow>
              <DetailRow label="Email">{user.email}</DetailRow>
              <DetailRow label="Mobile number">{user.phone}</DetailRow>
              <DetailRow label="Job title">{user.job_title}</DetailRow>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Account" icon={<ClipboardList />} />
          <CardBody>
            <dl>
              <DetailRow label="User ID">#{user.id}</DetailRow>
              <DetailRow label="Role">
                {user.role ? (
                  can("roles.view") ? (
                    <Link href={`${ROLES_PATH}/${user.role.id}`} className="font-medium text-brand-600 hover:underline">
                      {user.role.name}
                    </Link>
                  ) : (
                    user.role.name
                  )
                ) : (
                  "No role"
                )}
                {user.role && !user.role.is_active && <span className="ml-2 text-xs text-amber-600">(role inactive: no permissions)</span>}
              </DetailRow>
              <DetailRow label="Status">
                <StatusBadge status={user.status} map={USER_STATUS} />
              </DetailRow>
              {user.driver !== undefined && <DetailRow label="Driver profile">{user.driver ? `${user.driver.full_name} · ${user.driver.employee_code}` : null}</DetailRow>}
              <DetailRow label="Created">{formatDateTime(user.created_at)}</DetailRow>
              <DetailRow label="Last updated">{formatDateTime(user.updated_at)}</DetailRow>
              <DetailRow label="Last login">{user.last_login_at ? formatDateTime(user.last_login_at) : "Never"}</DetailRow>
            </dl>
          </CardBody>
        </Card>
        <Card className="lg:row-span-2">
          <CardHeader title="Permissions" icon={<ShieldCheck />} description={`${permissionCount} inherited from ${user.role?.name ?? "no role"}`} />
          <CardBody className="space-y-4">
            {modules.length === 0 ? (
              <EmptyState title="No permissions" description="This user's role grants no access yet." />
            ) : (
              modules.map((m) => (
                <div key={m.module}>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">{m.label}</p>
                  <ul className="space-y-1">
                    {m.permissions.map((p) => (
                      <li key={p.slug} className="flex items-start gap-2 text-sm text-ink-800" title={p.slug}>
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                        {p.description ?? p.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <UserActionDialogs user={user} action={action} onClose={() => setAction(null)} onDeleted={() => router.push(USERS_PATH)} />
    </>
  );
}
