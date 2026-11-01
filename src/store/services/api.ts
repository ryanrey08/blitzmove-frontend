import { createApi, type BaseQueryFn } from "@reduxjs/toolkit/query/react";
import { ApiError, api } from "@/services/api-client";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequest {
  url: string;
  method?: Method;
  /** Query string for GET requests. */
  params?: Record<string, unknown>;
  body?: unknown;
}

/** ApiError as plain data: Redux state (where RTK Query keeps errors) must stay serializable. */
export interface ApiErrorData {
  status: number;
  message: string;
  errors: Record<string, string[]>;
}

export function isApiErrorData(value: unknown): value is ApiErrorData {
  return typeof value === "object" && value !== null && "status" in value && "message" in value && "errors" in value;
}

/**
 * Runs every RTK Query endpoint through the existing api-client, so requests keep
 * going through the same-origin /api/proxy with the httpOnly session cookie, the
 * 401 → login redirect, and the API's message + field errors on failure.
 */
const apiClientBaseQuery: BaseQueryFn<ApiRequest, unknown, ApiErrorData> = async ({ url, method = "GET", params, body }, { signal }) => {
  try {
    const data =
      method === "GET"
        ? await api.get(url, params, signal)
        : method === "DELETE"
          ? await api.delete(url)
          : await api[method.toLowerCase() as "post" | "put" | "patch"](url, body);
    return { data };
  } catch (error) {
    if (error instanceof ApiError) return { error: { status: error.status, message: error.message, errors: error.errors } };
    return { error: { status: 0, message: error instanceof Error ? error.message : "Request failed.", errors: {} } };
  }
};

/**
 * Root RTK Query API. Feature endpoints are added with `baseApi.injectEndpoints`
 * next to the feature (see store/services/authApi.ts).
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: apiClientBaseQuery,
  tagTypes: [],
  endpoints: () => ({}),
});
