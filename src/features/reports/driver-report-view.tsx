"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock, FileSpreadsheet, Timer, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { DRIVER_STATUS, statusOptions } from "@/lib/constants";
import { exportCsv } from "@/lib/export";
import { cn, formatNumber } from "@/lib/utils";
import type { DriverStatus } from "@/types/api";
import { DRIVERS_PATH } from "../drivers/drivers-view";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { reportsService, type DriverReportRow } from "./api";
import { GRAY, RankBars, StackedRankBars } from "./ops-report-charts";
import { ReportConfigPanel, ReportHeader, ReportLayout, TABLE_CELL, TableCard, compact, focusPanel, formatHours, monthPeriod, percent, useLocalTable, useReportConfig } from "./report-page";
import { ChartCard, ChartEmpty, Stat } from "./report-widgets";

const PAGE_PATH = "/reports/drivers";

interface Config {
  from: string;
  to: string;
  vehicle_id: string;
  driver_id: string;
  driver_status: string;
}

const defaults = (): Config => ({ ...monthPeriod(), vehicle_id: "", driver_id: "", driver_status: "" });

const text = (d: DriverReportRow) => `${d.full_name} ${d.employee_code} ${d.phone}`;
const sortValue = (d: DriverReportRow, key: string) => (d as unknown as Record<string, string | number | null>)[key] ?? null;

export function DriverReportView() {
  const panelRef = useRef<HTMLDivElement>(null);
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const config = useReportConfig(defaults, ["drivers"]);
  const { draft, applied } = config;
  const [search, setSearch] = useState("");

  const filters = useMemo(() => compact(applied), [applied]);
  const report = useQuery({
    queryKey: ["drivers", "report", filters],
    queryFn: () => reportsService.drivers(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: config.ready,
  });
  const r = report.data;
  const table = useLocalTable(r?.drivers, { search, text, sortValue, initialSort: "-trips" });
  const filterCount = [applied.vehicle_id, applied.driver_id, applied.driver_status].filter(Boolean).length;
  const withTrips = (r?.drivers ?? []).filter((d) => d.trips > 0);

  const exportDrivers = () =>
    exportCsv(
      "driver-report",
      ["Driver", "Employee Code", "Phone", "Status", "Trips", "Completed", "Pending", "Cancelled", "Completion Rate (%)", "On-Time Rate (%)", "Driving Hours", "Distance (km)"],
      table.all.map((d) => [
        d.full_name,
        d.employee_code,
        d.phone,
        d.status ? (DRIVER_STATUS[d.status as DriverStatus]?.label ?? d.status) : "",
        d.trips,
        d.completed,
        d.pending,
        d.cancelled,
        d.completion_rate,
        d.on_time_rate,
        d.driving_hours,
        d.distance_km,
      ]),
    );

  const exportSummary = () => {
    if (!r) return;
    const s = r.stats;
    exportCsv("driver-report-summary", ["Driver Report", `${r.period.from} to ${r.period.to}`, ""], [
      ["Metric", "This period", "Previous period"],
      ["Drivers with trips", s.active_drivers.value, s.active_drivers.previous],
      ["Total trips", s.total_trips.value, s.total_trips.previous],
      ["Completion rate (%)", s.completion_rate.value, s.completion_rate.previous],
      ["On-time rate (%)", s.on_time_rate.value, s.on_time_rate.previous],
      ["Driving hours", s.driving_hours.value, s.driving_hours.previous],
    ]);
  };

  const columns: Column<DriverReportRow>[] = [
    { key: "index", header: "#", cell: (d) => <span className="text-ink-500">{table.offset + (table.rows?.indexOf(d) ?? 0) + 1}</span>, className: "w-10" },
    {
      key: "driver",
      header: "Driver",
      sortKey: "full_name",
      cell: (d) => (
        <span className="block whitespace-nowrap">
          <Link href={`${DRIVERS_PATH}/${d.id}`} className="font-medium text-ink-900 hover:text-brand-600">
            {d.full_name}
          </Link>
          <span className="block text-ink-500">{d.employee_code}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (d) => <StatusBadge status={d.status as DriverStatus | null} map={DRIVER_STATUS} /> },
    { key: "trips", header: "Assigned Trips", sortKey: "trips", className: "tabular-nums", cell: (d) => formatNumber(d.trips) },
    { key: "completed", header: "Completed", sortKey: "completed", className: "tabular-nums text-emerald-700", cell: (d) => formatNumber(d.completed) },
    { key: "pending", header: "Pending", sortKey: "pending", className: "tabular-nums text-amber-700", cell: (d) => formatNumber(d.pending) },
    { key: "cancelled", header: "Cancelled", sortKey: "cancelled", className: "tabular-nums text-ink-500", cell: (d) => formatNumber(d.cancelled) },
    { key: "completion", header: "Completion", sortKey: "completion_rate", className: "tabular-nums", cell: (d) => (d.completion_rate === null ? "—" : percent(d.completion_rate)) },
    { key: "on_time", header: "On-Time", sortKey: "on_time_rate", className: "tabular-nums", cell: (d) => (d.on_time_rate === null ? "—" : percent(d.on_time_rate)) },
    { key: "hours", header: "Driving Hours", sortKey: "driving_hours", className: "tabular-nums whitespace-nowrap", cell: (d) => (d.completed ? formatHours(d.driving_hours) : "—") },
    { key: "distance", header: "Distance", sortKey: "distance_km", className: "tabular-nums whitespace-nowrap", cell: (d) => (d.distance_km === null ? "—" : `${formatNumber(d.distance_km)} km`) },
  ];

  const outcomes = [...withTrips]
    .sort((a, b) => b.trips - a.trips)
    .slice(0, 8)
    .map((d) => ({ label: d.full_name, completed: d.completed, pending: d.pending, cancelled: d.cancelled }));
  const onTime = withTrips.filter((d) => d.on_time_rate !== null).map((d) => ({ label: d.full_name, value: d.on_time_rate! }));

  return (
    <div>
      <ReportHeader title="Driver Report" subtitle="Track driver activity, trip outcomes, punctuality and hours on the road." crumb="Driver Reports" path={PAGE_PATH} />

      <ReportLayout
        config={
          <ReportConfigPanel
            panelRef={panelRef}
            period={draft}
            onPeriodChange={config.setPeriod}
            periodHint="Trips departing in this period."
            onReset={() => {
              config.reset();
              setSearch("");
              table.resetPage();
            }}
            onGenerate={() => {
              config.generate();
              table.resetPage();
            }}
            loading={report.isFetching && !report.isLoading}
            dirty={config.dirty}
          >
            <Field label="Driver" htmlFor="dr-driver">
              <Select id="dr-driver" value={draft.driver_id} onChange={(e) => config.set("driver_id", e.target.value)} options={driverOptions} placeholder="All Drivers" />
            </Field>
            <Field label="Vehicle" htmlFor="dr-vehicle" hint="Only drivers who drove this vehicle.">
              <Select id="dr-vehicle" value={draft.vehicle_id} onChange={(e) => config.set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" />
            </Field>
            <Field label="Driver Status" htmlFor="dr-status">
              <Select id="dr-status" value={draft.driver_status} onChange={(e) => config.set("driver_status", e.target.value)} options={statusOptions(DRIVER_STATUS)} placeholder="All Statuses" />
            </Field>
          </ReportConfigPanel>
        }
      >
        {report.error && <ErrorState className="rounded-xl border border-ink-100 bg-white" message={report.error.message} onRetry={() => report.refetch()} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat icon={Users} tone="bg-blue-50 text-blue-600" label="Drivers with Trips" stat={r?.stats.active_drivers} format={(v) => formatNumber(v)} title="Drivers with at least one trip departing in the period" />
          <Stat icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" label="Completion Rate" stat={r?.stats.completion_rate} format={percent} points title="Completed trips ÷ trips that were not cancelled" />
          <Stat icon={Clock} tone="bg-orange-50 text-orange-500" label="On-Time Rate" stat={r?.stats.on_time_rate} format={percent} points title="Completed trips that arrived by their estimated arrival time" />
          <Stat icon={Timer} tone="bg-violet-50 text-violet-600" label="Driving Hours" stat={r?.stats.driving_hours} format={formatHours} title="Actual departure to actual arrival of completed trips" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard icon={<BarChart3 />} title="Trip Outcomes by Driver" bodyClassName="h-72">
            {!r ? (
              <LoadingState />
            ) : outcomes.length ? (
              <StackedRankBars
                data={outcomes}
                series={[
                  { key: "completed", label: "Completed", color: "#16a34a" },
                  { key: "pending", label: "Pending", color: "#f59e0b" },
                  { key: "cancelled", label: "Cancelled", color: GRAY },
                ]}
              />
            ) : (
              <ChartEmpty text="No driver has trips in this period." />
            )}
          </ChartCard>
          <ChartCard icon={<Clock />} title="On-Time Rate by Driver" bodyClassName="h-72">
            {!r ? <LoadingState /> : onTime.length ? <RankBars data={onTime} format={percent} name="On-time rate" limit={8} colorful={false} /> : <ChartEmpty text="No completed trips with an arrival time in this period." />}
          </ChartCard>
        </div>

        <TableCard
          icon={<UserRound />}
          title="Driver Performance"
          search={search}
          onSearch={(v) => {
            setSearch(v);
            table.resetPage();
          }}
          searchPlaceholder="Search drivers..."
          filterCount={filterCount}
          onFilter={() => focusPanel(panelRef)}
          exportItems={[
            { label: "Drivers (Excel CSV)", icon: <FileSpreadsheet />, disabled: !table.all.length, onSelect: exportDrivers },
            { label: "Report summary (Excel CSV)", icon: <BarChart3 />, disabled: !r, onSelect: exportSummary },
          ]}
        >
          <DataTable
            columns={columns.map((c) => ({ ...c, className: cn(TABLE_CELL, c.className), headerClassName: cn("px-3", c.headerClassName) }))}
            rows={table.rows}
            rowKey={(d) => d.id}
            loading={report.isFetching}
            sort={table.sort}
            onSortChange={table.setSort}
            empty={search || filterCount ? { title: "No drivers match", description: "Try a different search, or change the filters in Report Configuration." } : { title: "No drivers yet", description: "Drivers you add appear here." }}
          />
          <Pagination meta={r ? table.meta : undefined} onPageChange={table.setPage} perPage={table.perPage} onPerPageChange={table.setPerPage} noun="drivers" showEdges />
        </TableCard>
      </ReportLayout>
    </div>
  );
}
