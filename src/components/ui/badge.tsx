import type { ReactNode } from "react";
import type { Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

const tones: Record<Tone, string> = {
  gray: "bg-ink-100 text-ink-700 ring-ink-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  orange: "bg-orange-50 text-orange-700 ring-orange-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

const dots: Record<Tone, string> = {
  gray: "bg-ink-400",
  red: "bg-red-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
};

export function Badge({ tone = "gray", children, dot = false, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dots[tone])} aria-hidden />}
      {children}
    </span>
  );
}

/** Renders a status using one of the status maps in lib/constants. */
export function StatusBadge<S extends string>({
  status,
  map,
  dot = true,
}: {
  status: S | null | undefined;
  map: Record<S, { label: string; tone: Tone }>;
  dot?: boolean;
}) {
  if (!status) return <span className="text-ink-400">—</span>;
  const entry = map[status] ?? { label: status, tone: "gray" as Tone };
  return (
    <Badge tone={entry.tone} dot={dot}>
      {entry.label}
    </Badge>
  );
}

export const TONE_HEX: Record<Tone, string> = {
  gray: "#98a2b3",
  red: "#e30613",
  amber: "#f59e0b",
  orange: "#f97316",
  green: "#16a34a",
  blue: "#0ea5e9",
  indigo: "#6366f1",
  violet: "#8b5cf6",
};
