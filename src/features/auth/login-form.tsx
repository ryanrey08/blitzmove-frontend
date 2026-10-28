"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api-client";
import { authService } from "@/services/auth";
import { loginSchema, type LoginInput } from "./schemas";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : "/dashboard";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "", remember: false } });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);
    try {
      await authService.login(values);
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422 && error.field("email")) {
        setError("email", { message: error.field("email") });
        if (error.field("password")) setError("password", { message: error.field("password") });
      } else {
        setFormError(error instanceof Error ? error.message : "Sign in failed.");
      }
    }
  };

  return (
    <>
      <div className="mb-7 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Welcome Back</h1>
        <p className="mt-1 text-sm text-ink-500">Sign in to your BlitzMove account</p>
      </div>

      {searchParams.get("expired") && !formError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Your session has ended. Please sign in again.</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormError message={formError} />

        <Field label="Email address" htmlFor="email" error={errors.email?.message}>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              aria-invalid={!!errors.email}
              className={cn("input h-12 pl-11 text-[0.95rem]", errors.email && "input-invalid")}
              {...register("email")}
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-invalid={!!errors.password}
              className={cn("input h-12 pr-11 pl-11 text-[0.95rem]", errors.password && "input-invalid")}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-ink-500 hover:text-ink-800"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <Checkbox label="Remember me" {...register("remember")} />
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot Password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full bg-gradient-to-r from-brand-600 to-brand-700">
          {isSubmitting ? "Signing in…" : "Sign In"}
          {!isSubmitting && <ArrowRight className="h-5 w-5" />}
        </Button>
      </form>
    </>
  );
}
