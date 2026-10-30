"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  Eye,
  List,
  type LucideIcon,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Settings2,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Dropdown, type DropdownItem } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { MAINTENANCE_CATEGORIES, MAINTENANCE_STATUS, MAINTENANCE_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { cn, formatDate } from "@/lib/utils";
import { maintenanceService } from "@/services/resources";
import type { ListParams, MaintenanceRecord, MaintenanceSummary } from "@/types/api";
import { useFleetOptions } from "../fuel/use-fleet-options";
import { MAINTENANCE_PATH } from "./maintenance-editor";
import { MaintenancePanel } from "./maintenance-panel";

const CARDS: { key: keyof MaintenanceSummary; filter: string; label: string; icon: LucideIcon; tone: string; upIsBad?: boolean }[] = [
  { key: "total", filter: "", label: "Total Maintenance", icon: Wrench, tone: "bg-brand-50 text-brand-600" },
  { key: "upcoming", filter: "upcoming", label: "Upcoming", icon: CalendarClock, tone: "bg-sky-50 text-sky-600" },
  { key: "overdue", filter: "overdue", label: "Overdue", icon: TriangleAlert, tone: "bg-red-50 text-red-600", upIsBad: true },
  { key: "completed_this_month", filter: "completed", label: "Completed (This Month)", icon: CircleCheck, tone: "bg-emerald-50 text-emerald-600" },
  { key: "in_progress", filter: "in_progress", label: "In Progress", icon: Settings2, tone: "bg-violet-50 text-violet-600" },
];

const SORTS = [
  { value: "", label: "Open work first (default)" },
  { value: "scheduled_date", label: "Next due (oldest first)" },
  { value: "-scheduled_date", label: "Next due (latest first)" },
  { value: "-service_date", label: "Last serviced" },
  { value: "-created_at", label: "Newest first" },
];

const TABS = [
  { href: "/fleet/vehicles", label: "Vehicles" },
  { href: "/fleet/drivers", label: "Drivers" },
  { href: MAINTENANCE_PATH, label: "Maintenance" },
];

const vehicleName = (r: MaintenanceRecord) => (r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}`.trim() : "—");

export function MaintenanceView() {
  const router = useRouter();
  const notify = useToast();
  const searchParams = useSearchParams();
  const { canOperate } = usePermissions();
  const { vehicleOptions } = useFleetOptions();
  const { params, update, setPage } = useListParams({ vehicle_id: searchParams.get("vehicle") ?? "", status: searchParams.get("status") ?? "", from: "", to: "", sort: "" });
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selected, setSelected] = useState<number | null>(Number(searchParams.get("record")) || null);
  const [panelClosed, setPanelClosed] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [deleting, setDeleting] = useState<MaintenanceRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = { ...params, sort: params.sort || undefined };
  const filters: ListParams = { ...query, page: undefined, per_page: undefined };
  const list = useQuery({ queryKey: ["maintenance", query], queryFn: () => maintenanceService.list(query), placeholderData: keepPreviousData });
  const summary = useQuery({
    queryKey: ["maintenance", "summary", params.vehicle_id],
    queryFn: () => maintenanceService.summary({ vehicle_id: (params.vehicle_id as string) || undefined }),
  });

  // Open the first record's details, as in the reference layout, until the user closes the panel.
  const firstId = list.data?.data[0]?.id;
  useEffect(() => {
    if (!selected && !panelClosed && firstId) setSelected(firstId);
  }, [firstId, selected, panelClosed]);

  const filtered = ["search", "vehicle_id", "status", "from", "to"].some((k) => params[k]);
  const clearFilters = () => update({ search: "", vehicle_id: "", status: "", from: "", to: "" });

  const patch = useApiMutation(({ id, data }: { id: number; data: Record<string, unknown> }) => maintenanceService.patch(id, data), {
    invalidate: [["maintenance"], ["vehicles"], ["vehicle"]],
  });
  const remove = useApiMutation(() => maintenanceService.remove(deleting!.id), {
    invalidate: [["maintenance"], ["vehicles"]],
    onSuccess: () => {
      if (selected === deleting?.id) setSelected(null);
      setDeleting(null);
    },
  });

  const edit = (r: MaintenanceRecord) => router.push(`${MAINTENANCE_PATH}/${r.id}/edit`);
  const actionsFor = (r: MaintenanceRecord): DropdownItem[] => [
    { label: "View details", icon: <Eye />, onSelect: () => setSelected(r.id) },
    ...(canOperate
      ? [
          { label: "Edit", icon: <Pencil />, onSelect: () => edit(r) },
          ...(r.status === "scheduled" ? [{ label: "Start work", icon: <Play />, onSelect: () => patch.mutate({ id: r.id, data: { status: "in_progress" } }) }] : []),
          ...(r.status === "scheduled" || r.status === "in_progress"
            ? [{ label: "Mark completed today", icon: <CircleCheck />, onSelect: () => patch.mutate({ id: r.id, data: { status: "completed", service_date: format(new Date(), "yyyy-MM-dd") } }) }]
            : []),
          { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setDeleting(r) },
        ]
      : []),
  ];

  const exportAll = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllPages(maintenanceService.list, filters);
      exportCsv(
        "maintenance",
        ["Reference No.", "Plate No.", "Vehicle", "Service Type", "Category", "Status", "Last Service", "Next Due", "Service Date", "Assigned To", "Service Provider", "Estimated Cost (PHP)", "Actual Cost (PHP)", "Odometer (km)"],
        rows.map((r) => [
          r.reference_number,
          r.vehicle?.plate_number,
          vehicleName(r),
          labelOf(MAINTENANCE_TYPES, r.service_type),
          labelOf(MAINTENANCE_CATEGORIES, r.category),
          MAINTENANCE_STATUS[r.display_status].label,
          r.last_service_date,
          r.scheduled_date,
          r.service_date,
          r.assigned_to,
          r.service_provider,
          r.estimated_cost,
          r.actual_cost,
          r.odometer_km,
        ]),
      );
      notify(`Exported ${rows.length} maintenance record${rows.length === 1 ? "" : "s"}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not export maintenance records.", "error");
    } finally {
      setExporting(false);
    }
  };

  const panel = selected ? (
    <MaintenancePanel
      key={selected}
      id={selected}
      canEdit={canOperate}
      onEdit={edit}
      onClose={() => {
        setSelected(null);
        setPanelClosed(true);
      }}
    />
  ) : null;
  const rows = list.data?.data;
  const offset = ((list.data?.meta.current_page ?? 1) - 1) * (list.data?.meta.per_page ?? 0);

  return (
    <>
      {/* Header */}
      <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-sm text-ink-500">
        <span>Fleet &amp; Drivers</span>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-ink-900">Maintenance</span>
      </nav>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Fleet and Drivers</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Manage your vehicles and drivers to ensure safe and efficient operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="lg" onClick={exportAll} loading={exporting} disabled={!list.data?.meta.total}>
            <Download className="h-4 w-4" /> Export
          </Button>
          {canOperate && (
            <Button size="lg" onClick={() => router.push(params.vehicle_id ? `${MAINTENANCE_PATH}/create?vehicle=${params.vehicle_id}` : `${MAINTENANCE_PATH}/create`)}>
              <Plus className="h-5 w-5" /> New Maintenance
            </Button>
          )}
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-100">
        {TABS.map((tab) => {
          const active = tab.href === MAINTENANCE_PATH;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition",
                active ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-800",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Cards double as quick filters. */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {CARDS.map((card) => {
          const stat = summary.data?.data[card.key];
          const active = (params.status as string) === card.filter;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => update({ status: card.filter })}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-white p-4 text-left shadow-card transition hover:border-ink-200",
                active ? "border-brand-300 ring-2 ring-brand-100" : "border-ink-100",
              )}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", card.tone)}>
                <card.icon className="h-6 w-6" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-600">{card.label}</span>
                {stat ? <span className="block text-2xl font-bold text-ink-900">{stat.count}</span> : <span className="mt-1 block h-7 w-12 animate-pulse rounded bg-ink-100" />}
                {stat && <Delta {...stat} upIsBad={card.upIsBad} />}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto]">
        <SearchInput
          value={(params.search as string) ?? ""}
          onChange={(search) => update({ search })}
          placeholder="Search plate number, vehicle, service type..."
          className="sm:col-span-2 lg:col-span-1"
        />
        <Select value={params.vehicle_id as string} onChange={(e) => update({ vehicle_id: e.target.value })} options={vehicleOptions} placeholder="All Vehicles" aria-label="Filter by vehicle" />
        <Select
          value={params.status as string}
          onChange={(e) => update({ status: e.target.value })}
          options={[...statusOptions(MAINTENANCE_STATUS), { value: "upcoming", label: "Upcoming (30 days)" }]}
          placeholder="All Status"
          aria-label="Filter by status"
        />
        <DateRangeFilter from={params.from as string} to={params.to as string} onChange={(from, to) => update({ from, to })} />
        <Button variant="secondary" onClick={() => setMoreFilters((v) => !v)} aria-expanded={moreFilters} className="h-10">
          <SlidersHorizontal className="h-4 w-4" /> Filter
        </Button>
      </div>
      {moreFilters && (
        <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-ink-600">
            Sort by
            <Select value={params.sort as string} onChange={(e) => update({ sort: e.target.value })} options={SORTS} className="w-60" aria-label="Sort maintenance" />
          </label>
          <p className="flex-1 text-xs text-ink-500">Tip: the cards above also filter the schedule. The date range applies to the next due date.</p>
          <Button variant="ghost" onClick={clearFilters} disabled={!filtered}>
            Clear all filters
          </Button>
        </Card>
      )}

      <div className={cn("grid gap-5", panel && "2xl:grid-cols-[minmax(0,1fr)_400px]")}>
        <Card className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
            <h2 className="text-base font-semibold text-ink-900">Maintenance Schedule</h2>
            <div className="flex rounded-lg border border-ink-200 p-0.5" role="group" aria-label="Schedule view">
              {(
                [
                  ["list", "List", List],
                  ["calendar", "Calendar", CalendarDays],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  aria-pressed={view === value}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                    view === value ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {view === "calendar" ? (
            <ScheduleCalendar filters={filters} selected={selected} onSelect={setSelected} />
          ) : (
            <>
              <DataTable
                rows={rows}
                loading={list.isFetching}
                error={list.error}
                onRetry={() => list.refetch()}
                rowKey={(r) => r.id}
                selectedKey={selected}
                sort={params.sort as string}
                onSortChange={(sort) => update({ sort })}
                onRowClick={(r) => setSelected(r.id)}
                empty={
                  filtered
                    ? {
                        title: "No maintenance matches your filters",
                        description: "Try a different vehicle, status, date range or search.",
                        action: (
                          <Button size="sm" variant="secondary" onClick={clearFilters}>
                            Clear filters
                          </Button>
                        ),
                      }
                    : { title: "No maintenance scheduled yet", description: "Schedule a service with New Maintenance." }
                }
                columns={[
                  { key: "n", header: "#", className: "text-ink-500 tabular-nums", cell: (r) => offset + (rows?.indexOf(r) ?? 0) + 1 },
                  { key: "plate", header: "Plate No.", cell: (r) => <span className="font-semibold whitespace-nowrap text-ink-900">{r.vehicle?.plate_number ?? "—"}</span> },
                  { key: "vehicle", header: "Vehicle", cell: (r) => <span className="block min-w-28">{vehicleName(r)}</span> },
                  {
                    key: "type",
                    header: "Service Type",
                    cell: (r) => (
                      <span>
                        <span className="block whitespace-nowrap text-ink-900">{labelOf(MAINTENANCE_TYPES, r.service_type)}</span>
                        <span className="text-xs text-ink-500">{r.reference_number}</span>
                      </span>
                    ),
                  },
                  { key: "last", header: "Last Service", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.last_service_date)}</span> },
                  {
                    key: "due",
                    header: "Next Due",
                    sortKey: "scheduled_date",
                    cell: (r) =>
                      r.status === "completed" ? (
                        <span className="whitespace-nowrap text-ink-500">Done {formatDate(r.service_date)}</span>
                      ) : (
                        <span className={cn("whitespace-nowrap", r.display_status === "overdue" && "font-medium text-red-700")}>{formatDate(r.scheduled_date)}</span>
                      ),
                  },
                  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.display_status} map={MAINTENANCE_STATUS} dot={false} /> },
                  { key: "assigned", header: "Assigned To", cell: (r) => <span className="whitespace-nowrap">{r.assigned_to ?? <span className="text-ink-400">—</span>}</span> },
                  {
                    key: "actions",
                    header: "Actions",
                    headerClassName: "sticky right-0 bg-ink-50 text-center",
                    className: "sticky right-0 bg-white text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
                    cell: (r) => (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={({ toggle }) => (
                            <button type="button" onClick={toggle} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Actions for ${r.reference_number}`}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                          items={actionsFor(r)}
                        />
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="records" showEdges />
            </>
          )}
        </Card>

        {panel}
      </div>

      <ConfirmDialog
        open={!!deleting}
        title="Delete maintenance record"
        message={
          <>
            Delete <strong>{deleting?.reference_number}</strong> ({deleting ? labelOf(MAINTENANCE_TYPES, deleting.service_type) : ""} for {deleting?.vehicle?.plate_number ?? "this vehicle"})?
          </>
        }
        confirmLabel="Delete"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate(undefined)}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
      />
    </>
  );
}

/** "↑ 15% vs. last month"; for overdue work a rise is bad news, so it shows in red. */
function Delta({ count, previous, upIsBad }: { count: number; previous: number; upIsBad?: boolean }) {
  if (count === previous) return <span className="block text-xs text-ink-500">0% vs. last month</span>;
  const up = count > previous;
  const good = up !== !!upIsBad;
  return (
    <span className="block text-xs text-ink-500">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", good ? "text-emerald-600" : "text-brand-600")}>
        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {previous ? `${Math.round((Math.abs(count - previous) / previous) * 100)}%` : `${count - previous} new`}
      </span>{" "}
      vs. last month
    </span>
  );
}

const CHIP: Record<string, string> = {
  scheduled: "bg-sky-50 text-sky-800 hover:bg-sky-100",
  due_soon: "bg-amber-50 text-amber-800 hover:bg-amber-100",
  overdue: "bg-red-50 text-red-800 hover:bg-red-100",
  in_progress: "bg-violet-50 text-violet-800 hover:bg-violet-100",
  completed: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  cancelled: "bg-ink-100 text-ink-600 hover:bg-ink-200",
};

/** Month grid of the filtered records by next due date. */
function ScheduleCalendar({ filters, selected, onSelect }: { filters: ListParams; selected: number | null; onSelect: (id: number) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const params = { ...filters, from: format(month, "yyyy-MM-dd"), to: format(endOfMonth(month), "yyyy-MM-dd"), sort: "scheduled_date", per_page: 100 };
  const records = useQuery({ queryKey: ["maintenance", "calendar", params], queryFn: () => maintenanceService.list(params), placeholderData: keepPreviousData });
  const days = eachDayOfInterval({ start: startOfWeek(month), end: endOfWeek(endOfMonth(month)) });
  const byDay = new Map<string, MaintenanceRecord[]>();
  for (const r of records.data?.data ?? []) byDay.set(r.scheduled_date, [...(byDay.get(r.scheduled_date) ?? []), r]);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="secondary" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-ink-900">{format(month, "MMMM yyyy")}</h3>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>
        <Button variant="secondary" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {records.error ? (
        <ErrorState message={records.error.message} onRetry={() => records.refetch()} />
      ) : records.isLoading ? (
        <LoadingState label="Loading schedule…" />
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[42rem] grid-cols-7 overflow-hidden rounded-lg border border-ink-100 text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="border-b border-ink-100 bg-ink-50 px-2 py-1.5 font-medium text-ink-500">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const items = byDay.get(format(day, "yyyy-MM-dd")) ?? [];
              return (
                <div key={day.toISOString()} className={cn("min-h-24 border-r border-b border-ink-100 p-1.5 [&:nth-child(7n)]:border-r-0", !isSameMonth(day, month) && "bg-ink-50/60")}>
                  <span className={cn("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full", isToday(day) ? "bg-brand-600 font-semibold text-white" : isSameMonth(day, month) ? "text-ink-700" : "text-ink-400")}>
                    {format(day, "d")}
                  </span>
                  <div className="space-y-1">
                    {items.slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onSelect(r.id)}
                        title={`${r.vehicle?.plate_number} · ${labelOf(MAINTENANCE_TYPES, r.service_type)} · ${MAINTENANCE_STATUS[r.display_status].label}`}
                        className={cn("block w-full truncate rounded px-1.5 py-0.5 text-left", CHIP[r.display_status], selected === r.id && "ring-2 ring-brand-400")}
                      >
                        <span className="font-semibold">{r.vehicle?.plate_number}</span> {labelOf(MAINTENANCE_TYPES, r.service_type)}
                      </button>
                    ))}
                    {items.length > 3 && <span className="block px-1.5 text-ink-500">+{items.length - 3} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {(records.data?.meta.total ?? 0) > 100 && <p className="mt-2 text-xs text-ink-500">Showing the first 100 records this month. Narrow the filters to see the rest.</p>}
        </div>
      )}
    </div>
  );
}
