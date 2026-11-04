"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import type { ManagedUser } from "@/types/api";
import { applyApiErrors } from "../shared";
import { USERS_PATH, USER_KEYS, USER_STATUS, usersService } from "./api";

/** Same rules as the API (UserRequest): PH mobile numbers and strong passwords. */
const MOBILE = /^(\+?63|0)9\d{2}[\s-]?\d{3}[\s-]?\d{4}$/;
const STRONG = (v: string) => v.length >= 10 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);

const base = z.object({
  first_name: z.string().trim().min(1, "First name is required.").max(80),
  middle_name: z.string().trim().max(80),
  last_name: z.string().trim().min(1, "Last name is required.").max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters.")
    .max(50)
    .regex(/^[a-z0-9._-]+$/, "Use lowercase letters, numbers, dots, dashes or underscores."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  phone: z.union([z.literal(""), z.string().trim().regex(MOBILE, "Enter a valid PH mobile number, e.g. 0917 123 4567.")]),
  job_title: z.string().trim().max(255),
  role_id: z.string().min(1, "Select a role."),
  status: z.string().min(1, "Select a status."),
  driver_id: z.string(),
  password: z.string(),
  password_confirmation: z.string(),
});
const createSchema = base
  .refine((v) => v.phone !== "", { path: ["phone"], message: "Mobile number is required." })
  .refine((v) => STRONG(v.password), { path: ["password"], message: "At least 10 characters with upper and lower case letters, a number and a symbol." })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });
type FormInput = z.input<typeof base>;
type FormOutput = z.output<typeof base>;
const FIELDS = Object.keys(base.shape);

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

/** `/user-management/users/create` and `/user-management/users/[id]/edit`. */
export function UserEditor({ userId }: { userId?: number }) {
  const existing = useQuery({ queryKey: ["admin-user", userId], queryFn: () => usersService.get(userId!), enabled: !!userId });
  if (userId) {
    if (existing.isLoading) return <LoadingState label="Loading user…" />;
    if (existing.error || !existing.data) return <ErrorState message={existing.error?.message ?? "User not found."} onRetry={() => existing.refetch()} />;
    return <UserForm key={existing.data.data.id} user={existing.data.data} />;
  }
  return <UserForm />;
}

function UserForm({ user }: { user?: ManagedUser }) {
  const router = useRouter();
  const me = useCurrentUser();
  const { can, isSuperAdmin } = usePermissions();
  const [formError, setFormError] = useState<string | null>(null);
  const editing = !!user;
  const self = user?.id === me.id;
  const options = useQuery({ queryKey: ["admin-user-options", user?.id ?? 0], queryFn: () => usersService.options(user?.id).then((r) => r.data) });

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(editing ? base : createSchema),
    defaultValues: {
      first_name: str(user?.first_name),
      middle_name: str(user?.middle_name),
      last_name: str(user?.last_name),
      username: str(user?.username),
      email: str(user?.email),
      phone: str(user?.phone),
      job_title: str(user?.job_title),
      role_id: str(user?.role?.id),
      status: user?.status ?? "active",
      driver_id: str(user?.driver?.id),
      password: "",
      password_confirmation: "",
    },
  });
  const roleId = watch("role_id");
  const roles = options.data?.roles ?? [];
  const selectedRole = roles.find((r) => String(r.id) === roleId);
  const canChangeRole = !self && (!editing || can("users.assign_roles"));
  const canChangeStatus = !self && (!editing || can(["users.activate", "users.deactivate"]));
  const locked = editing && user.role?.slug === "super-admin" && !isSuperAdmin;

  const roleOptions = roles
    .filter((r) => r.assignable || String(r.id) === str(user?.role?.id))
    .map((r) => ({ value: String(r.id), label: r.is_active ? r.name : `${r.name} (inactive)` }));

  const save = useApiMutation(
    (values: FormOutput) => {
      const payload: Record<string, unknown> = {
        ...values,
        middle_name: values.middle_name || null,
        phone: values.phone || null,
        job_title: values.job_title || null,
        role_id: Number(values.role_id),
        driver_id: selectedRole?.slug === "driver" && values.driver_id ? Number(values.driver_id) : null,
      };
      if (editing) {
        delete payload.password;
        delete payload.password_confirmation;
        if (!canChangeRole) delete payload.role_id;
        if (!canChangeStatus) delete payload.status;
      }
      return editing ? usersService.update(user.id, payload) : usersService.create(payload);
    },
    { invalidate: USER_KEYS },
  );

  const submit = handleSubmit(
    async (values) => {
      setFormError(null);
      try {
        const result = await save.mutateAsync(values);
        router.push(`${USERS_PATH}/${result.data.id}`);
      } catch (error) {
        setFormError(applyApiErrors(error, setError as UseFormSetError<FormInput>, FIELDS));
      }
    },
    () => setFormError("Some details are missing or invalid. Check the highlighted fields."),
  );

  if (locked) return <ErrorState message="Only a Super Admin can edit Super Admin accounts." />;

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{editing ? `Edit ${user.name}` : "Add User"}</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">{editing ? "Update this person's details, role and account status." : "Create a sign-in for a team member and choose their role."}</p>
        </div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-500">
          <span>User Management</span>
          <ChevronRight className="h-4 w-4" />
          <Link href={USERS_PATH} className="hover:text-ink-900">
            Users
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-ink-900">{editing ? "Edit User" : "Add User"}</span>
        </nav>
      </div>

      {formError && (
        <div className="mb-5">
          <FormError message={formError} />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Personal Information" icon={<UserRound />} />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="First Name" htmlFor="first_name" required error={errors.first_name?.message}>
              <Input id="first_name" autoComplete="given-name" invalid={!!errors.first_name} {...register("first_name")} />
            </Field>
            <Field label="Middle Name" htmlFor="middle_name" error={errors.middle_name?.message} hint="Optional">
              <Input id="middle_name" autoComplete="additional-name" {...register("middle_name")} />
            </Field>
            <Field label="Last Name" htmlFor="last_name" required error={errors.last_name?.message}>
              <Input id="last_name" autoComplete="family-name" invalid={!!errors.last_name} {...register("last_name")} />
            </Field>
            <Field label="Username" htmlFor="username" required error={errors.username?.message} className="sm:col-span-1">
              <Input id="username" autoComplete="off" placeholder="jdelacruz" invalid={!!errors.username} {...register("username")} />
            </Field>
            <Field label="Email Address" htmlFor="email" required error={errors.email?.message} className="sm:col-span-2">
              <Input id="email" type="email" autoComplete="off" placeholder="name@company.com" invalid={!!errors.email} {...register("email")} />
            </Field>
            <Field label="Mobile Number" htmlFor="phone" required={!editing} error={errors.phone?.message}>
              <Input id="phone" type="tel" placeholder="0917 123 4567" invalid={!!errors.phone} {...register("phone")} />
            </Field>
            <Field label="Job Title" htmlFor="job_title" error={errors.job_title?.message} hint="Optional, e.g. Night Dispatcher" className="sm:col-span-2">
              <Input id="job_title" {...register("job_title")} />
            </Field>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Role & Access" icon={<ShieldCheck />} />
            <CardBody className="grid gap-4">
              <Field
                label="Role"
                htmlFor="role_id"
                required
                error={errors.role_id?.message}
                hint={self ? "You cannot change your own role." : !canChangeRole ? "You do not have permission to change roles." : "Only roles you are allowed to assign are listed."}
              >
                <Select id="role_id" options={roleOptions} placeholder={options.isLoading ? "Loading roles…" : "Select a role"} disabled={!canChangeRole} invalid={!!errors.role_id} {...register("role_id")} />
              </Field>
              {selectedRole?.slug === "driver" && (
                <Field label="Driver Profile" htmlFor="driver_id" error={errors.driver_id?.message} hint="Links the login to a driver so they see only their own trips.">
                  <Select
                    id="driver_id"
                    options={(options.data?.drivers ?? []).map((d) => ({ value: String(d.id), label: `${d.full_name} · ${d.employee_code}` }))}
                    placeholder="Not linked"
                    {...register("driver_id")}
                  />
                </Field>
              )}
              <Field label="Account Status" htmlFor="status" required error={errors.status?.message} hint={self ? "You cannot deactivate your own account." : "Inactive and suspended users cannot sign in."}>
                <Select
                  id="status"
                  options={Object.entries(USER_STATUS).map(([value, s]) => ({ value, label: s.label }))}
                  disabled={!canChangeStatus}
                  invalid={!!errors.status}
                  {...register("status")}
                />
              </Field>
            </CardBody>
          </Card>

          {!editing && (
            <Card>
              <CardHeader title="Password" icon={<KeyRound />} />
              <CardBody className="grid gap-4">
                <Field label="Password" htmlFor="password" required error={errors.password?.message} hint="At least 10 characters with upper and lower case letters, a number and a symbol.">
                  <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
                </Field>
                <Field label="Confirm Password" htmlFor="password_confirmation" required error={errors.password_confirmation?.message}>
                  <Input id="password_confirmation" type="password" autoComplete="new-password" invalid={!!errors.password_confirmation} {...register("password_confirmation")} />
                </Field>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" type="button" onClick={() => router.push(editing ? `${USERS_PATH}/${user.id}` : USERS_PATH)}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          <Save className="h-4 w-4" /> {editing ? "Save Changes" : "Create User"}
        </Button>
      </div>
    </form>
  );
}
