import { NextResponse, type NextRequest } from "next/server";
import { API_BASE } from "@/lib/config";
import { isSameOrigin } from "@/lib/proxy";
import { sessionCookieOptions } from "@/lib/session";

interface LoginResponse {
  data: { token: string; expires_at: string; user: unknown };
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Cross-site request blocked." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; remember?: boolean };

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: body.email, password: body.password, remember: Boolean(body.remember), device_name: "web" }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ message: "The BlitzMove API is unreachable. Please try again shortly." }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => ({ message: "Unexpected response from the API." }));
  if (!upstream.ok) {
    return NextResponse.json(payload, { status: upstream.status });
  }

  const { token, expires_at, user } = (payload as LoginResponse).data;
  const response = NextResponse.json({ data: { user } });
  response.cookies.set({
    ...sessionCookieOptions(body.remember ? new Date(expires_at) : undefined),
    value: token,
  });

  return response;
}
