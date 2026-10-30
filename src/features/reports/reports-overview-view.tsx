"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Clock,
  Download,
  Eye,
  FileText,
  Map as MapIcon,
  Fuel,
  MapPin,
  MoreVertical,
  Plus,
  Trash2,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { REPORT_TYPE_OPTIONS, REPORT_TYPES, reportIcon, reportsService, type Compared, type Report, type ReportFilters } from "./api";
import { GenerateReportModal } from "./generate-report-modal";
import { DistanceChart, FuelChart, TripStatusDonut } from "./report-charts";
import { ReportPreview, exportReportCsv } from "./report-preview";

type Filters = ReportFilters & { type: string };

const thisMonth = (): Filters => ({
  from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
  to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  vehicle_id: "",
  driver_id: "",
  type: "",
});

const periodLabel = (from: string, to: string) =>
  from.slice(0, 4) === to.slice(0, 4) ? `${formatDate(from, "MMM d")} – ${formatDate(to)}` : `${formatDate(from)} – ${formatDate(to)}`;

export function ReportsOverviewView() {
  const notify = useToast();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { canOperate } = usePermissions();
  const { vehicleOptions, driverOptions } = useFleetOptions();

  // Draft filters in the bar; "Apply Filter" copies them to `applied`, which drives every query.
  const [draft, setDraft] = useState<Filters>(thisMonth);
  const [applied, setApplied] = useState<Filters>(thisMonth);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [distanceMode, setDistanceMode] = useState<"daily" | "cumulative">("daily");
  const [fuelMode, setFuelMode] = useState<"liters" | "cost">("liters");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewClosed, setPreviewClosed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<Report | null>(null);
  const [exporting, setExporting] = useState(false);

  const scope = { from: applied.from, to: applied.to, vehicle_id: applied.vehicle_id || undefined, driver_id: applied.driver_id || undefined };
  const overview = useQuery({ queryKey: ["reports", "overview", scope], queryFn: () => reportsService.overview(scope).then((r) => r.data), placeholderData: keepPreviousData });
  const listParams = { page, per_page: perPage, search: search || undefined, type: applied.type || undefined };
  const list = useQuery({ queryKey: ["reports", "list", listParams], queryFn: () => reportsService.list(listParams), placeholderData: keepPreviousData });

  // Open the newest report in the preview until the user closes it.
  const firstId = list.data?.data[0]?.id;
  useEffect(() => {
    if (previewId === null && !previewClosed && firstId) setPreviewId(firstId);
  }, [firstId, previewId, previewClosed]);
  const showPreview = previewId !== null && !previewClosed;
  const openPreview = (id: number) => {
    setPreviewId(id);
    setPreviewClosed(false);
  };

  const remove = useMutation({
    mutationFn: (report: Report) => reportsService.remove(report.id),
    onSuccess: (_, report) => {
      notify("Report deleted.");
      setDeleting(null);
      if (previewId === report.id) setPreviewId(null);
      queryClient.invalidateQueries({ queryKey: ["reports", "list"] });
    },
  });

  const apply = () => {
    // The date filter's "Clear" leaves no period; fall back to this month.
    const fallback = thisMonth();
    const next = draft.from && draft.to ? draft : { ...draft, from: fallback.from, to: fallback.to };
    setDraft(next);
    setApplied(next);
    setPage(1);
    queryClient.invalidateQueries({ queryKey: ["reports"] });
  };

  const exportList = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllPages(reportsService.list, { search: search || undefined, type: applied.type || undefined });
      exportCsv(
        "reports",
        ["Report Name", "Type", "Period From", "Period To", "Generated By", "Date Generated"],
        rows.map((r) => [r.name, r.type_label, r.period_from, r.period_to, r.generated_by?.name, formatDateTime(r.created_at)]),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  const downloadReport = async (r: Report) => {
    try {
      exportReportCsv(await queryClient.fetchQuery({ queryKey: ["reports", r.id], queryFn: () => reportsService.get(r.id).then((res) => res.data) }));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Download failed.", "error");
    }
  };

  const o = overview.data;
  const daily = o?.daily ?? [];
  const hasDistance = daily.some((d) => d.distance_km !== null);
  let running = 0;
  const distanceSeries = daily.map((d) => ({ date: d.date, value: distanceMode === "cumulative" ? (running += d.distance_km ?? 0) : (d.distance_km ?? 0) }));
  const fuelSeries = daily.map((d) => ({ date: d.date, value: fuelMode === "cost" ? d.fuel_cost : d.fuel_liters }));
  const hasFuel = daily.some((d) => d.fuel_liters > 0);
  const offset = ((list.data?.meta.current_page ?? 1) - 1) * perPage;

  const narrow = showPreview ? "xl:hidden 2xl:table-cell" : undefined;
  const columns: Column<Report>[] = [
    { key: "index", header: "#", cell: (r) => <span className="text-ink-500">{offset + (list.data?.data.indexOf(r) ?? 0) + 1}</span>, className: "w-10" },
    {
      key: "name",
      header: "Report Name",
      cell: (r) => {
        const Icon = reportIcon(r.type);
        return (
          <button type="button" onClick={() => openPreview(r.id)} title={r.type_label} className="flex min-w-36 items-center gap-2.5 text-left">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", REPORT_TYPES[r.type]?.tone ?? "bg-ink-500 text-white")}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="font-medium text-blue-800 hover:underline">{r.name}</span>
          </button>
        );
      },
      className: "whitespace-normal",
    },
    // Hidden next to the preview on narrower desktops; the icon and its tooltip still show the type.
    { key: "type", header: "Type", cell: (r) => r.type_label, className: narrow, headerClassName: narrow },
    { key: "period", header: "Period", cell: (r) => periodLabel(r.period_from, r.period_to) },
    { key: "by", header: "Generated By", cell: (r) => r.generated_by?.name ?? "—", className: "whitespace-normal", headerClassName: "whitespace-normal" },
    {
      key: "date",
      header: "Date Generated",
      headerClassName: "whitespace-normal",
      cell: (r) => (
        <span className="block whitespace-nowrap">
          {formatDate(r.created_at)}
          <span className="block text-xs text-ink-500">{formatDate(r.created_at, "h:mm a")}</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton label="Preview" onClick={() => openPreview(r.id)} active={showPreview && previewId === r.id}>
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton label="Download (Excel)" onClick={() => downloadReport(r)}>
            <Download className="h-4 w-4" />
          </IconButton>
          <Dropdown
            trigger={({ toggle }) => (
              <IconButton label="More actions" onClick={toggle}>
                <MoreVertical className="h-4 w-4" />
              </IconButton>
            )}
            items={[
              { label: "Preview", icon: <Eye />, onSelect: () => openPreview(r.id) },
              { label: "Delete", icon: <Trash2 />, danger: true, disabled: !(canOperate || r.generated_by?.id === user.id), onSelect: () => setDeleting(r) },
            ]}
          />
        </div>
      ),
      headerClassName: "relative text-right",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and view comprehensive reports for your fleet operations."
        actions={
          <Button onClick={() => setGenerating(true)} className="h-11 px-5">
            <Plus className="h-4 w-4" /> Generate Report
          </Button>
        }
      />

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:flex lg:items-center">
        <div className="sm:col-span-2 lg:w-64 lg:shrink-0">
          <DateRangeFilter from={draft.from} to={draft.to} onChange={(from, to) => setDraft((d) => ({ ...d, from, to }))} emptyLabel="Select period" />
        </div>
        <Select className="bg-white lg:min-w-0 lg:flex-1" value={draft.vehicle_id} onChange={(e) => setDraft((d) => ({ ...d, vehicle_id: e.target.value }))} options={vehicleOptions} placeholder="All Vehicles" aria-label="Vehicle" />
        <Select className="bg-white lg:min-w-0 lg:flex-1" value={draft.driver_id} onChange={(e) => setDraft((d) => ({ ...d, driver_id: e.target.value }))} options={driverOptions} placeholder="All Drivers" aria-label="Driver" />
        <Select className="bg-white lg:min-w-0 lg:flex-1" value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} options={REPORT_TYPE_OPTIONS} placeholder="All Report Types" aria-label="Report type" />
        <Button onClick={apply} className="h-10 px-6 lg:w-48 xl:w-56" loading={overview.isFetching && !overview.isLoading}>
          Apply Filter
        </Button>
      </div>

      {overview.error && <ErrorState className="mb-5 rounded-xl border border-ink-100 bg-white" message={overview.error.message} onRetry={() => overview.refetch()} />}

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={MapPin} tone="bg-sky-50 text-sky-600" label="Total Distance" stat={o?.stats.distance_km} format={(v) => `${formatNumber(v)} km`} title="Kilometres between odometer readings on fuel records" />
        <Stat icon={Fuel} tone="bg-brand-50 text-brand-600" label="Fuel Consumption" stat={o?.stats.fuel_liters} format={(v) => `${formatNumber(v)} L`} upIsBad title="Liters entered in fuel records" />
        <Stat icon={Truck} tone="bg-emerald-50 text-emerald-600" label="Total Trips" stat={o?.stats.total_trips} format={(v) => formatNumber(v)} title="Trips departing in the period" />
        <Stat
          icon={Clock}
          tone="bg-amber-50 text-amber-500"
          label="On-Time Delivery Rate"
          stat={o?.stats.on_time_rate}
          format={(v) => `${formatNumber(v, v % 1 ? 1 : 0)}%`}
          points
          title={o ? `${o.on_time.on_time} of ${o.on_time.completed} completed trips arrived by their estimated arrival` : undefined}
        />
      </div>

      {/* Charts */}
      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          icon={<MapIcon />}
          title="Distance Traveled"
          action={
            <MiniSelect value={distanceMode} onChange={(v) => setDistanceMode(v as typeof distanceMode)} label="Distance view">
              <option value="daily">Distance (km)</option>
              <option value="cumulative">Cumulative</option>
            </MiniSelect>
          }
        >
          {!o ? <LoadingState /> : hasDistance ? <DistanceChart data={distanceSeries} /> : <ChartEmpty text="No odometer readings on fuel records in this period, so distance can't be calculated." />}
        </ChartCard>
        <ChartCard
          icon={<Truck />}
          title="Fuel Consumption"
          action={
            <MiniSelect value={fuelMode} onChange={(v) => setFuelMode(v as typeof fuelMode)} label="Fuel view">
              <option value="liters">Fuel (Liters)</option>
              <option value="cost">Fuel Cost (₱)</option>
            </MiniSelect>
          }
        >
          {!o ? <LoadingState /> : hasFuel ? <FuelChart data={fuelSeries} unit={fuelMode} /> : <ChartEmpty text="No fuel records in this period." />}
        </ChartCard>
        <ChartCard icon={<Bell />} title="Trip Status" bodyClassName="flex h-auto min-h-64 items-center justify-center">
          {!o ? <LoadingState /> : <TripStatusDonut data={o.trip_status} />}
        </ChartCard>
      </div>

      {/* Report list + preview */}
      <div className={cn("grid grid-cols-1 gap-4", showPreview && "xl:grid-cols-5")}>
        <Card className={cn("min-w-0", showPreview && "xl:col-span-3 xl:self-start")}>
          <CardHeader
            icon={<FileText />}
            title="Report List"
            className="flex-wrap"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                  placeholder="Search reports..."
                  className="w-48 sm:w-56"
                />
                <Button variant="secondary" onClick={exportList} loading={exporting} disabled={!list.data?.meta.total}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
            }
          />
          <DataTable
            columns={showPreview ? columns.map((c) => ({ ...c, className: cn(c.className, "px-2.5"), headerClassName: cn(c.headerClassName, "px-2.5") })) : columns}
            rows={list.data?.data}
            rowKey={(r) => r.id}
            loading={list.isLoading}
            error={list.error}
            onRetry={() => list.refetch()}
            selectedKey={showPreview ? previewId : null}
            empty={
              search || applied.type
                ? { title: "No reports match", description: "Try a different search or report type." }
                : {
                    title: "No reports generated yet",
                    description: "Generate a report to snapshot a period and filters. Its figures are computed from your trip and fuel records.",
                    action: (
                      <Button onClick={() => setGenerating(true)}>
                        <Plus className="h-4 w-4" /> Generate Report
                      </Button>
                    ),
                  }
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
            noun="reports"
            showEdges
          />
        </Card>
        {showPreview && (
          <div className="min-w-0 xl:col-span-2">
            <ReportPreview reportId={previewId} onClose={() => setPreviewClosed(true)} />
          </div>
        )}
      </div>

      <GenerateReportModal
        open={generating}
        onClose={() => setGenerating(false)}
        initial={applied}
        vehicleOptions={vehicleOptions}
        driverOptions={driverOptions}
        onCreated={(report) => {
          setGenerating(false);
          notify("Report generated.");
          setSearch("");
          setPage(1);
          openPreview(report.id);
          queryClient.invalidateQueries({ queryKey: ["reports", "list"] });
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete report?"
        message={
          <>
            <strong>{deleting?.name}</strong> will be removed from the list. Trip and fuel records are not affected.
          </>
        }
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => deleting && remove.mutate(deleting)}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
      />
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  stat,
  format: fmt,
  upIsBad,
  points,
  title,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  stat: Compared | undefined;
  format: (value: number) => string;
  upIsBad?: boolean;
  /** Compare in percentage points (for rates) instead of relative change. */
  points?: boolean;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-ink-100 bg-white p-5 shadow-card" title={title}>
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-7 w-7" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink-500">{label}</p>
        {stat === undefined ? (
          <span className="mt-1 block h-8 w-24 animate-pulse rounded bg-ink-100" />
        ) : (
          <p className="text-2xl leading-tight font-bold tracking-tight text-ink-900 sm:text-[1.7rem]">{stat.value === null ? "—" : fmt(stat.value)}</p>
        )}
        {stat && <Trend stat={stat} upIsBad={upIsBad} points={points} />}
      </div>
    </div>
  );
}

function Trend({ stat, upIsBad, points }: { stat: Compared; upIsBad?: boolean; points?: boolean }) {
  const { value, previous } = stat;
  if (value === null) return <p className="mt-0.5 text-xs text-ink-500">No data for this period</p>;
  if (previous === null) return <p className="mt-0.5 text-xs text-ink-500">No data in previous period</p>;
  const diff = value - previous;
  const up = diff > 0;
  let change: string;
  if (points) change = `${formatNumber(Math.abs(diff), Math.abs(diff) % 1 ? 1 : 0)} pts`;
  else if (previous === 0) change = "new";
  else change = `${Math.round((Math.abs(diff) / previous) * 100)}%`;

  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs">
      {diff === 0 ? (
        <span className="font-semibold text-ink-500">0%</span>
      ) : (
        <span className={cn("flex items-center gap-0.5 font-semibold", up !== !!upIsBad ? "text-emerald-600" : "text-brand-600")}>
          {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          {change}
        </span>
      )}
      <span className="basis-full text-ink-500">vs. previous period</span>
    </p>
  );
}

function ChartCard({ icon, title, action, children, bodyClassName }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode; bodyClassName?: string }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader icon={icon} title={title} action={action} className="items-center gap-2 border-b-0 px-4 pb-1 [&_h2]:whitespace-nowrap" />
      <div className={cn("h-64 px-4 pb-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

function ChartEmpty({ text }: { text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg bg-ink-50/60 px-6 text-center">
      <BarChart3 className="h-8 w-8 text-ink-300" aria-hidden />
      <p className="max-w-64 text-sm text-ink-500">{text}</p>
    </div>
  );
}

function MiniSelect({ value, onChange, label, children }: { value: string; onChange: (value: string) => void; label: string; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="input h-8 w-auto py-0 pr-7 pl-2.5 text-xs">
      {children}
    </select>
  );
}

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("rounded-md p-1.5 transition hover:bg-ink-100 hover:text-ink-900", active ? "bg-brand-50 text-brand-600" : "text-ink-500")}
    >
      {children}
    </button>
  );
}
