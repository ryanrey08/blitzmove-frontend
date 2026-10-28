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
  const [notice, setNotice] = useState<string | null>(null);

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
      <div className="mb-9">
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-950">Welcome Back</h1>
        <p className="mt-2 text-lg text-ink-500">Sign in to your BlitzMove account</p>
      </div>

      {searchParams.get("expired") && !formError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Your session has ended. Please sign in again.</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormError message={formError} />

        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
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
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="h-13 w-full text-base font-semibold">
          {isSubmitting ? "Signing in…" : "Sign In"}
          {!isSubmitting && <ArrowRight className="h-5 w-5" />}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-4 text-sm text-ink-400">
        <span className="h-px flex-1 bg-ink-100" />
        or
        <span className="h-px flex-1 bg-ink-100" />
      </div>

      <button
        type="button"
        onClick={() => setNotice("Google sign-in isn't set up yet. Please sign in with your email and password.")}
        className="flex h-13 w-full items-center justify-center gap-3 rounded-lg border border-ink-200 bg-white text-base font-semibold text-ink-800 transition hover:bg-ink-50"
      >
        <GoogleIcon />
        Sign in with Google
      </button>
      {notice && <p className="mt-3 text-center text-sm text-ink-500" role="status">{notice}</p>}

      <p className="mt-8 text-center text-sm text-ink-600">
        Need an account? <span className="font-medium text-brand-600">Contact your administrator</span>
      </p>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
