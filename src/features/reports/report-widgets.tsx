"use client";

import { ArrowDown, ArrowUp, BarChart3, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import type { Compared } from "./api";

/** Stat cards, chart cards and small controls shared by the Reports pages. */

export function Stat({
  icon: Icon,
  tone,
  label,
  stat,
  format: fmt,
  upIsBad,
  points,
  title,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  stat: Compared | undefined;
  format: (value: number) => string;
  upIsBad?: boolean;
  /** Compare in percentage points (for rates) instead of relative change. */
  points?: boolean;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-ink-100 bg-white p-5 shadow-card" title={title}>
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink-500">{label}</p>
        {stat === undefined ? (
          <span className="mt-1 block h-8 w-24 animate-pulse rounded bg-ink-100" />
        ) : (
          <p className="text-2xl leading-tight font-bold tracking-tight text-ink-900 sm:text-[1.7rem]">{stat.value === null ? "—" : fmt(stat.value)}</p>
        )}
        {stat && <Trend stat={stat} upIsBad={upIsBad} points={points} />}
      </div>
    </div>
  );
}

export function Trend({ stat, upIsBad, points }: { stat: Compared; upIsBad?: boolean; points?: boolean }) {
  const { value, previous } = stat;
  if (value === null) return <p className="mt-0.5 text-xs text-ink-500">No data for this period</p>;
  if (previous === null) return <p className="mt-0.5 text-xs text-ink-500">No data in previous period</p>;
  const diff = value - previous;
  const up = diff > 0;
  let change: string;
  if (points) change = `${formatNumber(Math.abs(diff), Math.abs(diff) % 1 ? 1 : 0)} pts`;
  else if (previous === 0) change = "new";
  else change = `${Math.round((Math.abs(diff) / previous) * 100)}%`;

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
      {diff === 0 ? (
        <span className="font-semibold text-ink-500">0%</span>
      ) : (
        <span className={cn("flex items-center gap-0.5 font-semibold", up !== !!upIsBad ? "text-emerald-600" : "text-brand-600")}>
          {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          {change}
        </span>
      )}
      <span className="basis-full text-ink-500">vs. previous period</span>
    </p>
  );
}

export function ChartCard({
  icon,
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("flex min-w-0 flex-col", className)}>
      <CardHeader icon={icon} title={title} action={action} className="items-center gap-2 border-b-0 px-4 pb-1 [&_h2]:whitespace-nowrap" />
      <div className={cn("h-64 px-4 pb-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg bg-ink-50/60 px-6 text-center">
      <BarChart3 className="h-8 w-8 text-ink-300" aria-hidden />
      <p className="max-w-64 text-sm text-ink-500">{text}</p>
    </div>
  );
}

export function MiniSelect({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="input h-8 w-auto py-0 pr-7 pl-2.5 text-xs">
      {children}
    </select>
  );
}

export function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("rounded-md p-1.5 transition hover:bg-ink-100 hover:text-ink-900", active ? "bg-brand-50 text-brand-600" : "text-ink-500")}
    >
      {children}
    </button>
  );
}
