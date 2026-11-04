"use client";

import { useAppSelector } from "@/store/hooks";
import { selectCurrentUser, selectPermissions } from "@/store/slices/authSlice";
import type { User } from "@/types/api";

/** The signed-in user; AppShell loads it into the auth slice before rendering pages. */
export function useCurrentUser(): User {
  const user = useAppSelector(selectCurrentUser);
  if (!user) throw new Error("useCurrentUser must be used inside the authenticated layout.");
  return user;
}

/** `can("users.create")`, `can(["trips.view", "dispatch.view"])` (any of), `hasPermission`, `hasRole("super-admin")`. */
export function usePermissions() {
  return useAppSelector(selectPermissions);
}
