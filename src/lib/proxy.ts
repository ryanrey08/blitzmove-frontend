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

/**
 * Passes the visitor's IP on to Laravel so its rate limits apply per visitor, not to this server.
 * X-Real-IP is set by the host nginx in front of Next.js; without it (local dev) nothing is sent.
 */
export function clientIpHeaders(request: NextRequest): Record<string, string> {
  const ip = request.headers.get("x-real-ip");
  return ip ? { "X-Forwarded-For": ip } : {};
}
