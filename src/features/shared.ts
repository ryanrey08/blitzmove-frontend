import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/services/api-client";

/**
 * Copies Laravel validation errors onto react-hook-form fields and returns any
 * message that did not belong to a visible field.
 */
export function applyApiErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]): string | null {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : "Something went wrong.";

  let unmatched: string | null = error.status === 422 ? null : error.message;
  for (const [field, messages] of Object.entries(error.errors)) {
    const name = field.split(".")[0];
    if (fields.includes(name)) setError(name as Path<T>, { message: messages[0] });
    else unmatched ??= messages[0];
  }
  return unmatched ?? (Object.keys(error.errors).length ? null : error.message);
}

/** Converts "" from optional inputs into null for the API. */
export function nullable<T extends Record<string, unknown>>(values: T): T {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])) as T;
}
