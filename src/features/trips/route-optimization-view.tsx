"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Info, ListOrdered, MapPinned, MoreVertical, MoveRight, Route, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { StatFilterCards, type StatFilterCard } from "@/components/ui/stat-filter-cards";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { TRIP_STATUS } from "@/lib/constants";
import { exportCsv, fetchAllPages } from "@/lib/export";
import { formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { stopsService, tripsService } from "@/services/resources";
import type { Trip } from "@/types/api";
import { useRoutingStatus } from "./route-map";
import { ROUTE_PLANNING_PATH } from "./route-optimization-trip-view";
import { TRIP_KEYS } from "./use-trip";

const ROUTE_FILTERS = [
  { value: "unoptimized", label: "Needs planning" },
  { value: "optimized", label: "Optimized" },
  { value: "none", label: "Nothing to optimize" },
];

/** Trips with fewer than two stops between origin and destination have nothing to reorder. */
const intermediateStops = (trip: Trip) => Math.max(0, (trip.stops_count ?? 0) - 2);

function RouteState({ trip }: { trip: Trip }) {
  if (trip.route_optimized_at)
    return (
      <span className="flex flex-col items-start gap-0.5">
        <Badge tone="green">Optimized</Badge>
        <span className="text-xs text-ink-500">{formatDateTime(trip.route_optimized_at)}</span>
      </span>
    );
  if (intermediateStops(trip) === 0) return <Badge tone="gray">Direct</Badge>;
  return <Badge tone="amber">Manual order</Badge>;
}

export function RouteOptimizationView() {
  const router = useRouter();
  const notify = useToast();
  const { canOperate } = usePermissions();
  const { configured, provider } = useRoutingStatus();
  const { params, update, setPage } = useListParams({ route: "unoptimized", sort: "departure_at", per_page: 10, from: "", to: "" });
  // "none" = open trips with fewer than two stops between origin and destination (nothing to reorder).
  const query = { ...params, scope: "dispatch", route: params.route === "none" ? undefined : params.route || undefined, max_stops: params.route === "none" ? 3 : undefined };
  const list = useQuery({ queryKey: ["trips", "route-planning", query], queryFn: () => tripsService.list(query), placeholderData: keepPreviousData });
  const [running, setRunning] = useState<number | null>(null);

  // Card counts: totals of the same open-trip list under each route filter.
  const countOf = (route?: string) => ({
    queryKey: ["trips", "route-planning", "count", route ?? "all"],
    queryFn: () => tripsService.list({ scope: "dispatch", route, per_page: 1 }).then((r) => r.meta.total),
  });
  const total = useQuery(countOf());
  const needs = useQuery(countOf("unoptimized"));
  const done = useQuery(countOf("optimized"));
  const cards: StatFilterCard[] = [
    { key: "", label: "Open Trips", icon: Route, tone: "bg-brand-50 text-brand-600", count: total.data, hint: "Scheduled, dispatched or in progress" },
    { key: "unoptimized", label: "Needs Planning", icon: ListOrdered, tone: "bg-amber-50 text-amber-600", count: needs.data, hint: "2+ stops in manual order" },
    { key: "optimized", label: "Optimized", icon: Sparkles, tone: "bg-emerald-50 text-emerald-600", count: done.data, hint: "Order from route optimization" },
    {
      key: "none",
      label: "Nothing to Optimize",
      icon: MoveRight,
      tone: "bg-ink-100 text-ink-600",
      count: total.data !== undefined && needs.data !== undefined && done.data !== undefined ? total.data - needs.data - done.data : undefined,
      hint: "Direct or one stop between",
    },
  ];

  const filtered = ["from", "to", "search"].some((k) => params[k]);
  const [exporting, setExporting] = useState(false);
  const runExport = async () => {
    setExporting(true);
    try {
      const trips = await fetchAllPages(tripsService.list, { ...query, page: undefined, per_page: undefined });
      exportCsv(
        "route-planning",
        ["Trip No.", "Origin", "Destination", "Departure", "Stops", "Distance (km)", "Stop Order", "Optimized At", "Vehicle", "Driver", "Trip Status"],
        trips.map((t) => [
          t.trip_number,
          t.origin,
          t.destination,
          formatDateTime(t.departure_at),
          t.stops_count,
          t.distance_km,
          t.route_optimized_at ? "Optimized" : intermediateStops(t) < 2 ? "Nothing to optimize" : "Manual order",
          t.route_optimized_at ? formatDateTime(t.route_optimized_at) : "",
          t.vehicle?.plate_number,
          t.driver?.full_name,
          TRIP_STATUS[t.status].label,
        ]),
      );
      notify(`Exported ${trips.length} trip${trips.length === 1 ? "" : "s"}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  // Optimize and save in one go: ask the provider for the best order, then store it as the optimized route.
  const optimize = useApiMutation(
    async (trip: Trip) => {
      const result = (await tripsService.optimize(trip.id)).data as { stop_ids: number[]; distance_km: number | null };
      const detail = (await tripsService.get(trip.id)).data;
      const middle = new Set((detail.stops ?? []).filter((s) => s.type === "stop").map((s) => s.id));
      await stopsService.reorder(trip.id, result.stop_ids.filter((id) => middle.has(id)), { optimized: true, distance_km: result.distance_km });
      return { trip, distance: result.distance_km };
    },
    {
      invalidate: [...TRIP_KEYS, ["stops"]],
      onSuccess: ({ trip, distance }) => notify(`${trip.trip_number} optimized${distance != null ? ` (${formatNumber(distance, 1)} km)` : ""}.`),
    },
  );

  const run = (trip: Trip) => {
    setRunning(trip.id);
    optimize.mutate(trip, { onSettled: () => setRunning(null) });
  };

  return (
    <>
      <PageHeader
        title="Route Optimization"
        description="Open trips and the state of their stop order. Optimize multi-stop routes or open a trip to plan it by hand."
        actions={
          <Button variant="secondary" size="lg" onClick={runExport} loading={exporting}>
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <div
        className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        role="status"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {configured ? (
          <span>Routing provider “{provider}” is configured. Optimize reorders the stops between origin and destination for the shortest drive and saves the driving distance.</span>
        ) : (
          <span>
            <strong>No routing provider is configured.</strong> Open a trip to order its stops by hand. Automatic optimization needs <code className="rounded bg-white/60 px-1">ROUTING_PROVIDER</code> set on the API.
          </span>
        )}
      </div>

      <StatFilterCards cards={cards} active={params.route as string} onSelect={(route) => update({ route })} loading={total.isLoading} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]">
        <DateRangeFilter from={params.from as string} to={params.to as string} onChange={(from, to) => update({ from, to })} emptyLabel="All departure dates" />
        <Select value={params.route as string} onChange={(e) => update({ route: e.target.value })} options={ROUTE_FILTERS} placeholder="All open trips" aria-label="Filter by stop order" />
        <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search trip, origin, destination, driver, plate…" />
        <Button variant="secondary" onClick={() => update({ from: "", to: "", search: "" })} disabled={!filtered} className="h-10">
          <X className="h-4 w-4" /> Clear
        </Button>
      </div>

      <Card>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(t) => t.id}
          sort={params.sort as string}
          onSortChange={(sort) => update({ sort })}
          onRowClick={(t) => router.push(`${ROUTE_PLANNING_PATH}/${t.id}`)}
          empty={
            params.route === "unoptimized"
              ? { title: "Every multi-stop route is planned", description: "Open trips with two or more stops between origin and destination appear here until their order is optimized." }
              : { title: "No trips", description: "Open trips (scheduled, dispatched or in progress) appear here." }
          }
          columns={[
            { key: "no", header: "Trip No.", sortKey: "trip_number", cell: (t) => <span className="font-semibold text-ink-900">{t.trip_number}</span> },
            { key: "route", header: "Route", cell: (t) => <span className="line-clamp-2 max-w-56 whitespace-normal">{t.origin} → {t.destination}</span> },
            {
              key: "dep",
              header: "Departure",
              sortKey: "departure_at",
              cell: (t) => (
                <span className="whitespace-nowrap">
                  <span className="block text-ink-900">{formatDate(t.departure_at)}</span>
                  <span className="text-xs text-ink-500">{formatTime(t.departure_at)}</span>
                </span>
              ),
            },
            { key: "stops", header: "Stops", cell: (t) => <span>{t.stops_count ?? "—"}{intermediateStops(t) > 0 && <span className="text-xs text-ink-500"> ({intermediateStops(t)} between)</span>}</span> },
            { key: "distance", header: "Distance", cell: (t) => (t.distance_km != null ? `${formatNumber(t.distance_km, 1)} km` : <span className="text-ink-400">—</span>) },
            { key: "plan", header: "Stop Order", cell: (t) => <RouteState trip={t} /> },
            {
              key: "crew",
              header: "Vehicle / Driver",
              cell: (t) => (
                <span className="text-xs">
                  <span className="block font-medium text-ink-900">{t.vehicle?.plate_number}</span>
                  <span className="text-ink-500">{t.driver?.full_name}</span>
                </span>
              ),
            },
            { key: "status", header: "Trip Status", sortKey: "status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} dot={false} /> },
            {
              key: "actions",
              header: "Actions",
              // Pinned so the menu stays reachable when the table scrolls sideways.
              headerClassName: "sticky right-0 bg-ink-50 text-center",
              className: "sticky right-0 bg-white text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
              cell: (t) => {
                const canOptimize = canOperate && configured && intermediateStops(t) >= 2;
                return (
                  // Clicks here must not open the row.
                  <div onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1">
                    {running === t.id && <span className="text-xs text-ink-500">Optimizing…</span>}
                    <Dropdown
                      trigger={({ toggle }) => (
                        <button onClick={toggle} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Actions for ${t.trip_number}`}>
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      )}
                      items={[
                        ...(canOptimize
                          ? [{ label: t.route_optimized_at ? "Re-optimize route" : "Optimize route", icon: <Sparkles />, onSelect: () => run(t), disabled: running !== null }]
                          : []),
                        { label: "Plan route", icon: <MapPinned />, onSelect: () => router.push(`${ROUTE_PLANNING_PATH}/${t.id}`) },
                      ]}
                    />
                  </div>
                );
              },
            },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} perPage={params.per_page} onPerPageChange={(per_page) => update({ per_page })} noun="trips" showEdges />
      </Card>
    </>
  );
}
