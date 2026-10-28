import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import { API_BASE, SESSION_COOKIE, SESSION_COOKIE_SECURE } from "@/lib/config";
import type { User } from "@/types/api";

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/**
 * Resolves the signed-in user by asking the API to validate the session token.
 * Returns null when there is no token or the API rejects it.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = await getSessionToken();
  if (!token) return null;

  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Could not load the current user (HTTP ${response.status}).`);

  return ((await response.json()) as { data: User }).data;
});

export function sessionCookieOptions(expiresAt?: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
    // Without "remember me" the cookie lives for the browser session only.
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}
