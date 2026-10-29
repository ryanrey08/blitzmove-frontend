"use client";

import { endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

/** Date range button with a From/To popover and This month / Last month presets (values are yyyy-MM-dd). */
export function DateRangeFilter({ from, to, onChange, emptyLabel = "All dates" }: { from: string; to: string; onChange: (from: string, to: string) => void; emptyLabel?: string }) {
  const label = from || to ? `${from ? format(parseISO(from), "MMM dd, yyyy") : "…"} - ${to ? format(parseISO(to), "MMM dd, yyyy") : "…"}` : emptyLabel;
  const preset = (start: Date, end: Date) => onChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="input flex items-center gap-2 text-left" aria-expanded={open}>
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-500" />
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 space-y-3 rounded-lg border border-ink-100 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-ink-500">
              From
              <Input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className="mt-1" />
            </label>
            <label className="text-xs text-ink-500">
              To
              <Input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className="mt-1" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => preset(startOfMonth(new Date()), endOfMonth(new Date()))}>
              This month
            </Button>
            <Button size="sm" variant="secondary" onClick={() => preset(startOfMonth(subMonths(new Date(), 1)), endOfMonth(subMonths(new Date(), 1)))}>
              Last month
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange("", "")}>
              Clear
            </Button>
          </div>
          <Button size="sm" className="w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
