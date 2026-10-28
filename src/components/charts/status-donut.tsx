"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { TONE_HEX } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { Tone } from "@/lib/constants";
import type { StatusCount } from "@/types/api";

interface StatusDonutProps<S extends string> {
  data: StatusCount<S>[];
  map: Record<S, { label: string; tone: Tone }>;
  centerLabel: string;
}

/** Donut with a total in the middle and a labelled legend (identity never relies on color alone). */
export function StatusDonut<S extends string>({ data, map, centerLabel }: StatusDonutProps<S>) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <EmptyState title="No data yet" className="py-8" />;

  const slices = data.filter((d) => d.count > 0);

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @md:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={slices} dataKey="count" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={1.5} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {slices.map((d) => (
                <Cell key={d.status} fill={TONE_HEX[map[d.status]?.tone ?? "gray"]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [`${value} (${Math.round((Number(value) / total) * 100)}%)`, ""]}
              separator=""
              contentStyle={{ borderRadius: 8, borderColor: "#eceef2", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-ink-900">{total}</span>
          <span className="text-xs text-ink-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5 text-sm">
        {data.map((d) => (
          <li key={d.status} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TONE_HEX[map[d.status]?.tone ?? "gray"] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-700">{map[d.status]?.label ?? d.label}</span>
            <span className="font-semibold text-ink-900 tabular-nums">{d.count}</span>
            <span className="w-10 shrink-0 text-right text-xs text-ink-500 tabular-nums">{Math.round((d.count / total) * 100)}%</span>
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
}
