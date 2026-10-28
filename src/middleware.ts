import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "bm_session";
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

/**
 * First line of route protection: no session cookie, no app pages. The (app)
 * layout then validates the token with the API on every request.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/login" && !request.nextUrl.searchParams.has("expired")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Lets server components know the requested path (used for post-login redirects).
  const forwarded = new Headers(request.headers);
  forwarded.set("x-pathname", `${pathname}${search}`);
  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
