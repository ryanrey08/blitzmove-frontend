"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Paginated } from "@/types/api";

interface PaginationProps {
  meta: Paginated<unknown>["meta"] | undefined;
  onPageChange: (page: number) => void;
  perPage?: number;
  onPerPageChange?: (perPage: number) => void;
  noun?: string;
}

function pageWindow(current: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? (["…", p] as const) : [p]));
}

export function Pagination({ meta, onPageChange, perPage, onPerPageChange, noun = "records" }: PaginationProps) {
  if (!meta || meta.total === 0) return null;
  const { current_page: page, last_page: last, from, to, total } = meta;

  const btn = "flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition disabled:opacity-40";

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 sm:flex-row">
      <p className="text-sm text-ink-500">
        Showing {from} to {to} of {total} {noun}
      </p>
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button className={cn(btn, "border-ink-200 bg-white hover:bg-ink-50")} disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageWindow(page, last).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="px-1 text-ink-400">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(btn, p === page ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-ink-200 bg-white hover:bg-ink-50")}
              >
                {p}
              </button>
            ),
          )}
          <button className={cn(btn, "border-ink-200 bg-white hover:bg-ink-50")} disabled={page >= last} onClick={() => onPageChange(page + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
        {onPerPageChange && (
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="input h-8 w-auto py-0 text-sm"
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
