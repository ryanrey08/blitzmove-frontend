"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { authService } from "@/services/auth";

const schema = z.object({ email: z.string().trim().min(1, "Email address is required.").email("Enter a valid email address.") });

export function ForgotPasswordForm() {
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: z.infer<typeof schema>) => {
    setFormError(null);
    try {
      setSent((await authService.forgotPassword(email)).message);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not send the reset link.");
    }
  };

  return (
    <>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Forgot password</h1>
        <p className="mt-1 text-sm text-ink-500">We will email you a link to choose a new password.</p>
      </div>
      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-emerald-50 p-5 text-center text-sm text-emerald-800">
          <MailCheck className="h-8 w-8" aria-hidden />
          {sent}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <FormError message={formError} />
          <Field label="Email address" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" invalid={!!errors.email} className="h-12" {...register("email")} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </>
  );
}
