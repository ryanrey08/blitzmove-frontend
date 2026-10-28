import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness probe for the container healthcheck. Does not call the API. */
export function GET() {
  return NextResponse.json({ status: "ok" });
}
