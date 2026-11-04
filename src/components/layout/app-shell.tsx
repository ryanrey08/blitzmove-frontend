"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, type ReactNode } from "react";
import { RouteGuard } from "@/components/auth/route-guard";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks";
import { baseApi } from "@/store/services/api";
import { sessionLoaded, signedOut, userUpdated } from "@/store/slices/authSlice";
import { mobileNavClosed, mobileNavToggled, selectMobileNavOpen, selectSidebarCollapsed, sidebarCollapsedSet } from "@/store/slices/uiSlice";
import type { User } from "@/types/api";

const COLLAPSE_KEY = "bm.sidebar.collapsed";

/**
 * Loads the server-validated user into the auth slice before any page renders, keeps
 * it in step with router.refresh(), and clears client caches when the user signs out.
 */
function useSession(user: User) {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  // Pages read the user on their first render, so it is loaded during render (once per session).
  if (store.getState().auth.user === null) store.dispatch(sessionLoaded(user));

  useLayoutEffect(() => {
    dispatch(userUpdated(user));
  }, [dispatch, user]);

  useEffect(
    () => () => {
      // Leaving the shell after a sign-out (not a dev-mode remount): drop the user's cached data.
      if (!store.getState().auth.signingOut) return;
      queryClient.clear();
      store.dispatch(baseApi.util.resetApiState());
      store.dispatch(signedOut());
    },
    [store, queryClient],
  );
}

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  useSession(user);
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector(selectSidebarCollapsed);
  const mobileOpen = useAppSelector(selectMobileNavOpen);

  useEffect(() => {
    try {
      dispatch(sidebarCollapsedSet(localStorage.getItem(COLLAPSE_KEY) === "1"));
    } catch {
      /* storage unavailable */
    }
  }, [dispatch]);
  useEffect(() => {
    dispatch(mobileNavClosed());
  }, [dispatch, pathname]);

  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      dispatch(sidebarCollapsedSet(!collapsed));
      try {
        localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
    } else {
      dispatch(mobileNavToggled());
    }
  };

  return (
    <div className="min-h-screen">
      <Suspense>
        <NavigationProgress />
      </Suspense>
      {/* Navigation is left out when printing (trip sheets, itineraries). */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden w-[17rem] transition-transform lg:block print:hidden", collapsed && "-translate-x-full")}>
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => dispatch(mobileNavClosed())} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] shadow-2xl">
            <Sidebar />
          </aside>
        </div>
      )}

      <div className={cn("flex min-h-screen flex-col transition-[padding] print:pl-0", collapsed ? "lg:pl-0" : "lg:pl-[17rem]")}>
        <Topbar onMenuClick={toggleMenu} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </div>
  );
}
