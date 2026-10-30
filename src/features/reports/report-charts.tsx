"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { TRIP_STATUS_COLORS, type TripStatusSlice } from "./api";

const AXIS = { fontSize: 11, fill: "#667085" };
const TOOLTIP = { borderRadius: 8, borderColor: "#eceef2", fontSize: 12 };

/** Ticks on the 1st, 7th, 14th, 21st and 28th of each month, plus the first day shown. */
function dayTicks(dates: string[]) {
  if (dates.length <= 10) return dates;
  return dates.filter((d, i) => i === 0 || ["01", "07", "14", "21", "28"].includes(d.slice(8)));
}

export function DistanceChart({ data }: { data: { date: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="distance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eceef2" />
        <XAxis dataKey="date" ticks={dayTicks(data.map((d) => d.date))} tickFormatter={(d) => formatDate(d, "MMM d")} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => formatNumber(v)} />
        <Tooltip contentStyle={TOOLTIP} labelFormatter={(d) => formatDate(String(d), "EEE, MMM d")} formatter={(v) => [`${formatNumber(Number(v), 1)} km`, "Distance"]} />
        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#distance-fill)" dot={{ r: 2.5, fill: "#3b82f6", strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FuelChart({ data, unit }: { data: { date: string; value: number }[]; unit: "liters" | "cost" }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="#eceef2" />
        <XAxis dataKey="date" ticks={dayTicks(data.map((d) => d.date))} tickFormatter={(d) => formatDate(d, "MMM d")} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => formatNumber(v)} />
        <Tooltip
          cursor={{ fill: "rgba(16,24,40,0.04)" }}
          contentStyle={TOOLTIP}
          labelFormatter={(d) => formatDate(String(d), "EEE, MMM d")}
          formatter={(v) => [unit === "cost" ? formatCurrency(Number(v)) : `${formatNumber(Number(v), 1)} L`, unit === "cost" ? "Fuel cost" : "Fuel"]}
        />
        <Bar dataKey="value" fill="#f87171" radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut with the total in the middle and "count (pct%)" legend; `compact` stacks a smaller version. */
export function TripStatusDonut({ data, compact = false }: { data: TripStatusSlice[]; compact?: boolean }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const slices = data.filter((d) => d.count > 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className={compact ? "flex items-center gap-3" : "flex w-full flex-col items-center gap-5 sm:flex-row xl:gap-4"}>
      <div className={compact ? "relative h-28 w-28 shrink-0" : "relative h-44 w-44 shrink-0 xl:h-36 xl:w-36 2xl:h-44 2xl:w-44"}>
        {total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="count" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={1.5} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                {slices.map((d) => (
                  <Cell key={d.key} fill={TRIP_STATUS_COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`${v} (${pct(Number(v))}%)`, ""]} separator="" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-full border-[14px] border-ink-100" aria-hidden />
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={compact ? "text-xl font-bold text-ink-900" : "text-3xl font-bold text-ink-900"}>{formatNumber(total)}</span>
          <span className="text-[0.7rem] text-ink-500">Total Trips</span>
        </div>
      </div>
      <ul className={compact ? "min-w-0 flex-1 space-y-1 text-[0.7rem]" : "w-full min-w-0 flex-1 space-y-2.5 text-sm"}>
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TRIP_STATUS_COLORS[d.key] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink-700">{d.label}</span>
            <span className="shrink-0 text-ink-900 tabular-nums">
              <span className="font-semibold">{formatNumber(d.count)}</span> <span className="text-ink-500">({pct(d.count)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DistancePerVehicleChart({ data }: { data: { plate: string; km: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid horizontal={false} stroke="#eceef2" />
        <XAxis type="number" tick={{ ...AXIS, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
        <YAxis type="category" dataKey="plate" interval={0} tick={{ ...AXIS, fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
        <Tooltip cursor={{ fill: "rgba(16,24,40,0.04)" }} contentStyle={TOOLTIP} formatter={(v) => [`${formatNumber(Number(v), 1)} km`, "Distance"]} />
        <Bar dataKey="km" fill="#3b82f6" radius={[0, 3, 3, 0]} maxBarSize={12} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
