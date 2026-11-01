"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import type { ApiError } from "@/services/api-client";
import { StoreProvider } from "@/store/provider";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
            retry: (count, error) => count < 2 && ![401, 403, 404, 422].includes((error as ApiError).status),
          },
        },
      }),
  );

  return (
    <StoreProvider>
      <QueryClientProvider client={client}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </StoreProvider>
  );
}
