import { NextResponse, type NextRequest } from "next/server";
import { API_BASE } from "@/lib/config";
import { isSameOrigin } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ message: "Cross-site request blocked." }, { status: 403 });
  }

  try {
    const upstream = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(await request.json().catch(() => ({}))),
      cache: "no-store",
    });
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ message: "The BlitzMove API is unreachable. Please try again shortly." }, { status: 502 });
  }
}
