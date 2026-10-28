import { ApiError, api } from "@/services/api-client";
import type { Resource, User } from "@/types/api";

/** Login and logout use dedicated route handlers that set / clear the httpOnly session cookie. */
async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      response.status === 429 ? "Too many sign-in attempts. Please wait a minute and try again." : payload.message ?? "Sign in failed.";
    throw new ApiError(message, response.status, payload.errors);
  }
  return payload as T;
}

async function publicApi<T>(path: string, body: unknown): Promise<T> {
  // Password reset endpoints are public, so they are forwarded without a session.
  return authRequest<T>(`/api/auth/${path}`, body);
}

export const authService = {
  login: (input: { email: string; password: string; remember: boolean }) => authRequest<{ data: { user: User } }>("/api/auth/login", input),
  logout: () => authRequest<{ message: string }>("/api/auth/logout"),
  forgotPassword: (email: string) => publicApi<{ message: string }>("forgot-password", { email }),
  resetPassword: (input: { token: string; email: string; password: string; password_confirmation: string }) =>
    publicApi<{ message: string }>("reset-password", input),
  updateProfile: (input: { name: string; email: string; job_title?: string | null; phone?: string | null }) =>
    api.put<Resource<User>>("auth/profile", input),
  updatePassword: (input: { current_password: string; password: string; password_confirmation: string }) =>
    api.put<{ message: string }>("auth/password", input),
};
