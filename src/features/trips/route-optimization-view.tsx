"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMinutes, format } from "date-fns";
import {
  AlertTriangle,
  Box,
  CalendarDays,
  Download,
  Info,
  ListOrdered,
  Map as MapIcon,
  MapPin,
  MapPinned,
  MoreVertical,
  Package,
  RefreshCw,
  Route,
  Save,
  Send,
  Settings2,
  Sparkles,
  Truck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/use-current-user";
import { TRIP_STATUS, TRIP_TYPES } from "@/lib/constants";
import { cn, formatDate, formatNumber, formatTime } from "@/lib/utils";
import { ordersService, routingService, stopsService, tripsService, vehiclesService, type RoutePlan } from "@/services/resources";
import type { Trip, TripStop } from "@/types/api";
import { useRoutingStatus } from "./route-map";
import { ROUTE_PLANNING_PATH } from "./route-optimization-trip-view";
import { TRIP_KEYS } from "./use-trip";

/** The routing provider plans at most this many trips on one map. */
const MAX_ROUTES = 10;

function formatDuration(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} hr${h > 1 ? "s" : ""}${m ? ` ${m} min${m > 1 ? "s" : ""}` : ""}` : `${m} mins`;
}

/** Departure plus driving legs plus service time at each earlier stop; null without leg data. */
function stopTimes(trip: Trip, plan: RoutePlan | undefined, serviceMinutes: number): (Date | null)[] {
  const count = plan?.stop_ids.length ?? trip.stops?.length ?? 0;
  if (!plan || plan.unresolved.length || plan.legs.length !== count - 1) return Array(count).fill(null);
  let at = new Date(trip.departure_at);
  return plan.stop_ids.map((_, i) => {
    if (i > 0) at = addMinutes(at, plan.legs[i - 1].duration_minutes + serviceMinutes);
    return at;
  });
}

export function RouteOptimizationView() {
  const router = useRouter();
  const notify = useToast();
  const queryClient = useQueryClient();
  const { canOperate } = usePermissions();
  const { configured, provider, loaded } = useRoutingStatus();

  // ----- Filters ---------------------------------------------------------------
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [origin, setOrigin] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [tripType, setTripType] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [view, setView] = useState<"map" | "list">("map");

  // ----- Settings (only what the provider or our own data can honour) -----------
  const [traffic, setTraffic] = useState(false);
  const [checkCapacity, setCheckCapacity] = useState(true);
  const [serviceMinutes, setServiceMinutes] = useState(10);
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("18:00");

  const tripsQuery = useQuery({
    queryKey: ["trips", "route-day", date, origin, vehicleId, tripType],
    queryFn: () => tripsService.list({ scope: "dispatch", from: date, to: date, origin, vehicle_id: vehicleId, trip_type: tripType, per_page: 50, sort: "departure_at" }),
  });
  const vehicles = useQuery({ queryKey: ["vehicles", "options"], queryFn: () => vehiclesService.list({ per_page: 100, sort: "plate_number" }), staleTime: 60_000 });
  // Start locations offered are the origins of the day's open trips.
  const dayTrips = useQuery({
    queryKey: ["trips", "route-day", date, "origins"],
    queryFn: () => tripsService.list({ scope: "dispatch", from: date, to: date, per_page: 100 }),
  });
  const origins = [...new Set((dayTrips.data?.data ?? []).map((t) => t.origin))].sort();

  const trips = useMemo(() => tripsQuery.data?.data ?? [], [tripsQuery.data]);
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const selected = trips.filter((t) => !deselected.has(t.id)).slice(0, MAX_ROUTES);
  const selectedIds = selected.map((t) => t.id);
  const toggle = (id: number) =>
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Full trips (with stops) for the selected routes.
  const details = useQuery({
    queryKey: ["trips", "route-day", "details", selectedIds],
    queryFn: () => Promise.all(selectedIds.map((id) => tripsService.get(id).then((r) => r.data))),
    enabled: selectedIds.length > 0,
  });
  const detailById = new Map((details.data ?? []).map((t) => [t.id, t]));

  // Current (saved) routes, and the optimized proposal once requested.
  const [optimizeRequested, setOptimizeRequested] = useState(false);
  const saved = useQuery({
    queryKey: ["routing", "plan", "saved", selectedIds, traffic],
    queryFn: () => routingService.plan({ trip_ids: selectedIds, traffic }).then((r) => r.data),
    enabled: configured && selectedIds.length > 0,
    staleTime: 300_000,
    retry: false,
  });
  const optimized = useQuery({
    queryKey: ["routing", "plan", "optimized", selectedIds, traffic],
    queryFn: () => routingService.plan({ trip_ids: selectedIds, traffic, optimize: true }).then((r) => r.data),
    enabled: configured && optimizeRequested && selectedIds.length > 0,
    staleTime: 300_000,
    retry: false,
  });
  const showing = optimizeRequested && optimized.data ? optimized.data : saved.data;
  const planFor = (id: number) => showing?.routes.find((r) => r.trip_id === id);
  const baselineFor = (id: number) => saved.data?.routes.find((r) => r.trip_id === id);

  // A proposal differs from what is saved when its stop order changed, or the route isn't marked optimized yet.
  const pending = optimizeRequested && optimized.data
    ? optimized.data.routes.filter((r) => {
        const trip = detailById.get(r.trip_id);
        if (!trip || !r.legs.length || r.unresolved.length || r.stop_ids.length < 4) return false;
        const current = (trip.stops ?? []).map((s) => s.id).join(",");
        return r.stop_ids.join(",") !== current || !trip.route_optimized_at;
      })
    : [];

  const [saving, setSaving] = useState(false);
  const saveRoutes = async (thenDispatch = false) => {
    if (!pending.length) {
      if (thenDispatch) router.push("/transportation/dispatch?status=scheduled");
      else notify(optimizeRequested ? "Routes are already saved in their optimized order." : "Run Optimize Routes first, then save the proposed order.", "error");
      return;
    }
    setSaving(true);
    try {
      for (const route of pending) {
        const trip = detailById.get(route.trip_id)!;
        const middle = new Set((trip.stops ?? []).filter((s) => s.type === "stop").map((s) => s.id));
        await stopsService.reorder(trip.id, route.stop_ids.filter((id) => middle.has(id)), { optimized: true, distance_km: route.distance_km });
      }
      notify(`Saved ${pending.length} optimized route${pending.length === 1 ? "" : "s"}.`);
      [...TRIP_KEYS, ["stops"], ["routing"]].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      setOptimizeRequested(false);
      if (thenDispatch) router.push("/transportation/dispatch?status=scheduled");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save the routes.", "error");
    } finally {
      setSaving(false);
    }
  };

  const unassigned = useQuery({
    queryKey: ["orders", "unassigned", date, orderSearch],
    queryFn: () => ordersService.list({ status: "pending", pickup_from: date, pickup_to: date, search: orderSearch, per_page: 50, sort: "scheduled_pickup_at" }),
  });

  // ----- Totals ------------------------------------------------------------------
  const routeRows = selected.map((trip) => {
    const detail = detailById.get(trip.id);
    const plan = planFor(trip.id);
    const stopCount = plan?.stop_ids.length ?? detail?.stops?.length ?? trip.stops_count ?? 0;
    const drive = plan?.duration_minutes ?? null;
    const total = drive != null ? drive + serviceMinutes * Math.max(0, stopCount - 1) : null;
    const weight = detail ? new Map([detail.order, ...(detail.stops ?? []).map((s) => s.order)].filter((o): o is NonNullable<typeof o> => !!o).map((o) => [o.id, o.weight_kg ?? 0])) : null;
    const load = weight ? [...weight.values()].reduce((a, b) => a + b, 0) : null;
    const times = detail ? stopTimes(detail, plan, serviceMinutes) : [];
    const finish = times[times.length - 1];
    const overCapacity = checkCapacity && !!trip.vehicle?.capacity_kg && load != null && load > trip.vehicle.capacity_kg;
    const outsideWindow = !!finish && (format(new Date(trip.departure_at), "HH:mm") < windowStart || format(finish, "HH:mm") > windowEnd);
    return { trip, detail, plan, stopCount, distance: plan?.distance_km ?? trip.distance_km, drive, total, load, times, overCapacity, outsideWindow };
  });
  const sum = (values: (number | null | undefined)[]) => (values.some((v) => v != null) ? values.reduce<number>((a, v) => a + (v ?? 0), 0) : null);
  const totals = {
    stops: sum(routeRows.map((r) => r.stopCount)),
    distance: sum(routeRows.map((r) => r.distance)),
    duration: sum(routeRows.map((r) => r.total)),
    savedDistance: sum(routeRows.map((r) => baselineFor(r.trip.id)?.distance_km)),
  };
  const mapLoading = saved.isFetching || optimized.isFetching;
  const mapError = (optimizeRequested ? optimized.error : saved.error)?.message;

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Route Optimization</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Optimize delivery routes to cut drive time and distance, then save them for dispatch.</p>
        </div>
        {canOperate && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="secondary" size="lg" onClick={() => saveRoutes(true)} loading={saving}>
              <Send className="h-4 w-4" /> Apply to Dispatch
            </Button>
            <Button size="lg" onClick={() => saveRoutes(false)} loading={saving} disabled={!pending.length} title={pending.length ? undefined : "Optimize routes first; only changed routes are saved"}>
              <Save className="h-4 w-4" /> Save Routes{pending.length ? ` (${pending.length})` : ""}
            </Button>
          </div>
        )}
      </div>

      {loaded && !configured && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No routing provider is configured.</strong> Trips and orders still load, but maps, drive times and optimization need <code className="rounded bg-white/60 px-1">ROUTING_PROVIDER</code> set on the API.
          </span>
        </div>
      )}

      {/* Filter bar */}
      <Card className="mb-5 print:hidden">
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <FilterField icon={<CalendarDays />} label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Departure date" />
          </FilterField>
          <FilterField icon={<MapPin />} label="Start Location">
            <Select value={origin} onChange={(e) => setOrigin(e.target.value)} options={origins.map((o) => ({ value: o, label: o }))} placeholder="All start locations" aria-label="Start location" />
          </FilterField>
          <FilterField icon={<Truck />} label="Vehicles">
            <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} options={(vehicles.data?.data ?? []).map((v) => ({ value: String(v.id), label: `${v.plate_number} · ${v.make} ${v.model}` }))} placeholder="All vehicles" aria-label="Vehicle" />
          </FilterField>
          <FilterField icon={<Box />} label="Trip Type">
            <Select value={tripType} onChange={(e) => setTripType(e.target.value)} options={TRIP_TYPES} placeholder="All trip types" aria-label="Trip type" />
          </FilterField>
          <div className="flex items-end">
            <Button
              size="lg"
              className="w-full xl:w-auto"
              disabled={!configured || selectedIds.length === 0}
              loading={optimized.isFetching}
              onClick={() => (optimizeRequested ? optimized.refetch() : setOptimizeRequested(true))}
              title={configured ? "Find the shortest stop order for each selected route (not saved until you click Save Routes)" : "Requires a routing provider"}
            >
              <Sparkles className="h-4 w-4" /> Optimize Routes
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_19rem]">
        {/* Left column */}
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title={`Unassigned Orders (${unassigned.data?.meta.total ?? 0})`} icon={<Package />} description={`Pending orders with pickup on ${formatDate(date)}`} />
            <div className="p-3 print:hidden">
              <SearchInput value={orderSearch} onChange={setOrderSearch} placeholder="Search orders, customer, address…" />
            </div>
            {unassigned.isLoading ? (
              <LoadingState />
            ) : unassigned.error ? (
              <ErrorState message={unassigned.error.message} onRetry={() => unassigned.refetch()} />
            ) : (unassigned.data?.data.length ?? 0) === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-500">No pending orders to assign for this day.</p>
            ) : (
              <div className="max-h-64 overflow-auto px-3 pb-3">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                    <tr>
                      <th className="px-3 py-2">Order No.</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Address</th>
                      <th className="px-3 py-2">Weight</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {unassigned.data!.data.map((o) => (
                      <tr key={o.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-ink-800">{o.order_number}</td>
                        <td className="px-3 py-2 text-ink-800">{o.customer_name}</td>
                        <td className="max-w-40 truncate px-3 py-2 text-xs text-ink-600" title={o.delivery_address}>
                          {o.delivery_address}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{o.weight_kg ? `${formatNumber(o.weight_kg)} kg` : "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {canOperate && (
                            <button onClick={() => router.push(`/transportation/trip-scheduling/create?order=${o.id}`)} className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                              Assign
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`${optimizeRequested && optimized.data ? "Optimized" : "Planned"} Routes (${selected.length})`}
              icon={<Route />}
              action={optimizeRequested && optimized.data ? <Badge tone="blue">Optimized by {provider ?? "provider"}</Badge> : undefined}
            />
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
              <Chip label="Total Stops" value={totals.stops ?? "—"} />
              <Chip label="Total Distance" value={totals.distance != null ? `${formatNumber(totals.distance, 1)} km` : "—"} />
              <Chip label="Total Duration" value={formatDuration(totals.duration)} />
              <Chip
                label={optimizeRequested && optimized.data ? "vs. saved order" : "Fuel Cost"}
                value={optimizeRequested && optimized.data && totals.distance != null && totals.savedDistance != null ? `${totals.distance - totals.savedDistance <= 0 ? "−" : "+"}${formatNumber(Math.abs(totals.distance - totals.savedDistance), 1)} km` : "Not tracked"}
              />
            </div>
            {tripsQuery.isLoading ? (
              <LoadingState />
            ) : tripsQuery.error ? (
              <ErrorState message={tripsQuery.error.message} onRetry={() => tripsQuery.refetch()} />
            ) : trips.length === 0 ? (
              <EmptyState title="No open trips on this day" description="Scheduled, dispatched or in-progress trips departing on the selected date appear here." icon={<Route className="h-6 w-6" />} />
            ) : (
              <ul className="space-y-3 px-3 pb-3">
                {trips.map((trip) => {
                  const row = routeRows.find((r) => r.trip.id === trip.id);
                  const included = !deselected.has(trip.id) && !!row;
                  const stopsInOrder: TripStop[] = row?.detail
                    ? (row.plan?.stop_ids ?? (row.detail.stops ?? []).map((s) => s.id)).map((id) => row.detail!.stops!.find((s) => s.id === id)!).filter(Boolean)
                    : [];
                  const color = row?.plan?.color ?? "#98a2b3";
                  const baseline = baselineFor(trip.id);
                  return (
                    <li key={trip.id} className={cn("rounded-lg border border-ink-100 border-l-4 p-3", !included && "opacity-60")} style={{ borderLeftColor: included ? color : undefined }}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={included} onChange={() => toggle(trip.id)} className="mt-1 h-4 w-4 accent-brand-600 print:hidden" aria-label={`Include ${trip.trip_number}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink-900">
                              {trip.trip_number} – {trip.vehicle?.plate_number}
                            </p>
                            <StatusBadge status={trip.status} map={TRIP_STATUS} dot={false} />
                            {trip.route_optimized_at && !optimizeRequested && <Badge tone="green">Optimized</Badge>}
                            {row?.overCapacity && <Badge tone="red">Over capacity</Badge>}
                            {row?.outsideWindow && <Badge tone="amber">Outside hours</Badge>}
                          </div>
                          <p className="text-sm text-ink-500">{trip.driver?.full_name}</p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            {row?.stopCount ?? trip.stops_count} stops | {row?.distance != null ? `${formatNumber(row.distance, 1)} km` : "— km"} | {formatDuration(row?.total)}
                            {optimizeRequested && optimized.data && baseline?.distance_km != null && row?.distance != null && row.distance !== baseline.distance_km && (
                              <span className="ml-1 font-medium text-emerald-700">({formatNumber(row.distance - baseline.distance_km, 1)} km)</span>
                            )}
                          </p>
                          {row?.plan?.unresolved.length ? <p className="mt-1 text-xs text-amber-700">Couldn&apos;t locate: {row.plan.unresolved.join(", ")}</p> : null}
                          {included && stopsInOrder.length > 0 && (
                            <ol className="mt-2 space-y-1">
                              {stopsInOrder.map((stop, i) => (
                                <li key={stop.id} className="flex items-center gap-2 text-xs">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: color }}>
                                    {i + 1}
                                  </span>
                                  <span className="truncate text-ink-800">{stop.location_name}</span>
                                  <span className="ml-auto shrink-0 text-ink-500">{row?.times[i] ? formatTime(row.times[i]!) : stop.estimated_arrival_at ? formatTime(stop.estimated_arrival_at) : ""}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                        <Dropdown
                          trigger={({ toggle: open }) => (
                            <button onClick={open} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 print:hidden" aria-label={`Actions for ${trip.trip_number}`}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                          items={[
                            { label: "Plan stops by hand", icon: <ListOrdered />, onSelect: () => router.push(`${ROUTE_PLANNING_PATH}/${trip.id}`) },
                            { label: "Preview itinerary", icon: <MapPinned />, onSelect: () => router.push(`/transportation/itinerary/${trip.id}`) },
                            ...(trip.status === "scheduled" ? [{ label: "Dispatch", icon: <Send />, onSelect: () => router.push(`/transportation/dispatch/${trip.id}`) }] : []),
                          ]}
                        />
                      </div>
                    </li>
                  );
                })}
                {trips.length > MAX_ROUTES && <li className="text-xs text-ink-500">Up to {MAX_ROUTES} routes are planned at once; untick some to include others.</li>}
              </ul>
            )}
          </Card>
        </div>

        {/* Map / list */}
        <Card className="min-w-0 xl:self-start">
          <div className="flex items-center gap-1 border-b border-ink-100 px-3" role="tablist">
            {(["map", "list"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn("-mb-px border-b-2 px-4 py-3 text-sm font-medium", view === v ? "border-brand-600 text-brand-600" : "border-transparent text-ink-600 hover:text-ink-900")}
              >
                {v === "map" ? "Map View" : "List View"}
              </button>
            ))}
            {mapLoading && <RefreshCw className="ml-auto h-4 w-4 animate-spin text-ink-400" aria-label="Updating routes" />}
          </div>
          {view === "map" ? (
            <div className="relative m-3 min-h-[34rem] overflow-hidden rounded-lg border border-ink-100 bg-ink-50">
              {showing?.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI rendered by the API
                <img src={showing.image} alt="Routes map" className={cn("absolute inset-0 h-full w-full object-cover", mapLoading && "opacity-60")} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
                  {mapLoading ? <LoadingState label="Drawing routes…" /> : <MapIcon className="h-8 w-8 text-ink-300" />}
                  {!mapLoading && (
                    <p className="max-w-64 text-sm text-ink-500">{!configured ? "Map provider not configured." : mapError ? mapError : selectedIds.length ? "The map could not be drawn." : "Select at least one route."}</p>
                  )}
                </div>
              )}
              {showing && (
                <div className="absolute top-3 right-3 max-w-56 space-y-1.5 rounded-lg bg-white/95 p-3 text-xs shadow-md">
                  {trips.slice(0, MAX_ROUTES + 2).map((trip) => {
                    const plan = showing.routes.find((r) => r.trip_id === trip.id);
                    return (
                      <Checkbox
                        key={trip.id}
                        checked={!deselected.has(trip.id)}
                        onChange={() => toggle(trip.id)}
                        label={
                          <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan?.color ?? "#98a2b3" }} />
                            {trip.trip_number} – {trip.vehicle?.plate_number}
                          </span>
                        }
                        className="text-xs"
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto p-3">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                  <tr>
                    <th className="px-3 py-2">Route</th>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Stop</th>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2">Est. Time</th>
                    <th className="px-3 py-2">Leg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {routeRows.flatMap((row) =>
                    (row.plan?.stop_ids ?? (row.detail?.stops ?? []).map((s) => s.id)).map((id, i) => {
                      const stop = row.detail?.stops?.find((s) => s.id === id);
                      const leg = i > 0 ? row.plan?.legs[i - 1] : undefined;
                      return (
                        <tr key={`${row.trip.id}-${id}`}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.plan?.color ?? "#98a2b3" }} />
                              {row.trip.trip_number}
                            </span>
                          </td>
                          <td className="px-3 py-2">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-ink-900">{stop?.location_name}</td>
                          <td className="max-w-56 truncate px-3 py-2 text-xs text-ink-600">{stop?.address ?? "—"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.times[i] ? formatTime(row.times[i]!) : "—"}</td>
                          <td className="px-3 py-2 text-xs whitespace-nowrap text-ink-500">{leg ? `${formatNumber(leg.distance_km, 1)} km · ${leg.duration_minutes} min` : "Start"}</td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
              {routeRows.length === 0 && <p className="p-4 text-sm text-ink-500">Select at least one route.</p>}
            </div>
          )}
        </Card>

        {/* Settings and summary */}
        <div className="min-w-0 space-y-5 xl:col-span-2 xl:grid xl:grid-cols-2 xl:gap-5 xl:space-y-0 2xl:col-span-1 2xl:block 2xl:space-y-5">
          <Card>
            <CardHeader title="Optimization Settings" icon={<Settings2 />} />
            <CardBody className="space-y-4 text-sm">
              <label className="block">
                <span className="mb-1.5 block font-medium text-ink-800">Optimization Goal</span>
                <Select value="time" onChange={() => undefined} options={[{ value: "time", label: "Shortest drive time" }]} disabled />
                <span className="mt-1 block text-xs text-ink-500">The routing provider optimizes for drive time.</span>
              </label>
              <div>
                <p className="mb-1.5 font-medium text-ink-800">Consider Traffic</p>
                <Checkbox label="Use live and typical traffic" checked={traffic} onChange={(e) => setTraffic(e.target.checked)} disabled={!configured} />
              </div>
              <div>
                <p className="mb-1.5 font-medium text-ink-800">Vehicle Capacity</p>
                <Checkbox label="Flag routes over vehicle capacity" checked={checkCapacity} onChange={(e) => setCheckCapacity(e.target.checked)} />
              </div>
              <div>
                <p className="mb-1.5 font-medium text-ink-800">Time Windows</p>
                <Checkbox label="Customer time windows" checked={false} disabled />
                <span className="mt-1 block text-xs text-ink-500">Not supported by the current routing provider.</span>
              </div>
              <label className="block">
                <span className="mb-1.5 block font-medium text-ink-800">Service Time per Stop</span>
                <div className="flex">
                  <Input type="number" min={0} max={240} value={serviceMinutes} onChange={(e) => setServiceMinutes(Math.max(0, Number(e.target.value) || 0))} className="rounded-r-none" />
                  <span className="flex items-center rounded-r-lg border border-l-0 border-ink-200 bg-ink-50 px-3 text-xs text-ink-600">mins</span>
                </div>
                <span className="mt-1 block text-xs text-ink-500">Added to estimated times and durations.</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block font-medium text-ink-800">Start Time</span>
                  <Input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block font-medium text-ink-800">End Time</span>
                  <Input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
                </label>
              </div>
              <span className="block text-xs text-ink-500">Routes that start before or finish after these times are flagged.</span>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Route Summary" icon={<ListOrdered />} />
            <CardBody className="space-y-4 text-sm">
              <dl className="space-y-2">
                <SummaryRow label="Total Routes" value={selected.length} />
                <SummaryRow label="Total Stops" value={totals.stops ?? "—"} />
                <SummaryRow label="Total Distance" value={totals.distance != null ? `${formatNumber(totals.distance, 1)} km` : "—"} />
                <SummaryRow label="Estimated Duration" value={formatDuration(totals.duration)} />
                <SummaryRow label="Estimated Fuel Cost" value={<span className="font-normal text-ink-400">Not tracked</span>} />
              </dl>
              {routeRows.some((r) => r.overCapacity || r.outsideWindow) && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Some routes are over capacity or outside working hours. Check the flagged routes.
                </p>
              )}
              <Button className="w-full print:hidden" onClick={() => (optimizeRequested ? optimized.refetch() : saved.refetch())} disabled={!configured || selectedIds.length === 0} loading={mapLoading}>
                <RefreshCw className="h-4 w-4" /> Recalculate Route
              </Button>
              <Button variant="secondary" className="w-full print:hidden" onClick={() => window.print()}>
                <Download className="h-4 w-4" /> Export Routes (PDF)
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function FilterField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <label className="flex items-end gap-3">
      <span className="mb-2 text-ink-700 [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-xs font-medium text-ink-500">{label}</span>
        {children}
      </span>
    </label>
  );
}

function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
