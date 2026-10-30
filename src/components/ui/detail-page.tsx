import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ApiError } from "@/services/api-client";

/** "← Back to …" link above a detail page. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
      <ArrowLeft className="h-4 w-4" /> {children}
    </Link>
  );
}

/** Loading, not-found (404) and error states for a detail page, with the Back link kept in each. */
export function DetailPageState({
  loading,
  error,
  onRetry,
  backHref,
  backLabel,
  noun,
}: {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  backHref: string;
  backLabel: string;
  noun: string;
}) {
  const notFound = !loading && (!error || (error instanceof ApiError && error.status === 404));
  return (
    <>
      <BackLink href={backHref}>{backLabel}</BackLink>
      <Card>
        {loading ? (
          <LoadingState label={`Loading ${noun}…`} />
        ) : notFound ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" aria-hidden />}
            title={`This ${noun} could not be found`}
            description="It may have been removed, or the link is wrong."
            action={
              <Link href={backHref} className="text-sm font-medium text-brand-600 hover:underline">
                {backLabel}
              </Link>
            }
          />
        ) : (
          <ErrorState message={error?.message} onRetry={onRetry} />
        )}
      </Card>
    </>
  );
}
