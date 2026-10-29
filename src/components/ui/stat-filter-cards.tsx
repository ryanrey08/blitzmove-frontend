"use client";

import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatFilterCard {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Icon tile classes, e.g. "bg-amber-50 text-amber-600". */
  tone: string;
  count: number | undefined;
  /** Created this month vs. last month; shows the change under the count. */
  trend?: { current: number; previous: number };
  /** Shown under the count when there is no trend. */
  hint?: string;
}

function Trend({ current, previous, noun }: { current: number; previous: number; noun: string }) {
  if (!current && !previous) return <span className="block text-xs text-ink-400">None this month</span>;
  if (!previous) return <span className="block text-xs text-ink-500">{current} {noun} this month</span>;
  const change = Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return (
    <span className="block text-xs text-ink-500">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-emerald-600" : "text-brand-600")}>
        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(change)}%
      </span>{" "}
      vs. last month
    </span>
  );
}

/** Row of status cards (Orders-page style); clicking a card filters the table by it. */
export function StatFilterCards({
  cards,
  active,
  onSelect,
  loading,
  trendNoun = "added",
  className,
}: {
  cards: StatFilterCard[];
  active: string;
  onSelect: (key: string) => void;
  loading?: boolean;
  trendNoun?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 grid grid-cols-2 gap-3 md:grid-cols-3", cards.length >= 6 ? "xl:grid-cols-6" : cards.length === 5 ? "xl:grid-cols-5" : "xl:grid-cols-4", className)}>
      {cards.map((card) => {
        const selected = active === card.key;
        return (
          <button
            key={card.key || "all"}
            type="button"
            onClick={() => onSelect(card.key)}
            aria-pressed={selected}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-card transition hover:border-ink-200",
              selected ? "border-brand-300 ring-2 ring-brand-100" : "border-ink-100",
            )}
          >
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", card.tone)}>
              <card.icon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink-600">{card.label}</span>
              {loading || card.count === undefined ? (
                <span className="mt-1 block h-7 w-12 animate-pulse rounded bg-ink-100" />
              ) : (
                <span className="block text-2xl font-bold text-ink-900">{card.count}</span>
              )}
              {!loading && card.trend && <Trend {...card.trend} noun={trendNoun} />}
              {!loading && !card.trend && card.hint && <span className="block truncate text-xs text-ink-500">{card.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
