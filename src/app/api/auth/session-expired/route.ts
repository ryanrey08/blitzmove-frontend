import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";

/** Clears a cookie the API no longer accepts and sends the user to the login page. */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const url = new URL("/login", request.url);
  url.searchParams.set("expired", "1");
  if (next?.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);

  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
