"use client";

import { cn } from "@/lib/utils";

interface TabsProps<V extends string> {
  value: V;
  onChange: (value: V) => void;
  tabs: { value: V; label: string; count?: number }[];
  className?: string;
}

export function Tabs<V extends string>({ value, onChange, tabs, className }: TabsProps<V>) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto border-b border-ink-100", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition",
            tab.value === value ? "border-brand-600 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn("rounded-full px-1.5 text-xs", tab.value === value ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-600")}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
