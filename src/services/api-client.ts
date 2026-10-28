import { compactParams } from "@/lib/utils";

/** Browser-side client. All calls go through the same-origin proxy in app/api/proxy. */
const BASE = "/api/proxy";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: Record<string, string[]> = {},
  ) {
    super(message);
  }

  /** First validation message for a field, if any. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

type Query = Record<string, unknown>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const qs = query ? new URLSearchParams(compactParams(query)).toString() : "";
  return `${BASE}/${path.replace(/^\//, "")}${qs ? `?${qs}` : ""}`;
}

async function request<T>(method: string, path: string, { query, body, signal }: RequestOptions = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: { Accept: "application/json", ...(body && !isForm ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    credentials: "same-origin",
    signal,
  });

  if (response.status === 401 && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?expired=1&next=${next}`);
    throw new ApiError("Your session has expired. Please sign in again.", 401);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (payload as { message?: string } | null)?.message ||
      (response.status === 403 ? "You do not have permission to do that." : `Request failed (HTTP ${response.status}).`);
    throw new ApiError(message, response.status, (payload as { errors?: Record<string, string[]> } | null)?.errors);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path),
  url: buildUrl,
};
