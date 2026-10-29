"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, ClipboardList, PlayCircle, Route, Send } from "lucide-react";
import { StatFilterCards, type StatFilterCard } from "@/components/ui/stat-filter-cards";
import { tripsService } from "@/services/resources";

const CARDS = [
  { key: "", label: "Total Trips", icon: Route, tone: "bg-brand-50 text-brand-600" },
  { key: "scheduled", label: "Scheduled", icon: ClipboardList, tone: "bg-indigo-50 text-indigo-600" },
  { key: "dispatched", label: "Dispatched", icon: Send, tone: "bg-orange-50 text-orange-600" },
  { key: "in_progress", label: "In Progress", icon: PlayCircle, tone: "bg-sky-50 text-sky-600" },
  { key: "completed", label: "Completed", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
  { key: "cancelled", label: "Cancelled", icon: Ban, tone: "bg-ink-100 text-ink-600" },
];

/**
 * Trip status cards (with month-over-month trend) that filter the page's table by status.
 * `statuses` limits what the first card totals (e.g. only open trips on Dispatch Management).
 */
export function TripStatusCards({ active, onSelect, statuses }: { active: string; onSelect: (status: string) => void; statuses?: string[] }) {
  const summary = useQuery({ queryKey: ["trips", "summary"], queryFn: tripsService.summary });
  const rows = summary.data?.data ?? [];
  const stat = (key: string) =>
    rows
      .filter((r) => (key ? r.status === key : !statuses || statuses.includes(r.status)))
      .reduce((acc, r) => ({ count: acc.count + r.count, current: acc.current + r.this_month, previous: acc.previous + r.last_month }), { count: 0, current: 0, previous: 0 });

  const cards: StatFilterCard[] = CARDS.map((c) => {
    const s = stat(c.key);
    return { ...c, label: !c.key && statuses ? "All Open" : c.label, count: summary.data ? s.count : undefined, trend: { current: s.current, previous: s.previous } };
  });

  return <StatFilterCards cards={cards} active={active} onSelect={onSelect} loading={summary.isLoading} trendNoun="created" />;
}
