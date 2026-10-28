"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldCheck, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDateTime, humanize } from "@/lib/utils";
import { authService } from "@/services/auth";
import { passwordRules } from "../auth/schemas";
import { applyApiErrors, nullable } from "../shared";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(255),
  email: z.string().trim().email("Enter a valid email."),
  job_title: z.string().max(255),
  phone: z.string().max(30),
});
const passwordSchema = z
  .object({ current_password: z.string().min(1, "Enter your current password."), password: passwordRules, password_confirmation: z.string() })
  .refine((v) => v.password === v.password_confirmation, { path: ["password_confirmation"], message: "Passwords do not match." });

function ProfileForm() {
  const user = useCurrentUser();
  const router = useRouter();
  const notify = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, email: user.email, job_title: user.job_title ?? "", phone: user.phone ?? "" },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authService.updateProfile(nullable(values));
      notify("Profile updated.");
      router.refresh();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, Object.keys(profileSchema.shape)));
    }
  });

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <FormError message={formError} />
      </div>
      <Field label="Full name" htmlFor="name" error={errors.name?.message} required>
        <Input id="name" invalid={!!errors.name} {...register("name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email?.message} required>
        <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Job title" htmlFor="job_title">
        <Input id="job_title" {...register("job_title")} />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" {...register("phone")} />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" loading={isSubmitting}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const notify = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { current_password: "", password: "", password_confirmation: "" } });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      notify((await authService.updatePassword(values)).message);
      reset();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ["current_password", "password", "password_confirmation"]));
    }
  });

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Current password" htmlFor="current_password" error={errors.current_password?.message} required>
        <Input id="current_password" type="password" autoComplete="current-password" invalid={!!errors.current_password} {...register("current_password")} />
      </Field>
      <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with a letter and a number." required>
        <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="password_confirmation" error={errors.password_confirmation?.message} required>
        <Input id="password_confirmation" type="password" autoComplete="new-password" invalid={!!errors.password_confirmation} {...register("password_confirmation")} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Change password
        </Button>
      </div>
    </form>
  );
}

export function ProfileView() {
  const user = useCurrentUser();
  return (
    <>
      <PageHeader title="Profile" description="Your account details and password." />
      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <Card>
          <CardBody className="flex flex-col items-center text-center">
            <Avatar name={user.name} size="lg" />
            <p className="mt-3 text-lg font-semibold text-ink-900">{user.name}</p>
            <p className="text-sm text-ink-500">{user.job_title ?? "—"}</p>
            <Badge tone="red" className="mt-3">
              <ShieldCheck className="h-3.5 w-3.5" /> {humanize(user.role)}
            </Badge>
            <dl className="mt-5 w-full space-y-1 text-left text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Can manage operations</dt>
                <dd className="font-medium">{user.permissions.manage_operations ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Can manage fleet</dt>
                <dd className="font-medium">{user.permissions.manage_fleet ? "Yes" : "No"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Last sign in</dt>
                <dd className="font-medium">{formatDateTime(user.last_login_at)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Account details" icon={<UserCircle />} />
            <CardBody>
              <ProfileForm />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Change password" icon={<KeyRound />} description="Other signed-in sessions are signed out after a change." />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
