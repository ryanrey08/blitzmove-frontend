"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Fuel,
  Gauge,
  Pencil,
  PieChart as PieChartIcon,
  Plus,
  Printer,
  RotateCcw,
  Route,
  Store,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Dropdown } from "@/components/ui/dropdown";
import { Field, Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { FUEL_TYPES, labelOf, PAYMENT_METHODS } from "@/lib/constants";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { fuelService } from "@/services/resources";
import type { FuelRecord, ListParams } from "@/types/api";
import { FUEL_PATH } from "../fuel/fuel-editor";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { reportsService, type FuelGroupBy, type FuelReportFilters, type FuelSlice } from "./api";
import { FUEL_TYPE_COLORS, FuelBarChart, FuelDonut, FuelTrendChart, OTHERS_COLOR, topSlices, type FuelMetric } from "./fuel-report-charts";
import { ChartCard, ChartEmpty, IconButton, MiniSelect, Stat } from "./report-widgets";

const PAGE_PATH = "/reports/fuel";

/** Report Configuration values; `route` is the JSON [origin, destination] of a trip route, or "". */
interface Config {
  from: string;
  to: string;
  vehicle_id: string;
  driver_id: string;
  fuel_type: string;
  group_by: FuelGroupBy;
  route: string;
  station: string;
  payment_method: string;
}

const defaults = (): Config => ({
  from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
  to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  vehicle_id: "",
  driver_id: "",
  fuel_type: "",
  group_by: "vehicle",
  route: "",
  station: "",
  payment_method: "",
});

const GROUPS: { value: FuelGroupBy; label: string }[] = [
  { value: "vehicle", label: "Vehicle" },
  { value: "driver", label: "Driver" },
  { value: "date", label: "Date" },
  { value: "fuel_type", label: "Fuel Type" },
];
const groupLabel = (g: FuelGroupBy) => GROUPS.find((x) => x.value === g)!.label;

/** Query filters shared by the report and the transaction list (blank values dropped). */
function toFilters(c: Config): FuelReportFilters {
  const [route_origin, route_destination] = c.route ? (JSON.parse(c.route) as [string, string]) : [];
  const filters: FuelReportFilters = {
    from: c.from,
    to: c.to,
    vehicle_id: c.vehicle_id,
    driver_id: c.driver_id,
    fuel_type: c.fuel_type,
    payment_method: c.payment_method,
    station: c.station,
    route_origin,
    route_destination,
  };
  return Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as FuelReportFilters;
}

const activeFilterCount = (c: Config) => [c.vehicle_id, c.driver_id, c.fuel_type, c.route, c.station, c.payment_method].filter(Boolean).length;

export function FuelReportView() {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const { canOperate } = usePermissions();
  const { vehicleOptions, driverOptions } = useFleetOptions();
  const configRef = useRef<HTMLDivElement>(null);

  // The panel edits `draft`; "Generate Report" copies it to `applied`, which drives every query.
  const [draft, setDraft] = useState<Config>(defaults);
  const [applied, setApplied] = useState<Config>(defaults);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("-fueled_at");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [trendMetric, setTrendMetric] = useState<"liters" | "cost">("liters");
  const [groupMetric, setGroupMetric] = useState<FuelMetric>("cost");
  const [stationMetric, setStationMetric] = useState<FuelMetric>("cost");
  const [deleting, setDeleting] = useState<FuelRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => toFilters(applied), [applied]);
  const reportParams = { ...filters, group_by: applied.group_by };
  const report = useQuery({
    queryKey: ["fuel", "report", reportParams],
    queryFn: () => reportsService.fuel(reportParams).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const listParams: ListParams = { ...filters, search: search || undefined, sort, page, per_page: perPage };
  const list = useQuery({ queryKey: ["fuel", listParams], queryFn: () => fuelService.list(listParams), placeholderData: keepPreviousData });
  const stations = useQuery({ queryKey: ["fuel", "stations"], queryFn: () => fuelService.stations().then((r) => r.data), staleTime: 60_000 });

  const remove = useApiMutation(() => fuelService.remove(deleting!.id), {
    invalidate: [["fuel"]],
    onSuccess: () => setDeleting(null),
  });

  const set = <K extends keyof Config>(key: K, value: Config[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);

  const generate = () => {
    // The date picker's "Clear" leaves no period; fall back to this month.
    const fallback = defaults();
    const next = draft.from && draft.to ? draft : { ...draft, from: fallback.from, to: fallback.to };
    setDraft(next);
    setApplied(next);
    setPage(1);
    if (!dirty) queryClient.invalidateQueries({ queryKey: ["fuel"] });
  };
  const reset = () => {
    setDraft(defaults());
    setApplied(defaults());
    setSearch("");
    setPage(1);
  };

  // Fuel type names as the app spells them (LPG, not Lpg).
  const data = report.data;
  const fuelLabel = (s: FuelSlice) => ({ ...s, label: labelOf(FUEL_TYPES, s.key) });
  const r = data && { ...data, fuel_types: data.fuel_types.map(fuelLabel), groups: data.group_by === "fuel_type" ? data.groups.map(fuelLabel) : data.groups };
  const editPath = (id: number) => `${FUEL_PATH}/${id}/edit?return=${encodeURIComponent(PAGE_PATH)}`;
  const offset = ((list.data?.meta.current_page ?? 1) - 1) * perPage;
  const rows = list.data?.data;

  const routeOptions = (r?.routes ?? []).map((x) => ({ value: JSON.stringify([x.origin, x.destination]), label: `${x.origin} → ${x.destination}` }));
  // Keep a chosen route selectable even if the latest report no longer lists it.
  if (draft.route && !routeOptions.some((o) => o.value === draft.route)) {
    const [o, d] = JSON.parse(draft.route) as [string, string];
    routeOptions.unshift({ value: draft.route, label: `${o} → ${d}` });
  }
  const stationOptions = [...(stations.data ?? [])].sort((a, b) => a.localeCompare(b)).map((s) => ({ value: s, label: s }));

  const exportTransactions = async () => {
    setExporting(true);
    try {
      const all = await fetchAllPages(fuelService.list, { ...filters, search: search || undefined, sort });
      exportCsv(
        "fuel-transactions",
        ["Date & Time", "Vehicle No.", "Driver", "Odometer (km)", "Fuel Type", "Quantity (L)", "Unit Price (PHP)", "Total Cost (PHP)", "Payment Method", "Fuel Station", "Receipt No.", "Reference No."],
        all.map((t) => [
          formatDateTime(t.fueled_at),
          t.vehicle?.plate_number,
          t.driver?.full_name,
          t.odometer_km,
          labelOf(FUEL_TYPES, t.fuel_type),
          t.liters,
          t.price_per_liter,
          t.total_cost,
          t.payment_method ? labelOf(PAYMENT_METHODS, t.payment_method) : "",
          t.station,
          t.receipt_number,
          t.reference_number,
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
    const slices = (title: string, items: FuelSlice[]) => [[], [title, "Fuel (L)", "Total Cost (PHP)", "Transactions"], ...items.map((g) => [g.label, g.liters, g.cost, g.transactions])];
    exportCsv("fuel-report", ["Fuel Report", `${r.period.from} to ${r.period.to}`, "", ""], [
      ["Metric", "This period", "Previous period", ""],
      ["Total fuel (L)", s.fuel_liters.value, s.fuel_liters.previous, ""],
      ["Total fuel cost (PHP)", s.fuel_cost.value, s.fuel_cost.previous, ""],
      ["Average fuel efficiency (km/L)", s.efficiency_km_per_liter.value, s.efficiency_km_per_liter.previous, ""],
      ["Total distance (km)", s.distance_km.value, s.distance_km.previous, ""],
      ["Transactions", s.transactions.value, s.transactions.previous, ""],
      ...slices(`By ${groupLabel(r.group_by)}`, r.groups),
      ...slices("By Fuel Type", r.fuel_types),
      ...slices("By Fuel Station", r.stations),
      [],
      ["Date", "Fuel (L)", "Total Cost (PHP)", ""],
      ...r.daily.map((d) => [d.date, d.fuel_liters, d.fuel_cost, ""]),
    ]);
  };

  const columns: Column<FuelRecord>[] = [
    { key: "index", header: "#", cell: (t) => <span className="text-ink-500">{offset + (rows?.indexOf(t) ?? 0) + 1}</span>, className: "w-10" },
    { key: "date", header: "Date & Time", sortKey: "fueled_at", cell: (t) => formatDate(t.fueled_at, "MMM d, yyyy hh:mm a") },
    {
      key: "vehicle",
      header: "Vehicle No.",
      cell: (t) =>
        t.vehicle ? (
          <Link href={`/fleet/vehicles/${t.vehicle.id}`} className="font-medium text-ink-900 hover:text-brand-600">
            {t.vehicle.plate_number}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "driver", header: "Driver", cell: (t) => t.driver?.full_name ?? "—" },
    { key: "odometer", header: "Odometer (km)", sortKey: "odometer_km", className: "tabular-nums", cell: (t) => formatNumber(t.odometer_km) },
    { key: "type", header: "Fuel Type", cell: (t) => labelOf(FUEL_TYPES, t.fuel_type) },
    { key: "liters", header: "Quantity (L)", sortKey: "liters", className: "tabular-nums", cell: (t) => formatNumber(t.liters, 2) },
    { key: "price", header: "Unit Price (₱)", sortKey: "price_per_liter", className: "tabular-nums", cell: (t) => formatNumber(t.price_per_liter, 2) },
    { key: "total", header: "Total Cost (₱)", sortKey: "total_cost", className: "font-medium text-ink-900 tabular-nums", cell: (t) => formatNumber(t.total_cost, 2) },
    {
      key: "payment",
      header: "Payment Method",
      cell: (t) => (t.payment_method ? <span className="text-blue-700">{labelOf(PAYMENT_METHODS, t.payment_method)}</span> : "—"),
    },
    { key: "station", header: "Fuel Station", cell: (t) => t.station ?? "—" },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "text-center",
      cell: (t) => (
        <div className="flex items-center justify-center gap-0.5">
          {canOperate ? (
            <>
              <IconButton label="Edit transaction" onClick={() => router.push(editPath(t.id))}>
                <Pencil className="h-4 w-4 text-ink-800" />
              </IconButton>
              <IconButton label="Delete transaction" onClick={() => setDeleting(t)}>
                <Trash2 className="h-4 w-4 text-brand-600" />
              </IconButton>
            </>
          ) : (
            <IconButton label="View transaction" onClick={() => router.push(`${FUEL_PATH}/${t.id}`)}>
              <Eye className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      ),
    },
  ];

  const byGroup = r ? topSlices(r.groups) : [];
  const fuelTypes = (r?.fuel_types ?? []).map((t) => ({ key: t.key, label: t.label, value: t.liters, color: FUEL_TYPE_COLORS[t.key] ?? OTHERS_COLOR }));
  const trendSeries = (r?.daily ?? []).map((d) => ({ date: d.date, value: trendMetric === "cost" ? d.fuel_cost : d.fuel_liters }));
  const hasFuel = !!r?.stats.transactions.value;
  const filterCount = activeFilterCount(applied);
  const groupName = groupLabel(r?.group_by ?? applied.group_by);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Fuel Report</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Monitor and analyze fuel consumption, expenses and efficiency of your fleet.</p>
        </div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-ink-500 print:hidden">
          <Link href="/reports/overview" className="hover:text-ink-900">
            Reports
          </Link>
          <ChevronRight className="h-4 w-4" />
          <Link href={PAGE_PATH} className="hover:text-ink-900">
            Fuel Reports
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-ink-900">Fuel Report</span>
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[17rem_minmax(0,1fr)] 2xl:grid-cols-[18.5rem_minmax(0,1fr)]">
        {/* Report Configuration */}
        <div ref={configRef} tabIndex={-1} className="scroll-mt-20 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500 xl:self-start print:hidden">
        <Card>
          <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
            <Filter className="h-5 w-5 fill-ink-900 text-ink-900" aria-hidden />
            <h2 className="text-base font-semibold text-ink-900">Report Configuration</h2>
          </div>
          <form
            className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-1"
            onSubmit={(e) => {
              e.preventDefault();
              generate();
            }}
          >
            <Field label="Date Range" required className="sm:col-span-2 lg:col-span-1">
              <DateRangeFilter from={draft.from} to={draft.to} onChange={(from, to) => setDraft((d) => ({ ...d, from, to }))} emptyLabel="Select period" />
            </Field>
            <Field label="Vehicle(s)" htmlFor="fr-vehicle">
              <Select id="fr-vehicle" value={draft.vehicle_id} onChange={(e) => set("vehicle_id", e.target.value)} options={vehicleOptions} placeholder="All Vehicles" />
            </Field>
            <Field label="Driver(s)" htmlFor="fr-driver">
              <Select id="fr-driver" value={draft.driver_id} onChange={(e) => set("driver_id", e.target.value)} options={driverOptions} placeholder="All Drivers" />
            </Field>
            <Field label="Fuel Type" htmlFor="fr-fuel-type">
              <Select id="fr-fuel-type" value={draft.fuel_type} onChange={(e) => set("fuel_type", e.target.value)} options={FUEL_TYPES} placeholder="All Fuel Types" />
            </Field>

            <fieldset className="sm:col-span-2 lg:col-span-4 xl:col-span-1">
              <legend className="mb-2 text-sm font-medium text-ink-800">
                Group By<span className="ml-0.5 text-brand-600">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 xl:grid-cols-2">
                {GROUPS.map((g) => (
                  <label key={g.value} className="flex cursor-pointer items-center gap-2 text-sm text-ink-800">
                    <input
                      type="radio"
                      name="group_by"
                      value={g.value}
                      checked={draft.group_by === g.value}
                      onChange={() => set("group_by", g.value)}
                      className="h-4 w-4 accent-blue-600"
                    />
                    {g.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <h3 className="pt-1 text-base font-semibold text-ink-900 sm:col-span-2 lg:col-span-4 xl:col-span-1">Additional Filters</h3>
            <Field label="Route" htmlFor="fr-route" hint={r && !r.routes.length ? "No fuel records are linked to a trip yet." : undefined}>
              <Select id="fr-route" value={draft.route} onChange={(e) => set("route", e.target.value)} options={routeOptions} placeholder="All Routes" disabled={!routeOptions.length} />
            </Field>
            <Field label="Geofence" htmlFor="fr-geofence" hint="Fuel records aren't linked to geofences yet.">
              <Select id="fr-geofence" value="" onChange={() => undefined} options={[]} placeholder="All Geofences" disabled />
            </Field>
            <Field label="Fuel Station" htmlFor="fr-station">
              <Select id="fr-station" value={draft.station} onChange={(e) => set("station", e.target.value)} options={stationOptions} placeholder="All Fuel Stations" />
            </Field>
            <Field label="Payment Method" htmlFor="fr-payment">
              <Select id="fr-payment" value={draft.payment_method} onChange={(e) => set("payment_method", e.target.value)} options={PAYMENT_METHODS} placeholder="All Payment Methods" />
            </Field>

            <div className="flex flex-col gap-2 pt-2 sm:col-span-2 lg:col-span-4 xl:col-span-1">
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={reset} className="h-11 flex-1 sm:flex-none xl:flex-1">
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
                <Button type="submit" className="h-11 flex-[1.6] sm:flex-none sm:px-6 xl:flex-[1.6] xl:px-3" loading={report.isFetching && !report.isLoading}>
                  <FileText className="h-4 w-4" /> Generate Report
                </Button>
              </div>
              {dirty && <p className="text-xs text-amber-600">Changes not applied yet. Select Generate Report to update the page.</p>}
            </div>
          </form>
        </Card>
        </div>

        {/* Report */}
        <div className="min-w-0 space-y-4">
          {report.error && <ErrorState className="rounded-xl border border-ink-100 bg-white" message={report.error.message} onRetry={() => report.refetch()} />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <Stat icon={Fuel} tone="bg-brand-50 text-brand-600" label="Total Fuel Consumption" stat={r?.stats.fuel_liters} format={(v) => `${formatNumber(v, v % 1 ? 2 : 0)} L`} upIsBad title="Liters entered in fuel records in the period" />
            <Stat icon={Coins} tone="bg-blue-50 text-blue-600" label="Total Fuel Cost" stat={r?.stats.fuel_cost} format={(v) => `₱${formatNumber(v, v % 1 ? 2 : 0)}`} upIsBad title="Total cost of the fuel records in the period" />
            <Stat
              icon={Gauge}
              tone="bg-emerald-50 text-emerald-600"
              label="Average Fuel Efficiency"
              stat={r?.stats.efficiency_km_per_liter}
              format={(v) => `${formatNumber(v, 2)} km/L`}
              title="Kilometres between odometer readings ÷ liters bought at the fill-up that closes each leg"
            />
            <Stat icon={Route} tone="bg-orange-50 text-orange-500" label="Total Distance" stat={r?.stats.distance_km} format={(v) => `${formatNumber(v)} km`} title="Kilometres between odometer readings on fuel records" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <ChartCard
              icon={<BarChart3 />}
              title="Fuel Consumption Trend"
              className="lg:col-span-3"
              action={
                <MiniSelect value={trendMetric} onChange={(v) => setTrendMetric(v as typeof trendMetric)} label="Trend measure">
                  <option value="liters">Fuel (Liters)</option>
                  <option value="cost">Fuel Cost (₱)</option>
                </MiniSelect>
              }
            >
              {!r ? <LoadingState /> : hasFuel ? <FuelTrendChart data={trendSeries} metric={trendMetric} /> : <ChartEmpty text="No fuel records match this period and filters." />}
            </ChartCard>
            <ChartCard icon={<PieChartIcon />} title={`Fuel Consumption by ${groupName}`} className="lg:col-span-2" bodyClassName="flex h-auto min-h-64 items-center">
              {!r ? <LoadingState className="w-full" /> : hasFuel ? <FuelDonut slices={byGroup} /> : <ChartEmpty text="No fuel records to break down." />}
            </ChartCard>
          </div>

          {/* Transactions */}
          <Card className="min-w-0">
            <CardHeader
              icon={<Fuel />}
              title="Fuel Transactions"
              className="flex-col sm:flex-row sm:items-center sm:flex-wrap [&>div:last-child]:w-full sm:[&>div:last-child]:w-auto"
              action={
                <div className="flex w-full flex-wrap items-center gap-2">
                  <SearchInput
                    value={search}
                    onChange={(v) => {
                      setSearch(v);
                      setPage(1);
                    }}
                    placeholder="Search transactions..."
                    className="min-w-0 basis-full sm:w-56 sm:flex-none sm:basis-auto"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      configRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      configRef.current?.focus({ preventScroll: true });
                    }}
                    title="Filters are set in Report Configuration"
                  >
                    <Filter className="h-4 w-4" /> Filter
                    {filterCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[0.65rem] leading-4 font-semibold text-white">{filterCount}</span>}
                  </Button>
                  <Dropdown
                    trigger={({ toggle, open }) => (
                      <Button variant="secondary" onClick={toggle} loading={exporting} aria-expanded={open}>
                        <Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    items={[
                      { label: "Transactions (Excel CSV)", icon: <FileSpreadsheet />, disabled: !list.data?.meta.total, onSelect: exportTransactions },
                      { label: "Report summary (Excel CSV)", icon: <BarChart3 />, disabled: !r, onSelect: exportSummary },
                      { label: "Print / Save as PDF", icon: <Printer />, onSelect: () => window.print() },
                    ]}
                  />
                  {canOperate && (
                    <Button onClick={() => router.push(`${FUEL_PATH}/create?return=${encodeURIComponent(PAGE_PATH)}`)}>
                      <Plus className="h-4 w-4" /> Add Transaction
                    </Button>
                  )}
                </div>
              }
            />
            <DataTable
              columns={columns.map((c) => ({ ...c, className: cn("px-3 text-xs sm:text-[0.8rem]", c.className), headerClassName: cn("px-3", c.headerClassName) }))}
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
                  ? { title: "No transactions match", description: "Try a different search, or change the filters in Report Configuration." }
                  : { title: "No fuel transactions in this period", description: "Fuel purchases you log will appear here." }
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
              noun="transactions"
              showEdges
            />
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <ChartCard icon={<Fuel />} title={`Fuel Cost by ${groupName}`} action={<MetricSelect value={groupMetric} onChange={setGroupMetric} label={`${groupName} measure`} />}>
              {!r ? <LoadingState /> : hasFuel ? <FuelBarChart slices={r.groups} metric={groupMetric} /> : <ChartEmpty text="No fuel records to compare." />}
            </ChartCard>
            <ChartCard icon={<PieChartIcon />} title="Fuel Type Distribution" bodyClassName="flex h-auto min-h-64 items-center">
              {!r ? <LoadingState className="w-full" /> : hasFuel ? <FuelDonut slices={fuelTypes} layout="list" /> : <ChartEmpty text="No fuel records to break down." />}
            </ChartCard>
            <ChartCard
              icon={<Store />}
              title="Top Fuel Stations"
              className="md:col-span-2 2xl:col-span-1"
              action={<MetricSelect value={stationMetric} onChange={setStationMetric} label="Station measure" />}
            >
              {!r ? <LoadingState /> : r.stations.length ? <FuelBarChart slices={r.stations} metric={stationMetric} /> : <ChartEmpty text={hasFuel ? "None of these fuel records name a station." : "No fuel records to compare."} />}
            </ChartCard>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete fuel transaction"
        message={`Delete the ${deleting ? formatNumber(deleting.liters, 2) : ""} L entry for ${deleting?.vehicle?.plate_number ?? "this vehicle"}?`}
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate(undefined)}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
      />
    </div>
  );
}

function MetricSelect({ value, onChange, label }: { value: FuelMetric; onChange: (value: FuelMetric) => void; label: string }) {
  return (
    <MiniSelect value={value} onChange={(v) => onChange(v as FuelMetric)} label={label}>
      <option value="cost">Total Cost (₱)</option>
      <option value="liters">Fuel (Liters)</option>
      <option value="transactions">Transactions</option>
    </MiniSelect>
  );
}
