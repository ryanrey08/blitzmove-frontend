import { NextResponse, type NextRequest } from "next/server";
import { API_BASE, SESSION_COOKIE } from "@/lib/config";
import { isSameOrigin } from "@/lib/proxy";

/**
 * Same-origin gateway to the Laravel API. The browser never sees the Sanctum
 * token: it stays in an httpOnly cookie and is attached here as a Bearer token.
 */
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition", "content-length", "cache-control"];

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Cross-site request blocked." }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "Unauthenticated." }, { status: 401 });
  }

  const { path } = await params;
  if (path.some((segment) => segment === ".." || segment.includes("\\"))) {
    return NextResponse.json({ message: "Invalid path." }, { status: 400 });
  }

  const target = `${API_BASE}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers: Record<string, string> = {
    Accept: request.headers.get("accept") ?? "application/json",
    Authorization: `Bearer ${token}`,
  };
  const contentType = request.headers.get("content-type");
  if (contentType) headers["Content-Type"] = contentType;

  const hasBody = !["GET", "HEAD"].includes(request.method);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json({ message: "The BlitzMove API is unreachable. Please try again shortly." }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  const response = new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  if (upstream.status === 401) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
