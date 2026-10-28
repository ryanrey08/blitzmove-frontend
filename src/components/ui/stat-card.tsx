import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  red: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  gray: "bg-ink-100 text-ink-600",
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof tones;
  hint?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, tone = "red", hint, loading }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-ink-100 bg-white p-4 shadow-card sm:p-5">
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14", tones[tone])}>
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-600">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-7 w-16 animate-pulse rounded bg-ink-100" />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-ink-900 sm:text-[1.7rem]">{value}</p>
        )}
        {hint && <p className="truncate text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}
