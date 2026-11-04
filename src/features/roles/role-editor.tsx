"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, KeyRound, Save, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import { ApiError } from "@/services/api-client";
import type { PermissionModule, Role } from "@/types/api";
import { ROLES_PATH, USER_KEYS, rolesService } from "../users/api";
import { PermissionMatrix } from "./permission-matrix";

const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** `/user-management/roles/create` and `/user-management/roles/[id]/edit`. */
export function RoleEditor({ roleId }: { roleId?: number }) {
  const role = useQuery({ queryKey: ["admin-role", roleId], queryFn: () => rolesService.get(roleId!), enabled: !!roleId });
  const modules = useQuery({ queryKey: ["admin-permissions"], queryFn: () => rolesService.permissions().then((r) => r.data), staleTime: 5 * 60_000 });

  if ((roleId && role.isLoading) || modules.isLoading) return <LoadingState label="Loading role…" />;
  if (role.error || modules.error || !modules.data || (roleId && !role.data)) {
    return <ErrorState message={(role.error ?? modules.error)?.message ?? "Role not found."} onRetry={() => (role.error ? role.refetch() : modules.refetch())} />;
  }
  const data = role.data?.data;
  return <RoleForm key={data?.id ?? "new"} role={data} modules={modules.data} />;
}

function RoleForm({ role, modules }: { role?: Role; modules: PermissionModule[] }) {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const { can, isSuperAdmin, permissions: mine } = usePermissions();
  const editing = !!role;

  const [name, setName] = useState(role?.name ?? "");
  const [slug, setSlug] = useState(role?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(editing);
  const [description, setDescription] = useState(role?.description ?? "");
  const [active, setActive] = useState(role?.is_active ?? true);
  const original = useMemo(() => new Set(role?.permissions ?? []), [role]);
  const [selected, setSelected] = useState<Set<string>>(original);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#permissions") document.getElementById("permissions")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const ownRole = editing && me.role?.id === role.id && !isSuperAdmin;
  const canEditPermissions = can("roles.assign_permissions") && !role?.is_super_admin && !ownRole;
  const canEditDetails = editing ? can("roles.update") : can("roles.create");
  const mineSet = useMemo(() => new Set(mine), [mine]);
  const added = [...selected].filter((s) => !original.has(s));
  const removed = [...original].filter((s) => !selected.has(s));
  const permissionsChanged = added.length + removed.length > 0;

  if (editing && role.is_super_admin && !isSuperAdmin) return <ErrorState message="Only a Super Admin can change the Super Admin role." />;

  const validate = () => {
    const next: Record<string, string> = {};
    if (name.trim().length < 3) next.name = "Role name must be at least 3 characters.";
    if (!slugify(slug || name)) next.slug = "Enter an identifier.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const persist = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const details = { name: name.trim(), slug: slugify(slug || name), description: description.trim() || null, is_active: active };
      let saved: Role;
      if (editing) {
        saved = canEditDetails ? (await rolesService.update(role.id, details)).data : role;
        if (canEditPermissions && permissionsChanged) saved = (await rolesService.savePermissions(role.id, [...selected])).data;
      } else {
        saved = (await rolesService.create({ ...details, ...(canEditPermissions ? { permissions: [...selected] } : {}) })).data;
      }
      USER_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      notify(editing ? `Role ${saved.name} saved.` : `Role ${saved.name} created.`);
      router.push(`${ROLES_PATH}/${saved.id}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([k, v]) => [k.split(".")[0], v[0]])));
        setFormError(error.status === 422 ? (error.errors.permissions?.[0] ?? error.errors.is_active?.[0] ?? null) : error.message);
      } else setFormError("Something went wrong.");
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return setFormError("Some details are missing or invalid. Check the highlighted fields.");
    if (editing && permissionsChanged) return setConfirming(true);
    void persist();
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{editing ? `Edit ${role.name}` : "Add Role"}</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">
            {editing ? `${role.users_count ?? 0} user${role.users_count === 1 ? "" : "s"} currently have this role.` : "Define a role and choose what it can access."}
          </p>
        </div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-500">
          <span>User Management</span>
          <ChevronRight className="h-4 w-4" />
          <Link href={ROLES_PATH} className="hover:text-ink-900">
            Roles &amp; Permissions
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-ink-900">{editing ? "Edit Role" : "Add Role"}</span>
        </nav>
      </div>

      {formError && (
        <div className="mb-5">
          <FormError message={formError} />
        </div>
      )}

      <Card className="mb-5">
        <CardHeader title="Role Details" icon={<ShieldCheck />} />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label="Role Name" htmlFor="role-name" required error={errors.name}>
            <Input
              id="role-name"
              value={name}
              disabled={!canEditDetails}
              invalid={!!errors.name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Field>
          <Field label="Identifier (slug)" htmlFor="role-slug" required error={errors.slug} hint={role?.is_system ? "System role identifiers cannot change." : "Lowercase, used by the system. Must be unique."}>
            <Input
              id="role-slug"
              value={slug}
              disabled={!canEditDetails || role?.is_system}
              invalid={!!errors.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </Field>
          <Field label="Description" htmlFor="role-description" error={errors.description} className="md:col-span-2">
            <Textarea id="role-description" value={description} disabled={!canEditDetails} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <div className="md:col-span-2">
            <Checkbox
              label={
                <span>
                  Active <span className="text-ink-500">— users with an inactive role keep their account but get no permissions.</span>
                </span>
              }
              checked={active}
              disabled={!canEditDetails || role?.is_super_admin || ownRole}
              onChange={(e) => setActive(e.target.checked)}
            />
            {errors.is_active && <p className="mt-1 text-xs font-medium text-brand-700">{errors.is_active}</p>}
          </div>
        </CardBody>
      </Card>

      <Card id="permissions">
        <CardHeader
          title="Permissions"
          icon={<KeyRound />}
          description={
            role?.is_super_admin
              ? "Super Admin always has every permission."
              : ownRole
                ? "You cannot change the permissions of your own role."
                : !can("roles.assign_permissions")
                  ? "You do not have permission to change role permissions."
                  : "Grouped by module. Changes apply to every user with this role on their next action."
          }
        />
        <PermissionMatrix
          modules={modules}
          selected={role?.is_super_admin ? new Set(modules.flatMap((m) => m.permissions.map((p) => p.slug))) : selected}
          onChange={setSelected}
          readOnly={!canEditPermissions}
          grantable={isSuperAdmin ? undefined : (s) => mineSet.has(s)}
        />
      </Card>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" type="button" onClick={() => router.push(editing ? `${ROLES_PATH}/${role.id}` : ROLES_PATH)}>
          Cancel
        </Button>
        <Button type="submit" loading={saving && !confirming}>
          <Save className="h-4 w-4" /> {editing ? "Save Role" : "Create Role"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        tone="primary"
        title="Save permission changes?"
        message={
          <>
            <strong>{role?.name}</strong>: {added.length} permission{added.length === 1 ? "" : "s"} added, {removed.length} removed. This affects{" "}
            <strong>
              {role?.users_count ?? 0} user{role?.users_count === 1 ? "" : "s"}
            </strong>{" "}
            immediately.
          </>
        }
        confirmLabel="Save changes"
        loading={saving}
        onConfirm={() => void persist()}
        onClose={() => setConfirming(false)}
      />
    </form>
  );
}
