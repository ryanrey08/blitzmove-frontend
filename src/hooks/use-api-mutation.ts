"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import type { ApiError } from "@/services/api-client";

/**
 * Wraps a write call: shows the API's message, refreshes the given query keys,
 * and leaves field errors on `error` for the form to display.
 */
export function useApiMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  { invalidate = [], onSuccess, successMessage }: { invalidate?: string[][]; onSuccess?: (result: TResult) => void; successMessage?: string } = {},
) {
  const queryClient = useQueryClient();
  const notify = useToast();

  return useMutation<TResult, ApiError, TInput>({
    mutationFn: fn,
    onSuccess: (result) => {
      invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      const message = successMessage ?? (result as { message?: string } | undefined)?.message;
      if (message) notify(message);
      onSuccess?.(result);
    },
    onError: (error) => {
      if (error.status !== 422) notify(error.message, "error");
    },
  });
}
