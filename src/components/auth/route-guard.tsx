"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AccessDenied } from "@/components/auth/access-denied";
import { usePermissions } from "@/hooks/use-current-user";
import { homePath, routePermission } from "@/lib/navigation";

/**
 * Blocks pages the user's role may not open (direct URLs included) with a 403
 * screen. Users without the dashboard are sent to their first permitted page
 * instead, so sign-in and the logo always land somewhere useful.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { can } = usePermissions();
  const required = routePermission(pathname);
  const allowed = !required || can(required);
  const home = homePath(can);
  const redirectHome = !allowed && pathname === "/dashboard" && home !== "/dashboard";

  useEffect(() => {
    if (redirectHome) router.replace(home);
  }, [redirectHome, home, router]);

  if (allowed) return <>{children}</>;
  if (redirectHome) return null;
  return <AccessDenied homeHref={home} />;
}
