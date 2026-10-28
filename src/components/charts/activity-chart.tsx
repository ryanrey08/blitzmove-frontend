"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate } from "@/lib/utils";

interface ActivityChartProps {
  data: { date: string; orders: number; trips_completed: number }[];
}

const SERIES = [
  { key: "orders", label: "Orders created", color: "#e30613" },
  { key: "trips_completed", label: "Trips completed", color: "#0ea5e9" },
] as const;

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="#eceef2" />
          <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, "MMM d")} tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} minTickGap={12} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#667085" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "rgba(16,24,40,0.04)" }}
            labelFormatter={(d) => formatDate(String(d), "EEE, MMM d")}
            contentStyle={{ borderRadius: 8, borderColor: "#eceef2", fontSize: 12 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#3f4655" }} />
          {SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
