"use client";

import { useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { ChevronDown, ChevronRight, Download, FileText, Filter, Printer, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Dropdown, type DropdownItem } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/form";
import { SearchInput } from "@/components/ui/search-input";
import { formatNumber } from "@/lib/utils";
import type { Paginated } from "@/types/api";

/**
 * Layout and state shared by the report pages (Trip, Driver, Maintenance, Geofence, Utilization, Delivery, Custom):
 * header with breadcrumb, a Report Configuration panel whose draft is applied with "Generate Report", and the
 * table card with search, filter shortcut and export menu.
 */

export interface Period {
  from: string;
  to: string;
}

const PERIOD_KEY = "bm-report-period";

export const monthPeriod = (): Period => ({
  from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
  to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
});

/** The period last generated on any report page, so moving between report pages keeps it (this tab only). */
function storedPeriod(): Period | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PERIOD_KEY) ?? "null") as Period | null;
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value.from) && /^\d{4}-\d{2}-\d{2}$/.test(value.to) ? value : null;
  } catch {
    return null;
  }
}

function storePeriod(period: Period) {
  try {
    sessionStorage.setItem(PERIOD_KEY, JSON.stringify({ from: period.from, to: period.to }));
  } catch {
    // Storage blocked: the period just isn't carried to the next page.
  }
}

/**
 * Draft/applied report configuration. `ready` turns true once the remembered period is loaded, so queries
 * don't fetch the default month first. `queryKey` is invalidated when Generate is pressed without changes.
 */
export function useReportConfig<C extends Period>(defaults: () => C, queryKey: string[]) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<C>(defaults);
  const [applied, setApplied] = useState<C>(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const period = storedPeriod();
    if (period) {
      setDraft((d) => ({ ...d, ...period }));
      setApplied((a) => ({ ...a, ...period }));
    }
    setReady(true);
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  return {
    draft,
    applied,
    ready,
    dirty,
    set: <K extends keyof C>(key: K, value: C[K]) => setDraft((d) => ({ ...d, [key]: value })),
    setPeriod: (from: string, to: string) => setDraft((d) => ({ ...d, from, to })),
    /** Changes the draft and the applied configuration together (e.g. sorting from a table header). */
    patch: (values: Partial<C>) => {
      setDraft((d) => ({ ...d, ...values }));
      setApplied((a) => ({ ...a, ...values }));
    },
    /** Replaces both, e.g. when a saved configuration is loaded. */
    load: (next: C) => {
      setDraft(next);
      setApplied(next);
      storePeriod(next);
    },
    /** Applies the draft; the date picker's "Clear" leaves no period, so it falls back to this month. */
    generate: () => {
      const next = draft.from && draft.to ? draft : { ...draft, ...monthPeriod() };
      setDraft(next);
      setApplied(next);
      storePeriod(next);
      if (!dirty) queryClient.invalidateQueries({ queryKey });
    },
    reset: () => {
      setDraft(defaults());
      setApplied(defaults());
      storePeriod(defaults());
    },
  };
}

/** Query params without blank values (the type keeps the keys; blanks are simply not sent). */
export function compact<T extends object>(params: T): T {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as T;
}

export function ReportHeader({ title, subtitle, crumb, path }: { title: string; subtitle: string; crumb: string; path: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-ink-500 sm:text-base">{subtitle}</p>
      </div>
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-500 print:hidden">
        <Link href="/reports/overview" className="hover:text-ink-900">
          Reports
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={path} className="hover:text-ink-900">
          {crumb}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-ink-900">{title}</span>
      </nav>
    </div>
  );
}

/** Two columns on wide screens: the configuration panel and the report. */
export function ReportLayout({ config, children }: { config: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[18.5rem_minmax(0,1fr)]">
      {config}
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

export function ReportConfigPanel({
  panelRef,
  period,
  onPeriodChange,
  periodHint,
  periodDisabled,
  onReset,
  onGenerate,
  loading,
  dirty,
  generateLabel = "Generate Report",
  disabled,
  children,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  period: Period;
  onPeriodChange: (from: string, to: string) => void;
  periodHint?: string;
  periodDisabled?: boolean;
  onReset: () => void;
  onGenerate: () => void;
  loading?: boolean;
  dirty?: boolean;
  generateLabel?: string;
  /** No data source yet: the Generate button is disabled. */
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div ref={panelRef} tabIndex={-1} className="scroll-mt-20 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500 xl:self-start print:hidden">
      <Card>
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
          <Filter className="h-5 w-5 fill-ink-900 text-ink-900" aria-hidden />
          <h2 className="text-base font-semibold text-ink-900">Report Configuration</h2>
        </div>
        <form
          className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-1"
          onSubmit={(e) => {
            e.preventDefault();
            onGenerate();
          }}
        >
          <Field label="Date Range" required={!periodDisabled} hint={periodHint} className="sm:col-span-2 lg:col-span-1">
            {periodDisabled ? (
              <div className="input flex items-center text-ink-400">Not applicable</div>
            ) : (
              <DateRangeFilter from={period.from} to={period.to} onChange={onPeriodChange} emptyLabel="Select period" />
            )}
          </Field>
          {children}
          <div className="flex flex-col gap-2 pt-2 sm:col-span-2 lg:col-span-4 xl:col-span-1">
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={onReset} className="h-11 flex-1 sm:flex-none xl:flex-1">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
              <Button type="submit" className="h-11 flex-[1.6] sm:flex-none sm:px-6 xl:flex-[1.6] xl:px-3" loading={loading} disabled={disabled}>
                <FileText className="h-4 w-4" /> {generateLabel}
              </Button>
            </div>
            {dirty && <p className="text-xs text-amber-600">Changes not applied yet. Select {generateLabel} to update the page.</p>}
          </div>
        </form>
      </Card>
    </div>
  );
}

/** Section heading inside the configuration grid (spans the row on tablet). */
export function ConfigHeading({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 text-base font-semibold text-ink-900 sm:col-span-2 lg:col-span-4 xl:col-span-1">{children}</h3>;
}

/** Scrolls to and focuses the configuration panel (the table's Filter button). */
export function focusPanel(ref: RefObject<HTMLDivElement | null>) {
  ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  ref.current?.focus({ preventScroll: true });
}

/** Table card header: search, Filter (jumps to the configuration) and Export menu with a Print / PDF item. */
export function TableCard({
  icon,
  title,
  search,
  onSearch,
  searchPlaceholder,
  filterCount,
  onFilter,
  exportItems,
  exporting,
  actions,
  children,
}: {
  icon: ReactNode;
  title: string;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  filterCount: number;
  onFilter: () => void;
  exportItems: DropdownItem[];
  exporting?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader
        icon={icon}
        title={title}
        className="flex-col sm:flex-row sm:flex-wrap sm:items-center [&>div:last-child]:w-full sm:[&>div:last-child]:w-auto"
        action={
          <div className="flex w-full flex-wrap items-center gap-2 print:hidden">
            {onSearch && (
              <SearchInput value={search ?? ""} onChange={onSearch} placeholder={searchPlaceholder} className="min-w-0 basis-full sm:w-56 sm:flex-none sm:basis-auto" />
            )}
            <Button variant="secondary" onClick={onFilter} title="Filters are set in Report Configuration">
              <Filter className="h-4 w-4" /> Filter
              {filterCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[0.65rem] leading-4 font-semibold text-white">{filterCount}</span>}
            </Button>
            <Dropdown
              trigger={({ toggle, open }) => (
                <Button variant="secondary" onClick={toggle} loading={exporting} aria-expanded={open}>
                  <Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              )}
              items={[...exportItems, { label: "Print / Save as PDF", icon: <Printer />, onSelect: () => window.print() }]}
            />
            {actions}
          </div>
        }
      />
      {children}
    </Card>
  );
}

/** Smaller cells so wide report tables fit more columns. */
export const TABLE_CELL = "px-3 text-xs sm:text-[0.8rem]";

/**
 * Search, sort and pagination in the browser for reports whose rows arrive in one response (one row per driver
 * or vehicle). `sort` uses the DataTable convention: "key" or "-key".
 */
export function useLocalTable<T>(rows: T[] | undefined, options: { search: string; text: (row: T) => string; sortValue: (row: T, key: string) => string | number | null; initialSort: string }) {
  const [sort, setSort] = useState(options.initialSort);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const { search, text, sortValue } = options;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = (rows ?? []).filter((row) => !term || text(row).toLowerCase().includes(term));
    const key = sort.replace(/^-/, "");
    const dir = sort.startsWith("-") ? -1 : 1;
    return [...matched].sort((a, b) => {
      const x = sortValue(a, key);
      const y = sortValue(b, key);
      // Blanks last in either direction.
      if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, search, sort, text, sortValue]);

  const last = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, last);
  const start = (current - 1) * perPage;
  const meta: Paginated<T>["meta"] = {
    current_page: current,
    last_page: last,
    per_page: perPage,
    total: filtered.length,
    from: filtered.length ? start + 1 : null,
    to: filtered.length ? Math.min(start + perPage, filtered.length) : null,
  };

  return {
    all: filtered,
    rows: rows ? filtered.slice(start, start + perPage) : undefined,
    meta,
    offset: start,
    sort,
    setSort: (next: string) => {
      setSort(next);
      setPage(1);
    },
    setPage,
    perPage,
    setPerPage: (n: number) => {
      setPerPage(n);
      setPage(1);
    },
    resetPage: () => setPage(1),
  };
}

/** 4.5 → "4h 30m"; 0.25 → "15m". */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return "—";
  const minutes = Math.round(hours * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h.toLocaleString()}h ${m}m` : `${h.toLocaleString()}h`;
}

/** Hours between two timestamps, or null when either is missing or they are out of order. */
export function hoursBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return ms >= 0 ? ms / 3_600_000 : null;
}

export const percent = (v: number) => `${formatNumber(v, v % 1 ? 1 : 0)}%`;
