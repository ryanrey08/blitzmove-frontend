"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useToast } from "@/components/ui/toast";
import { CurrentUserContext } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import { authService } from "@/services/auth";
import type { User } from "@/types/api";

const COLLAPSE_KEY = "bm.sidebar.collapsed";

export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const notify = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setCollapsed((value) => {
        try {
          localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
        } catch {
          /* storage unavailable */
        }
        return !value;
      });
    } else {
      setMobileOpen((value) => !value);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await authService.logout();
      router.replace("/login");
      router.refresh();
    } catch {
      notify("Could not sign out. Please try again.", "error");
      setLoggingOut(false);
    }
  };

  const sidebar = <Sidebar user={user} onLogout={logout} loggingOut={loggingOut} onNavigate={() => setMobileOpen(false)} />;

  return (
    <CurrentUserContext.Provider value={user}>
      <div className="min-h-screen">
        {/* Navigation is left out when printing (trip sheets, itineraries). */}
        <aside className={cn("fixed inset-y-0 left-0 z-30 hidden w-[17rem] transition-transform lg:block print:hidden", collapsed && "-translate-x-full")}>
          {sidebar}
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-ink-950/60" onClick={() => setMobileOpen(false)} aria-hidden />
            <aside className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] shadow-2xl">{sidebar}</aside>
          </div>
        )}

        <div className={cn("flex min-h-screen flex-col transition-[padding] print:pl-0", collapsed ? "lg:pl-0" : "lg:pl-[17rem]")}>
          <Topbar user={user} onMenuClick={toggleMenu} onLogout={logout} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </CurrentUserContext.Provider>
  );
}
