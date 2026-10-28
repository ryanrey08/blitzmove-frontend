"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/services/api-client";
import { authService } from "@/services/auth";
import { resetPasswordSchema } from "./schemas";

export function ResetPasswordForm() {
  const router = useRouter();
  const notify = useToast();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const email = params.get("email") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema) });

  if (!token || !email) {
    return (
      <div className="space-y-4 text-center">
        <FormError message="This reset link is incomplete. Request a new one." />
        <Link href="/forgot-password" className="text-sm font-medium text-brand-600">
          Request a new link
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: z.infer<typeof resetPasswordSchema>) => {
    setFormError(null);
    try {
      await authService.resetPassword({ token, email, ...values });
      notify("Password updated. You can sign in now.");
      router.replace("/login");
    } catch (error) {
      setFormError(error instanceof ApiError ? (error.field("email") ?? error.field("password") ?? error.message) : "Reset failed.");
    }
  };

  return (
    <>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-ink-500">for {email}</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormError message={formError} />
        <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters with a letter and a number.">
          <Input id="password" type="password" autoComplete="new-password" invalid={!!errors.password} {...register("password")} />
        </Field>
        <Field label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation?.message}>
          <Input id="password_confirmation" type="password" autoComplete="new-password" invalid={!!errors.password_confirmation} {...register("password_confirmation")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </>
  );
}
