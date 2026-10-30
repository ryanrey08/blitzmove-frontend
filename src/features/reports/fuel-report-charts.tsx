"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { FuelSlice } from "./api";

const AXIS = { fontSize: 11, fill: "#667085" };
const TOOLTIP = { borderRadius: 8, borderColor: "#eceef2", fontSize: 12 };

/** Slice colors in rank order (blue, green, amber, red, purple); "Others" is gray. */
export const FUEL_SLICE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#9333ea"];
export const OTHERS_COLOR = "#98a2b3";
export const FUEL_TYPE_COLORS: Record<string, string> = { diesel: "#2563eb", gasoline: "#f97316", electric: "#16a34a", lpg: "#9333ea" };

export type FuelMetric = "cost" | "liters" | "transactions";

export const formatFuelMetric = (metric: FuelMetric, value: number) =>
  metric === "cost" ? formatCurrency(value) : metric === "liters" ? `${formatNumber(value, value % 1 ? 1 : 0)} L` : formatNumber(value);

/** Short axis labels: 12,500 → 12.5k. */
const compact = (v: number) => (Math.abs(v) >= 1000 ? `${formatNumber(v / 1000, v % 1000 ? 1 : 0)}k` : formatNumber(v));

/** Ticks on the 1st, 7th, 14th, 21st and 28th of each month, plus the first and last day shown. */
function dayTicks(dates: string[]) {
  if (dates.length <= 10) return dates;
  return dates.filter((d, i) => i === 0 || i === dates.length - 1 || ["07", "14", "21", "28"].includes(d.slice(8)));
}

export function FuelTrendChart({ data, metric }: { data: { date: string; value: number }[]; metric: "liters" | "cost" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="fuel-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eceef2" />
        <XAxis dataKey="date" ticks={dayTicks(data.map((d) => d.date))} tickFormatter={(d) => formatDate(d, "MMM d")} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} tickFormatter={compact} />
        <Tooltip
          contentStyle={TOOLTIP}
          labelFormatter={(d) => formatDate(String(d), "EEE, MMM d")}
          formatter={(v) => [metric === "cost" ? formatCurrency(Number(v)) : `${formatNumber(Number(v), 2)} L`, metric === "cost" ? "Fuel cost" : "Fuel"]}
        />
        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#fuel-trend-fill)" dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 4.5 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** Top `limit` slices by liters, the rest folded into "Others". */
export function topSlices(slices: FuelSlice[], limit = 5): DonutSlice[] {
  const sorted = [...slices].sort((a, b) => b.liters - a.liters);
  const top = sorted.slice(0, limit).map((s, i) => ({ key: s.key, label: s.label, value: s.liters, color: FUEL_SLICE_COLORS[i % FUEL_SLICE_COLORS.length] }));
  const rest = sorted.slice(limit).reduce((sum, s) => sum + s.liters, 0);
  return rest > 0 ? [...top, { key: "__others", label: "Others", value: rest, color: OTHERS_COLOR }] : top;
}

/** Liters donut with the total in the middle; the legend shows liters and share, and stacks under the donut in narrow cards. */
export function FuelDonut({ slices, layout = "table" }: { slices: DonutSlice[]; layout?: "table" | "list" }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const visible = slices.filter((s) => s.value > 0);

  return (
    <div className="@container w-full">
      <div className="flex flex-col items-center gap-4 @[22rem]:flex-row @[22rem]:gap-5">
        <div className="relative h-40 w-40 shrink-0 @[26rem]:h-44 @[26rem]:w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={visible} dataKey="value" nameKey="label" innerRadius="60%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {visible.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
                <LabelList dataKey="value" position="inside" fill="#fff" fontSize={10} fontWeight={600} formatter={(v) => (pct(Number(v)) >= 8 ? `${pct(Number(v))}%` : "")} />
              </Pie>
              <Tooltip contentStyle={TOOLTIP} formatter={(v, name) => [`${formatNumber(Number(v), 1)} L (${pct(Number(v))}%)`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold whitespace-nowrap text-ink-900 tabular-nums @[26rem]:text-base">{formatNumber(total)} L</span>
            <span className="text-[0.7rem] text-ink-500">Total Fuel</span>
          </div>
        </div>
        {layout === "table" ? (
          <ul className="w-full min-w-0 flex-1 space-y-2.5 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2.5">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ink-800" title={s.label}>
                  {s.label}
                </span>
                <span className="shrink-0 text-ink-700 tabular-nums">{formatNumber(s.value)} L</span>
                <span className="w-10 shrink-0 text-right text-ink-700 tabular-nums">{pct(s.value)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="w-full min-w-0 flex-1 space-y-3 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex gap-2.5">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink-800">{s.label}</span>
                  <span className="text-ink-600 tabular-nums">
                    {formatNumber(s.value)} L ({pct(s.value)}%)
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Horizontal bars for the top `limit` slices by the chosen metric, value labels at the bar ends. */
export function FuelBarChart({ slices, metric, limit = 5, colorful = true }: { slices: FuelSlice[]; metric: FuelMetric; limit?: number; colorful?: boolean }) {
  const data = [...slices]
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, limit)
    .map((s, i) => ({ label: s.label, value: s[metric], color: colorful ? FUEL_SLICE_COLORS[i % FUEL_SLICE_COLORS.length] : FUEL_SLICE_COLORS[0] }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke="#eceef2" />
        <XAxis type="number" tick={{ ...AXIS, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={compact} allowDecimals={metric !== "transactions" ? undefined : false} />
        <YAxis type="category" dataKey="label" interval={0} tick={{ ...AXIS, fontSize: 11, fill: "#344054" }} axisLine={false} tickLine={false} width={76} tickFormatter={(v: string) => (v.length > 11 ? `${v.slice(0, 10)}…` : v)} />
        <Tooltip cursor={{ fill: "rgba(16,24,40,0.04)" }} contentStyle={TOOLTIP} formatter={(v) => [formatFuelMetric(metric, Number(v)), metric === "cost" ? "Total cost" : metric === "liters" ? "Fuel" : "Transactions"]} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={14} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
          <LabelList dataKey="value" position="right" fill="#344054" fontSize={10} formatter={(v) => formatFuelMetric(metric, Number(v))} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
