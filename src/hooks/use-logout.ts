"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { authService } from "@/services/auth";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectSigningOut, signOutFailed, signOutStarted } from "@/store/slices/authSlice";

/**
 * Signs out through /api/auth/logout (which revokes the token and clears the
 * httpOnly cookie). AppShell drops the cached data once it unmounts.
 */
export function useLogout() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const notify = useToast();
  const signingOut = useAppSelector(selectSigningOut);

  const logout = async () => {
    dispatch(signOutStarted());
    try {
      await authService.logout();
    } catch {
      notify("Could not sign out. Please try again.", "error");
      dispatch(signOutFailed());
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  return { logout, signingOut };
}
