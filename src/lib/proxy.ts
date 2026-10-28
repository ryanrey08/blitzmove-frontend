import "server-only";

import type { NextRequest } from "next/server";

/**
 * Rejects state-changing requests that do not originate from this site.
 * SameSite=Lax already keeps the cookie off cross-site POSTs; this is defence in depth.
 */
export function isSameOrigin(request: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;

  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
