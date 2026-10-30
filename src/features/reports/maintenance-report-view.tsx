"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, Coins, FileSpreadsheet, PieChart as PieChartIcon, Wrench } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { StatusBadge, TONE_HEX } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_STATUS, MAINTENANCE_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { cn, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { maintenanceService } from "@/services/resources";
import type { ListParams, MaintenanceDisplayStatus, MaintenanceRecord } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { MAINTENANCE_PATH } from "../maintenance/maintenance-editor";
import { reportsService } from "./api";
import { CountDonut, RankBars } from "./ops-report-charts";
import { ConfigHeading, ReportConfigPanel, ReportHeader, ReportLayout, TABLE_CELL, TableCard, compact, focusPanel, monthPeriod, useReportConfig } from "./report-page";
import { ChartCard, ChartEmpty, MiniSelect, Stat } from "./report-widgets";

const PAGE_PATH = "/reports/maintenance";

interface Config {
  from: string;
  to: string;
  vehicle_id: string;
  status: string;
  category: string;
  service_type: string;
}

const defaults = (): Config => ({ ...monthPeriod(), vehicle_id: "", status: "", category: "", service_type: "" });

const statusLabel = (s: string) => MAINTENANCE_STATUS[s as MaintenanceDisplayStatus]?.label ?? s;
const peso = (v: number) => `₱${formatNumber(v, v % 1 ? 2 : 0)}`;

export function MaintenanceReportView() {
  const notify = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const { vehicleOptions } = useFleetOptions();
  const config = useReportConfig(defaults, ["maintenance"]);
  const { draft, applied } = config;
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-scheduled_date");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [vehicleMetric, setVehicleMetric] = useState<"cost" | "count">("cost");
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => compact(applied), [applied]);
  const report = useQuery({
    queryKey: ["maintenance", "report", filters],
    queryFn: () => reportsService.maintenance(filters).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: config.ready,
  });
  // /maintenance-records filters on the scheduled date and the shown status, like the report.
  const listParams: ListParams = { ...filters, search: search || undefined, sort, page, per_page: perPage };
  const list = useQuery({ queryKey: ["maintenance", "report-list", listParams], queryFn: () => maintenanceService.list(listParams), placeholderData: keepPreviousData, enabled: config.ready });

  const r = report.data;
  const rows = list.data?.data;
  const offset = ((list.data?.meta.current_page ?? 1) - 1) * perPage;
  const filterCount = [applied.vehicle_id, applied.status, applied.category, applied.service_type].filter(Boolean).length;
  const hasRecords = !!r?.stats.total.value;

  const exportRecords = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages(maintenanceService.list, { ...filters, search: search || undefined, sort });
      exportCsv(
        "maintenance-report",
        ["Reference No.", "Vehicle", "Service Type", "Category", "Scheduled Date", "Service Date", "Status", "Odometer (km)", "Estimated Cost (PHP)", "Actual Cost (PHP)", "Service Provider", "Assigned To"],
        all.map((m) => [
          m.reference_number,
          m.vehicle?.plate_number,
          labelOf(MAINTENANCE_TYPES, m.service_type),
          labelOf(MAINTENANCE_CATEGORIES, m.category),
          m.scheduled_date,
          m.service_date,
          statusLabel(m.display_status),
          m.odometer_km,
          m.estimated_cost,
          m.actual_cost,
          m.service_provider,
          m.assigned_to,
        ]),
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
    exportCsv("maintenance-report-summary", ["Maintenance Report", `${r.period.from} to ${r.period.to}`, ""], [
      ["Metric", "This period", "Previous period"],
      ["Maintenance records", s.total.value, s.total.previous],
      ["Completed", s.completed.value, s.completed.previous],
      ["Overdue", s.overdue.value, s.overdue.previous],
      ["Total cost (PHP)", s.total_cost.value, s.total_cost.previous],
      [],
      ["Service Type", "Records", "Actual Cost (PHP)"],
      ...r.by_type.map((t) => [labelOf(MAINTENANCE_TYPES, t.key), t.count, t.cost]),
      [],
      ["Vehicle", "Records", "Actual Cost (PHP)"],
      ...r.by_vehicle.map((v) => [v.label, v.count, v.cost]),
      [],
      ["Status", "Records", ""],
      ...r.by_status.map((x) => [statusLabel(x.key), x.count, ""]),
    ]);
  };

  const columns: Column<MaintenanceRecord>[] = [
    { key: "index", header: "#", cell: (m) => <span className="text-ink-500">{offset + (rows?.indexOf(m) ?? 0) + 1}</span>, className: "w-10" },
    {
      key: "ref",
      header: "Reference No.",
      sortKey: "reference_number",
      cell: (m) => (
        <Link href={`${MAINTENANCE_PATH}/${m.id}`} className="font-medium whitespace-nowrap text-ink-900 hover:text-brand-600">
          {m.reference_number}
        </Link>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (m) => (
        <span className="block whitespace-nowrap">
          <span className="font-medium text-ink-900">{m.vehicle?.plate_number ?? "—"}</span>
          {m.vehicle && <span className="block text-ink-500">{`${m.vehicle.make} ${m.vehicle.model}`}</span>}
        </span>
      ),
    },
    { key: "type", header: "Maintenance Type", cell: (m) => <span className="whitespace-nowrap">{labelOf(MAINTENANCE_TYPES, m.service_type)}</span> },
    { key: "category", header: "Category", cell: (m) => labelOf(MAINTENANCE_CATEGORIES, m.category) },
    { key: "scheduled", header: "Scheduled", sortKey: "scheduled_date", cell: (m) => <span className="whitespace-nowrap">{formatDate(m.scheduled_date)}</span> },
    { key: "service", header: "Service Date", sortKey: "service_date", cell: (m) => <span className="whitespace-nowrap">{m.service_date ? formatDate(m.service_date) : "—"}</span> },
    { key: "status", header: "Status", cell: (m) => <StatusBadge status={m.display_status} map={MAINTENANCE_STATUS} /> },
    { key: "estimated", header: "Est. Cost (₱)", sortKey: "estimated_cost", className: "tabular-nums", cell: (m) => formatNumber(m.estimated_cost, 2) },
    { key: "actual", header: "Actual Cost (₱)", sortKey: "actual_cost", className: "font-medium text-ink-900 tabular-nums", cell: (m) => formatNumber(m.actual_cost, 2) },
    { key: "provider", header: "Provider", cell: (m) => m.service_provider ?? "—" },
  ];

  const statusSlices = (r?.by_status ?? []).map((s) => ({
    key: s.key,
    label: statusLabel(s.key),
    value: s.count,
    color: TONE_HEX[MAINTENANCE_STATUS[s.key as MaintenanceDisplayStatus]?.tone ?? "gray"],
  }));
  const byVehicle = (r?.by_vehicle ?? []).map((v) => ({ label: v.label, value: vehicleMetric === "cost" ? (v.cost ?? 0) : v.count }));

  return (
    <div>
      <ReportHeader title="Maintenance Report" subtitle="Review maintenance work, costs, and upcoming or overdue service across the fleet." crumb="Maintenance Reports" path={PAGE_PATH} />

      <ReportLayout
        config={
          <ReportConfigPanel
            panelRef={panelRef}
            period={draft}
            onPeriodChange={config.setPeriod}
            periodHint="Work scheduled in this period."
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
            <Field label="Vehicle" htmlFor="mr-vehicle">
              <Select id="mr-vehicle" value={draft.vehicle_id} onChange={(e) => config.set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" />
            </Field>
            <Field label="Status" htmlFor="mr-status">
              <Select id="mr-status" value={draft.status} onChange={(e) => config.set("status", e.target.value)} options={statusOptions(MAINTENANCE_STATUS)} placeholder="All Statuses" />
            </Field>
            <ConfigHeading>Additional Filters</ConfigHeading>
            <Field label="Maintenance Type" htmlFor="mr-type">
              <Select id="mr-type" value={draft.service_type} onChange={(e) => config.set("service_type", e.target.value)} options={MAINTENANCE_TYPES} placeholder="All Types" />
            </Field>
            <Field label="Category" htmlFor="mr-category">
              <Select id="mr-category" value={draft.category} onChange={(e) => config.set("category", e.target.value)} options={MAINTENANCE_CATEGORIES} placeholder="All Categories" />
            </Field>
          </ReportConfigPanel>
        }
      >
        {report.error && <ErrorState className="rounded-xl border border-ink-100 bg-white" message={report.error.message} onRetry={() => report.refetch()} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          <Stat icon={Wrench} tone="bg-blue-50 text-blue-600" label="Maintenance Records" stat={r?.stats.total} format={(v) => formatNumber(v)} title="Maintenance scheduled in the period" />
          <Stat icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" label="Completed" stat={r?.stats.completed} format={(v) => formatNumber(v)} />
          <Stat icon={AlertTriangle} tone="bg-brand-50 text-brand-600" label="Overdue" stat={r?.stats.overdue} format={(v) => formatNumber(v)} upIsBad title="Scheduled work whose date has passed" />
          <Stat icon={Coins} tone="bg-orange-50 text-orange-500" label="Total Maintenance Cost" stat={r?.stats.total_cost} format={peso} upIsBad title="Actual cost entered on the records" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <ChartCard
            icon={<BarChart3 />}
            title={vehicleMetric === "cost" ? "Maintenance Cost by Vehicle" : "Maintenance Records by Vehicle"}
            className="lg:col-span-3"
            action={
              <MiniSelect value={vehicleMetric} onChange={(v) => setVehicleMetric(v as typeof vehicleMetric)} label="Vehicle measure">
                <option value="cost">Actual Cost (₱)</option>
                <option value="count">Records</option>
              </MiniSelect>
            }
          >
            {!r ? (
              <LoadingState />
            ) : byVehicle.some((v) => v.value > 0) ? (
              <RankBars data={byVehicle} format={vehicleMetric === "cost" ? formatCurrency : (v) => formatNumber(v)} name={vehicleMetric === "cost" ? "Actual cost" : "Records"} />
            ) : (
              <ChartEmpty text={hasRecords ? "No actual costs entered for this work yet." : "No maintenance scheduled in this period."} />
            )}
          </ChartCard>
          <ChartCard icon={<PieChartIcon />} title="Maintenance Status" className="lg:col-span-2" bodyClassName="flex h-auto min-h-64 items-center">
            {!r ? <LoadingState className="w-full" /> : hasRecords ? <CountDonut slices={statusSlices} centerLabel="Records" /> : <ChartEmpty text="No maintenance scheduled in this period." />}
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard icon={<Wrench />} title="Records by Maintenance Type">
            {!r ? <LoadingState /> : hasRecords ? <RankBars data={r.by_type.map((t) => ({ label: labelOf(MAINTENANCE_TYPES, t.key), value: t.count }))} name="Records" colorful={false} /> : <ChartEmpty text="No maintenance scheduled in this period." />}
          </ChartCard>
          <Card className="flex min-w-0 flex-col">
            <CardHeader icon={<CalendarClock />} title="Upcoming & Overdue" description="Open work due in the next 30 days or past due" className="px-4" />
            {!r ? (
              <LoadingState />
            ) : r.upcoming.length ? (
              <ul className="divide-y divide-ink-100 px-4 pb-2">
                {r.upcoming.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link href={`${MAINTENANCE_PATH}/${u.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-600">
                        {labelOf(MAINTENANCE_TYPES, u.service_type)}
                      </Link>
                      <p className="truncate text-xs text-ink-500">
                        {u.vehicle ?? "—"} · {u.reference_number}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-600 tabular-nums">{formatDate(u.scheduled_date)}</span>
                    <StatusBadge status={u.display_status as MaintenanceDisplayStatus} map={MAINTENANCE_STATUS} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-56 px-4 pb-4">
                <ChartEmpty text="Nothing due in the next 30 days and nothing overdue." />
              </div>
            )}
          </Card>
        </div>

        <TableCard
          icon={<Wrench />}
          title="Maintenance Records"
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search maintenance..."
          filterCount={filterCount}
          onFilter={() => focusPanel(panelRef)}
          exporting={exporting}
          exportItems={[
            { label: "Records (Excel CSV)", icon: <FileSpreadsheet />, disabled: !list.data?.meta.total, onSelect: exportRecords },
            { label: "Report summary (Excel CSV)", icon: <BarChart3 />, disabled: !r, onSelect: exportSummary },
          ]}
        >
          <DataTable
            columns={columns.map((c) => ({ ...c, className: cn(TABLE_CELL, c.className), headerClassName: cn("px-3", c.headerClassName) }))}
            rows={rows}
            rowKey={(m) => m.id}
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
                ? { title: "No maintenance records match", description: "Try a different search, or change the filters in Report Configuration." }
                : { title: "No maintenance in this period", description: "Maintenance scheduled in the selected period will appear here." }
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
            noun="records"
            showEdges
          />
        </TableCard>
      </ReportLayout>
    </div>
  );
}
