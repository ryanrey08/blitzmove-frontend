"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock, FileSpreadsheet, PieChart as PieChartIcon, Route, Timer, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { TRIP_STATUS, statusOptions } from "@/lib/constants";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { tripsService } from "@/services/resources";
import type { ListParams, Trip } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { TRIPS_PATH } from "../trips/trip-schedule-view";
import { TRIP_STATUS_COLORS, reportsService } from "./api";
import { CountDonut, DailyBars } from "./ops-report-charts";
import {
  ReportConfigPanel,
  ReportHeader,
  ReportLayout,
  TABLE_CELL,
  TableCard,
  compact,
  focusPanel,
  formatHours,
  hoursBetween,
  monthPeriod,
  percent,
  useReportConfig,
} from "./report-page";
import { ChartCard, ChartEmpty, Stat } from "./report-widgets";

const PAGE_PATH = "/reports/trips";

interface Config {
  from: string;
  to: string;
  vehicle_id: string;
  driver_id: string;
  trip_status: string;
}

const defaults = (): Config => ({ ...monthPeriod(), vehicle_id: "", driver_id: "", trip_status: "" });

export function TripReportView() {
  const notify = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const config = useReportConfig(defaults, ["trips"]);
  const { draft, applied } = config;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-departure_at");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => compact(applied), [applied]);
  const report = useQuery({
    queryKey: ["trips", "report", filters],
    queryFn: () => reportsService.trips(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: config.ready,
  });
  // /trips takes the same period (departure date) and filters; its status filter is `status`.
  const listFilters: ListParams = { from: applied.from, to: applied.to, vehicle_id: applied.vehicle_id || undefined, driver_id: applied.driver_id || undefined, status: applied.trip_status || undefined };
  const listParams: ListParams = { ...listFilters, search: search || undefined, sort, page, per_page: perPage };
  const list = useQuery({ queryKey: ["trips", "report-list", listParams], queryFn: () => tripsService.list(listParams), placeholderData: keepPreviousData, enabled: config.ready });

  const r = report.data;
  const rows = list.data?.data;
  const offset = ((list.data?.meta.current_page ?? 1) - 1) * perPage;
  const filterCount = [applied.vehicle_id, applied.driver_id, applied.trip_status].filter(Boolean).length;
  const hasTrips = !!r?.stats.total_trips.value;

  const exportTrips = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages(tripsService.list, { ...listFilters, search: search || undefined, sort });
      exportCsv(
        "trip-report",
        ["Trip No.", "Reference No.", "Vehicle", "Driver", "Origin", "Destination", "Scheduled Departure", "Estimated Arrival", "Actual Departure", "Actual Arrival", "Duration (h)", "Distance (km)", "Status"],
        all.map((t) => {
          const hours = hoursBetween(t.actual_departure_at, t.actual_arrival_at);
          return [
            t.trip_number,
            t.reference_no,
            t.vehicle?.plate_number,
            t.driver?.full_name,
            t.origin,
            t.destination,
            formatDateTime(t.departure_at),
            formatDateTime(t.estimated_arrival_at),
            t.actual_departure_at ? formatDateTime(t.actual_departure_at) : "",
            t.actual_arrival_at ? formatDateTime(t.actual_arrival_at) : "",
            hours === null ? "" : hours.toFixed(1),
            t.distance_km,
            TRIP_STATUS[t.status]?.label ?? t.status,
          ];
        }),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  const exportSummary = () => {
    if (!r) return;
    const s = r.stats;
    exportCsv("trip-report-summary", ["Trip Report", `${r.period.from} to ${r.period.to}`, ""], [
      ["Metric", "This period", "Previous period"],
      ["Total trips", s.total_trips.value, s.total_trips.previous],
      ["Completed", s.completed.value, s.completed.previous],
      ["Cancelled", s.cancelled.value, s.cancelled.previous],
      ["On-time rate (%)", s.on_time_rate.value, s.on_time_rate.previous],
      ["Average duration (h)", s.avg_duration_hours.value, s.avg_duration_hours.previous],
      ["Distance (km, entered on trips)", s.distance_km.value, s.distance_km.previous],
      [],
      ["Status", "Trips", ""],
      ...r.trip_status.map((x) => [x.label, x.count, ""]),
      [],
      ["Date", "Trips", "Completed"],
      ...r.daily.map((d) => [d.date, d.trips, d.completed]),
    ]);
  };

  const columns: Column<Trip>[] = [
    { key: "index", header: "#", cell: (t) => <span className="text-ink-500">{offset + (rows?.indexOf(t) ?? 0) + 1}</span>, className: "w-10" },
    {
      key: "trip",
      header: "Trip No.",
      sortKey: "trip_number",
      cell: (t) => (
        <Link href={`${TRIPS_PATH}/${t.id}`} className="font-medium whitespace-nowrap text-ink-900 hover:text-brand-600">
          {t.trip_number}
        </Link>
      ),
    },
    { key: "vehicle", header: "Vehicle", cell: (t) => t.vehicle?.plate_number ?? "—" },
    { key: "driver", header: "Driver", cell: (t) => <span className="whitespace-nowrap">{t.driver?.full_name ?? "—"}</span> },
    {
      key: "route",
      header: "Origin → Destination",
      cell: (t) => (
        <span className="block max-w-64 min-w-40">
          <span className="block truncate text-ink-900" title={t.origin}>
            {t.origin}
          </span>
          <span className="block truncate text-ink-500" title={t.destination}>
            → {t.destination}
          </span>
        </span>
      ),
    },
    { key: "departure", header: "Scheduled", sortKey: "departure_at", cell: (t) => <span className="whitespace-nowrap">{formatDate(t.departure_at, "MMM d, yyyy hh:mm a")}</span> },
    { key: "actual", header: "Actual Departure", cell: (t) => <span className="whitespace-nowrap">{t.actual_departure_at ? formatDate(t.actual_departure_at, "MMM d, hh:mm a") : "—"}</span> },
    {
      key: "arrival",
      header: "Arrival",
      sortKey: "estimated_arrival_at",
      cell: (t) =>
        t.actual_arrival_at ? (
          <span className="whitespace-nowrap">{formatDate(t.actual_arrival_at, "MMM d, hh:mm a")}</span>
        ) : (
          <span className="whitespace-nowrap text-ink-500" title="Estimated arrival">
            ETA {formatDate(t.estimated_arrival_at, "MMM d, hh:mm a")}
          </span>
        ),
    },
    { key: "duration", header: "Duration", className: "tabular-nums whitespace-nowrap", cell: (t) => formatHours(hoursBetween(t.actual_departure_at, t.actual_arrival_at)) },
    { key: "distance", header: "Distance", className: "tabular-nums whitespace-nowrap", cell: (t) => (t.distance_km === null ? "—" : `${formatNumber(t.distance_km, 1)} km`) },
    { key: "status", header: "Status", sortKey: "status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
  ];

  return (
    <div>
      <ReportHeader title="Trip Report" subtitle="Review trip activity, completion and punctuality across your fleet." crumb="Trip Reports" path={PAGE_PATH} />

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
              setPage(1);
            }}
            onGenerate={() => {
              config.generate();
              setPage(1);
            }}
            loading={report.isFetching && !report.isLoading}
            dirty={config.dirty}
          >
            <Field label="Vehicle" htmlFor="tr-vehicle">
              <Select id="tr-vehicle" value={draft.vehicle_id} onChange={(e) => config.set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" />
            </Field>
            <Field label="Driver" htmlFor="tr-driver">
              <Select id="tr-driver" value={draft.driver_id} onChange={(e) => config.set("driver_id", e.target.value)} options={driverOptions} placeholder="All Drivers" />
            </Field>
            <Field label="Trip Status" htmlFor="tr-status">
              <Select id="tr-status" value={draft.trip_status} onChange={(e) => config.set("trip_status", e.target.value)} options={statusOptions(TRIP_STATUS)} placeholder="All Statuses" />
            </Field>
          </ReportConfigPanel>
        }
      >
        {report.error && <ErrorState className="rounded-xl border border-ink-100 bg-white" message={report.error.message} onRetry={() => report.refetch()} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat icon={Route} tone="bg-blue-50 text-blue-600" label="Total Trips" stat={r?.stats.total_trips} format={(v) => formatNumber(v)} title="Trips departing in the period" />
          <Stat icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" label="Completed Trips" stat={r?.stats.completed} format={(v) => formatNumber(v)} />
          <Stat icon={Clock} tone="bg-orange-50 text-orange-500" label="On-Time Rate" stat={r?.stats.on_time_rate} format={percent} points title="Completed trips that arrived by their estimated arrival time" />
          <Stat icon={Timer} tone="bg-violet-50 text-violet-600" label="Avg. Trip Duration" stat={r?.stats.avg_duration_hours} format={formatHours} upIsBad title="Actual departure to actual arrival, completed trips that have both" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <ChartCard icon={<BarChart3 />} title="Trips per Day" className="lg:col-span-3">
            {!r ? (
              <LoadingState />
            ) : hasTrips ? (
              <DailyBars data={r.daily} series={[{ key: "trips", label: "Departing", color: "#3b82f6" }, { key: "completed", label: "Completed", color: "#16a34a" }]} />
            ) : (
              <ChartEmpty text="No trips depart in this period with these filters." />
            )}
          </ChartCard>
          <ChartCard icon={<PieChartIcon />} title="Trip Status" className="lg:col-span-2" bodyClassName="flex h-auto min-h-64 items-center">
            {!r ? (
              <LoadingState className="w-full" />
            ) : (
              <CountDonut slices={r.trip_status.map((s) => ({ key: s.key, label: s.label, value: s.count, color: TRIP_STATUS_COLORS[s.key] }))} centerLabel="Total Trips" />
            )}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Stat icon={XCircle} tone="bg-ink-100 text-ink-600" label="Cancelled Trips" stat={r?.stats.cancelled} format={(v) => formatNumber(v)} upIsBad />
          <Stat
            icon={Route}
            tone="bg-sky-50 text-sky-600"
            label="Distance (entered on trips)"
            stat={r?.stats.distance_km}
            format={(v) => `${formatNumber(v, v % 1 ? 1 : 0)} km`}
            title="Sum of the distance saved on each trip (from route planning). Trips without one are not counted."
          />
        </div>

        <TableCard
          icon={<Route />}
          title="Trips"
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search trips..."
          filterCount={filterCount}
          onFilter={() => focusPanel(panelRef)}
          exporting={exporting}
          exportItems={[
            { label: "Trips (Excel CSV)", icon: <FileSpreadsheet />, disabled: !list.data?.meta.total, onSelect: exportTrips },
            { label: "Report summary (Excel CSV)", icon: <BarChart3 />, disabled: !r, onSelect: exportSummary },
          ]}
        >
          <DataTable
            columns={columns.map((c) => ({ ...c, className: cn(TABLE_CELL, c.className), headerClassName: cn("px-3", c.headerClassName) }))}
            rows={rows}
            rowKey={(t) => t.id}
            loading={list.isFetching}
            error={list.error}
            onRetry={() => list.refetch()}
            sort={sort}
            onSortChange={(next) => {
              setSort(next);
              setPage(1);
            }}
            empty={
              search || filterCount
                ? { title: "No trips match", description: "Try a different search, or change the filters in Report Configuration." }
                : { title: "No trips in this period", description: "Trips departing in the selected period will appear here." }
            }
          />
          <Pagination
            meta={list.data?.meta}
            onPageChange={setPage}
            perPage={perPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            noun="trips"
            showEdges
          />
        </TableCard>
      </ReportLayout>
    </div>
  );
}
