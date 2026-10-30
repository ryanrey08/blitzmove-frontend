"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatNumber } from "@/lib/utils";

/** Generic charts for the Trip, Driver, Maintenance, Utilization and Delivery report pages. */

const AXIS = { fontSize: 11, fill: "#667085" };
const TOOLTIP = { borderRadius: 8, borderColor: "#eceef2", fontSize: 12 };

/** Rank colors (blue, green, amber, red, purple) as on the Fuel Report; gray for "Others". */
export const RANK_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#9333ea"];
export const GRAY = "#98a2b3";

const short = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumber(v / 1000, v % 1000 ? 1 : 0)}k` : formatNumber(v));

function dayTicks(dates: string[]) {
  if (dates.length <= 10) return dates;
  return dates.filter((d, i) => i === 0 || i === dates.length - 1 || ["07", "14", "21", "28"].includes(d.slice(8)));
}

export interface Series {
  key: string;
  label: string;
  color: string;
}

/** Side-by-side bars per day for one or more counts. */
export function DailyBars<T extends { date: string }>({ data, series, unit = "" }: { data: T[]; series: Series[]; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="20%" barGap={1}>
        <CartesianGrid vertical={false} stroke="#eceef2" />
        <XAxis dataKey="date" ticks={dayTicks(data.map((d) => d.date))} tickFormatter={(d) => formatDate(d, "MMM d")} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} allowDecimals={false} tickFormatter={short} />
        <Tooltip
          cursor={{ fill: "rgba(16,24,40,0.04)" }}
          contentStyle={TOOLTIP}
          labelFormatter={(d) => formatDate(String(d), "EEE, MMM d")}
          formatter={(v, name) => [`${formatNumber(Number(v))}${unit}`, name]}
        />
        {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={12} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Donut with the total in the middle and a "value (pct%)" legend. */
export function CountDonut({ slices, centerLabel, format = (v: number) => formatNumber(v) }: { slices: Slice[]; centerLabel: string; format?: (v: number) => string }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const visible = slices.filter((s) => s.value > 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="@container w-full">
      <div className="flex flex-col items-center gap-4 @[22rem]:flex-row @[22rem]:gap-5">
        <div className="relative h-40 w-40 shrink-0">
          {total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={visible} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={1.5} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {visible.map((s) => (
                    <Cell key={s.key} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP} formatter={(v, name) => [`${format(Number(v))} (${pct(Number(v))}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full rounded-full border-[14px] border-ink-100" aria-hidden />
          )}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-ink-900 tabular-nums">{format(total)}</span>
            <span className="text-[0.7rem] text-ink-500">{centerLabel}</span>
          </div>
        </div>
        <ul className="w-full min-w-0 flex-1 space-y-2.5 text-sm">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink-800" title={s.label}>
                {s.label}
              </span>
              <span className="shrink-0 font-semibold text-ink-900 tabular-nums">{format(s.value)}</span>
              <span className="w-10 shrink-0 text-right text-ink-500 tabular-nums">{pct(s.value)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Horizontal bars for the top `limit` items, largest first. */
export function RankBars({ data, format = (v: number) => formatNumber(v), name, limit = 6, colorful = true }: { data: { label: string; value: number }[]; format?: (v: number) => string; name: string; limit?: number; colorful?: boolean }) {
  const rows = data
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map((d, i) => ({ ...d, color: colorful ? RANK_COLORS[i % RANK_COLORS.length] : RANK_COLORS[0] }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke="#eceef2" />
        <XAxis type="number" tick={{ ...AXIS, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={short} />
        <YAxis type="category" dataKey="label" interval={0} tick={{ ...AXIS, fill: "#344054" }} axisLine={false} tickLine={false} width={88} tickFormatter={(v: string) => (v.length > 13 ? `${v.slice(0, 12)}…` : v)} />
        <Tooltip cursor={{ fill: "rgba(16,24,40,0.04)" }} contentStyle={TOOLTIP} formatter={(v) => [format(Number(v)), name]} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false}>
          {rows.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal stacked bars (e.g. completed / pending / cancelled trips per driver). */
export function StackedRankBars<T extends { label: string }>({ data, series }: { data: T[]; series: Series[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke="#eceef2" />
        <XAxis type="number" tick={{ ...AXIS, fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" interval={0} tick={{ ...AXIS, fill: "#344054" }} axisLine={false} tickLine={false} width={96} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
        <Tooltip cursor={{ fill: "rgba(16,24,40,0.04)" }} contentStyle={TOOLTIP} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} maxBarSize={14} radius={i === series.length - 1 ? [0, 3, 3, 0] : undefined} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
