"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, FileSpreadsheet, Gauge, PauseCircle, Route, Timer, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { VEHICLE_STATUS, VEHICLE_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { exportCsv } from "@/lib/export";
import { cn, formatNumber } from "@/lib/utils";
import type { VehicleStatus } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { reportsService, type UtilizationRow } from "./api";
import { DailyBars, RankBars } from "./ops-report-charts";
import { ReportConfigPanel, ReportHeader, ReportLayout, TABLE_CELL, TableCard, compact, focusPanel, formatHours, monthPeriod, percent, useLocalTable, useReportConfig } from "./report-page";
import { ChartCard, ChartEmpty, Stat } from "./report-widgets";

const PAGE_PATH = "/reports/utilization";

interface Config {
  from: string;
  to: string;
  vehicle_id: string;
  driver_id: string;
  vehicle_type: string;
  vehicle_status: string;
}

const defaults = (): Config => ({ ...monthPeriod(), vehicle_id: "", driver_id: "", vehicle_type: "", vehicle_status: "" });

const text = (v: UtilizationRow) => `${v.plate_number} ${v.make ?? ""} ${v.model ?? ""}`;
const sortValue = (v: UtilizationRow, key: string) => (v as unknown as Record<string, string | number | null>)[key] ?? null;

/** Bar color by utilization band. */
function Meter({ value }: { value: number }) {
  const color = value >= 60 ? "bg-emerald-500" : value >= 30 ? "bg-amber-500" : "bg-brand-500";
  return (
    <span className="flex min-w-28 items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100" aria-hidden>
        <span className={cn("block h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="w-12 text-right tabular-nums">{percent(value)}</span>
    </span>
  );
}

export function UtilizationReportView() {
  const panelRef = useRef<HTMLDivElement>(null);
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const config = useReportConfig(defaults, ["vehicles"]);
  const { draft, applied } = config;
  const [search, setSearch] = useState("");

  const filters = useMemo(() => compact(applied), [applied]);
  const report = useQuery({
    queryKey: ["vehicles", "utilization-report", filters],
    queryFn: () => reportsService.utilization(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: config.ready,
  });
  const r = report.data;
  const table = useLocalTable(r?.vehicles, { search, text, sortValue, initialSort: "-utilization_rate" });
  const filterCount = [applied.vehicle_id, applied.driver_id, applied.vehicle_type, applied.vehicle_status].filter(Boolean).length;
  const hasActivity = !!r?.stats.active_vehicles.value;

  const exportVehicles = () =>
    exportCsv(
      "utilization-report",
      ["Vehicle", "Make / Model", "Type", "Current Status", "Trips", "Completed Trips", "Days on Trips", "Utilization (%)", "Active Hours", "Idle Hours", "Distance (km)"],
      table.all.map((v) => [
        v.plate_number,
        [v.make, v.model].filter(Boolean).join(" "),
        v.vehicle_type ? labelOf(VEHICLE_TYPES, v.vehicle_type) : "",
        v.status ? (VEHICLE_STATUS[v.status as VehicleStatus]?.label ?? v.status) : "",
        v.trips,
        v.completed_trips,
        v.active_days,
        v.utilization_rate,
        v.active_hours,
        v.idle_hours,
        v.distance_km,
      ]),
    );

  const exportSummary = () => {
    if (!r) return;
    const s = r.stats;
    exportCsv("utilization-report-summary", ["Utilization Report", `${r.period.from} to ${r.period.to}`, ""], [
      ["Metric", "This period", "Previous period"],
      ["Average utilization (%)", s.utilization_rate.value, s.utilization_rate.previous],
      ["Active vehicles", s.active_vehicles.value, s.active_vehicles.previous],
      ["Idle vehicles", s.idle_vehicles.value, s.idle_vehicles.previous],
      ["Active hours", s.active_hours.value, s.active_hours.previous],
      ["Distance (km)", s.distance_km.value, s.distance_km.previous],
      [],
      ["Date", "Vehicles on the road", ""],
      ...r.daily.map((d) => [d.date, d.active_vehicles, ""]),
    ]);
  };

  const columns: Column<UtilizationRow>[] = [
    { key: "index", header: "#", cell: (v) => <span className="text-ink-500">{table.offset + (table.rows?.indexOf(v) ?? 0) + 1}</span>, className: "w-10" },
    {
      key: "vehicle",
      header: "Vehicle",
      sortKey: "plate_number",
      cell: (v) => (
        <span className="block whitespace-nowrap">
          <Link href={`/fleet/vehicles/${v.id}`} className="font-medium text-ink-900 hover:text-brand-600">
            {v.plate_number}
          </Link>
          <span className="block text-ink-500">{[v.make, v.model].filter(Boolean).join(" ") || "—"}</span>
        </span>
      ),
    },
    { key: "type", header: "Type", cell: (v) => (v.vehicle_type ? labelOf(VEHICLE_TYPES, v.vehicle_type) : "—") },
    { key: "status", header: "Current Status", cell: (v) => <StatusBadge status={v.status as VehicleStatus | null} map={VEHICLE_STATUS} /> },
    { key: "trips", header: "Trips", sortKey: "trips", className: "tabular-nums", cell: (v) => formatNumber(v.trips) },
    { key: "days", header: "Days on Trips", sortKey: "active_days", className: "tabular-nums", cell: (v) => formatNumber(v.active_days) },
    { key: "active", header: "Active Time", sortKey: "active_hours", className: "tabular-nums whitespace-nowrap", cell: (v) => formatHours(v.active_hours) },
    { key: "idle", header: "Idle Time", sortKey: "idle_hours", className: "tabular-nums whitespace-nowrap", cell: (v) => formatHours(v.idle_hours) },
    { key: "distance", header: "Distance", sortKey: "distance_km", className: "tabular-nums whitespace-nowrap", cell: (v) => (v.distance_km === null ? "—" : `${formatNumber(v.distance_km)} km`) },
    { key: "rate", header: "Utilization", sortKey: "utilization_rate", cell: (v) => <Meter value={v.utilization_rate} /> },
  ];

  return (
    <div>
      <ReportHeader title="Utilization Report" subtitle="See how much of the period each vehicle spent on trips, and which vehicles sat idle." crumb="Utilization Reports" path={PAGE_PATH} />

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
            <Field label="Vehicle" htmlFor="ur-vehicle">
              <Select id="ur-vehicle" value={draft.vehicle_id} onChange={(e) => config.set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" />
            </Field>
            <Field label="Vehicle Type" htmlFor="ur-type">
              <Select id="ur-type" value={draft.vehicle_type} onChange={(e) => config.set("vehicle_type", e.target.value)} options={VEHICLE_TYPES} placeholder="All Types" />
            </Field>
            <Field label="Current Status" htmlFor="ur-status">
              <Select id="ur-status" value={draft.vehicle_status} onChange={(e) => config.set("vehicle_status", e.target.value)} options={statusOptions(VEHICLE_STATUS)} placeholder="All Statuses" />
            </Field>
            <Field label="Driver" htmlFor="ur-driver" hint="Only that driver's trips and vehicles.">
              <Select id="ur-driver" value={draft.driver_id} onChange={(e) => config.set("driver_id", e.target.value)} options={driverOptions} placeholder="All Drivers" />
            </Field>
          </ReportConfigPanel>
        }
      >
        {report.error && <ErrorState className="rounded-xl border border-ink-100 bg-white" message={report.error.message} onRetry={() => report.refetch()} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat icon={Gauge} tone="bg-blue-50 text-blue-600" label="Avg. Fleet Utilization" stat={r?.stats.utilization_rate} format={percent} points title="Average over vehicles of days on a trip ÷ days in the period" />
          <Stat icon={Activity} tone="bg-emerald-50 text-emerald-600" label="Active Vehicles" stat={r?.stats.active_vehicles} format={(v) => formatNumber(v)} title="Vehicles with at least one trip (not cancelled) departing in the period" />
          <Stat icon={PauseCircle} tone="bg-orange-50 text-orange-500" label="Idle Vehicles" stat={r?.stats.idle_vehicles} format={(v) => formatNumber(v)} upIsBad title="Vehicles with no trip in the period" />
          <Stat icon={Timer} tone="bg-violet-50 text-violet-600" label="Active Time" stat={r?.stats.active_hours} format={formatHours} title="Time on trips: departure until actual (else estimated) arrival, overlaps counted once" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <ChartCard icon={<BarChart3 />} title="Vehicles on the Road per Day" className="lg:col-span-3">
            {!r ? <LoadingState /> : hasActivity ? <DailyBars data={r.daily} series={[{ key: "active_vehicles", label: "Vehicles", color: "#3b82f6" }]} /> : <ChartEmpty text="No vehicle has a trip in this period." />}
          </ChartCard>
          <ChartCard icon={<Gauge />} title="Utilization by Vehicle" className="lg:col-span-2">
            {!r ? (
              <LoadingState />
            ) : hasActivity ? (
              <RankBars data={r.vehicles.map((v) => ({ label: v.plate_number, value: v.utilization_rate }))} format={percent} name="Utilization" limit={6} />
            ) : (
              <ChartEmpty text="No vehicle has a trip in this period." />
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat icon={Route} tone="bg-sky-50 text-sky-600" label="Distance Traveled" stat={r?.stats.distance_km} format={(v) => `${formatNumber(v)} km`} title="Kilometres between odometer readings on fuel records" />
          <Stat icon={Truck} tone="bg-ink-100 text-ink-600" label="Vehicles in Report" stat={r ? { value: r.vehicles.length, previous: null } : undefined} format={(v) => formatNumber(v)} caption="Matching the filters" />
        </div>

        <TableCard
          icon={<Truck />}
          title="Vehicle Utilization"
          search={search}
          onSearch={(v) => {
            setSearch(v);
            table.resetPage();
          }}
          searchPlaceholder="Search vehicles..."
          filterCount={filterCount}
          onFilter={() => focusPanel(panelRef)}
          exportItems={[
            { label: "Vehicles (Excel CSV)", icon: <FileSpreadsheet />, disabled: !table.all.length, onSelect: exportVehicles },
            { label: "Report summary (Excel CSV)", icon: <BarChart3 />, disabled: !r, onSelect: exportSummary },
          ]}
        >
          <DataTable
            columns={columns.map((c) => ({ ...c, className: cn(TABLE_CELL, c.className), headerClassName: cn("px-3", c.headerClassName) }))}
            rows={table.rows}
            rowKey={(v) => v.id}
            loading={report.isFetching}
            sort={table.sort}
            onSortChange={table.setSort}
            empty={search || filterCount ? { title: "No vehicles match", description: "Try a different search, or change the filters in Report Configuration." } : { title: "No vehicles yet", description: "Vehicles you add appear here." }}
          />
          <Pagination meta={r ? table.meta : undefined} onPageChange={table.setPage} perPage={table.perPage} onPerPageChange={table.setPerPage} noun="vehicles" showEdges />
        </TableCard>
      </ReportLayout>
    </div>
  );
}
