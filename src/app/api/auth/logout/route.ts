import { NextResponse, type NextRequest } from "next/server";
import { API_BASE, SESSION_COOKIE } from "@/lib/config";
import { isSameOrigin } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Cross-site request blocked." }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    // Revoke the token server-side; the cookie is cleared even if the API is down.
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ message: "Logged out." });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
