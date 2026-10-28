"use client";

import { createContext, useContext } from "react";
import type { User } from "@/types/api";

export const CurrentUserContext = createContext<User | null>(null);

export function useCurrentUser(): User {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside the authenticated layout.");
  return user;
}

/** Mirrors the API gates: manage-operations and manage-fleet. */
export function usePermissions() {
  const { permissions } = useCurrentUser();
  return { canOperate: permissions.manage_operations, canManageFleet: permissions.manage_fleet };
}
