"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** API sort field; enables a sortable header. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  sort?: string;
  onSortChange?: (sort: string) => void;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  /** Extra classes for a row, e.g. to highlight rows that need attention. */
  rowClassName?: (row: T) => string | undefined;
  empty?: { title: string; description?: string; action?: ReactNode };
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  sort,
  onSortChange,
  onRowClick,
  selectedKey,
  rowClassName,
  empty = { title: "No records found" },
  className,
}: DataTableProps<T>) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    onSortChange(sort === key ? `-${key}` : key);
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
          <tr>
            {columns.map((col) => {
              const active = sort === col.sortKey || sort === `-${col.sortKey}`;
              const SortIcon = !active ? ArrowUpDown : sort?.startsWith("-") ? ArrowDown : ArrowUp;
              return (
                <th key={col.key} scope="col" className={cn("px-4 py-3 whitespace-nowrap", col.headerClassName)}>
                  {col.sortKey && onSortChange ? (
                    <button
                      onClick={() => toggleSort(col.sortKey!)}
                      className={cn("inline-flex items-center gap-1 hover:text-ink-900", active && "text-ink-900")}
                    >
                      {col.header}
                      <SortIcon className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {loading && !rows
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div className="h-4 w-full max-w-32 animate-pulse rounded bg-ink-100" />
                    </td>
                  ))}
                </tr>
              ))
            : rows?.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "transition-colors",
                      onRowClick && "cursor-pointer hover:bg-ink-50",
                      rowClassName?.(row),
                      selectedKey === key && "bg-brand-50/60 hover:bg-brand-50",
                      loading && "opacity-60",
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 align-middle whitespace-nowrap text-ink-700", col.className)}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>
      {!loading && rows?.length === 0 && <EmptyState {...empty} />}
    </div>
  );
}
