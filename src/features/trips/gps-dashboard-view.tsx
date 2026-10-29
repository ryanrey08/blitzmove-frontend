"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Circle,
  Eye,
  Flag,
  Fuel,
  Info,
  Locate,
  Map as MapIcon,
  MapPin,
  Maximize2,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Route,
  Send,
  Shapes,
  SkipForward,
  Truck,
  Video,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { SearchInput } from "@/components/ui/search-input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-current-user";
import type { Tone } from "@/lib/constants";
import { cn, formatDateTime, formatNumber, formatRelative, formatTime } from "@/lib/utils";
import { fuelService, gpsService, tripsService } from "@/services/resources";
import type { Vehicle } from "@/types/api";
import { GPS_PATH } from "./gps-tracking-view";

/** A position older than this counts as offline. */
const STALE_MINUTES = 15;
/** At or below this speed a vehicle counts as stopped. */
const MOVING_KPH = 3;

type TrackingStatus = "on_trip" | "delayed" | "idle" | "offline" | "no_signal";

/** Derived only from reported positions and trip times; nothing is assumed when a vehicle hasn't reported. */
const TRACKING: Record<TrackingStatus, { label: string; tone: Tone; color: string; hint: string }> = {
  on_trip: { label: "On Trip", tone: "green", color: "#16a34a", hint: "Reporting, on a dispatched or active trip" },
  delayed: { label: "Delayed", tone: "amber", color: "#f59e0b", hint: "Active trip past its estimated arrival" },
  idle: { label: "Idle", tone: "blue", color: "#2563eb", hint: "Reporting, no active trip" },
  offline: { label: "Offline", tone: "red", color: "#e30613", hint: `No report in ${STALE_MINUTES}+ minutes` },
  no_signal: { label: "No Signal", tone: "gray", color: "#98a2b3", hint: "Has never reported a position" },
};

function trackingStatus(v: Vehicle): TrackingStatus {
  const loc = v.latest_location;
  if (!loc) return "no_signal";
  if (Date.now() - new Date(loc.recorded_at).getTime() > STALE_MINUTES * 60_000) return "offline";
  if (v.active_trip && new Date(v.active_trip.estimated_arrival_at).getTime() < Date.now()) return "delayed";
  return v.active_trip ? "on_trip" : "idle";
}

/** `/transportation/gps-tracking/live`: map-first fleet dashboard (the table stays on GPS Tracking). */
export function GpsDashboardView() {
  const router = useRouter();
  const { canOperate } = usePermissions();
  const mapRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [mapSearch, setMapSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tripFilter, setTripFilter] = useState("");
  const [style, setStyle] = useState<"streets" | "satellite">("streets");
  const [traffic, setTraffic] = useState(false);
  const [focused, setFocused] = useState<number | null>(null);

  // Polls every 30 s; positions arrive only from a telematics integration (POST /gps/locations).
  const gps = useQuery({ queryKey: ["gps"], queryFn: gpsService.vehicles, refetchInterval: 30_000 });
  const meta = gps.data?.meta;
  const vehicles = gps.data?.data ?? [];
  const today = format(new Date(), "yyyy-MM-dd");
  const summary = useQuery({ queryKey: ["trips", "summary"], queryFn: tripsService.summary, refetchInterval: 60_000 });
  const completedToday = useQuery({ queryKey: ["trips", "completed-today", today], queryFn: () => tripsService.list({ status: "completed", from: today, to: today, per_page: 1 }).then((r) => r.meta.total) });
  const fuelToday = useQuery({ queryKey: ["fuel", "today", today], queryFn: () => fuelService.summary({ from: today, to: today }).then((r) => r.data) });
  const events = useQuery({ queryKey: ["gps", "events"], queryFn: () => gpsService.events(), refetchInterval: 60_000 });

  const rows = vehicles.map((v, i) => ({ vehicle: v, index: i + 1, status: trackingStatus(v), place: meta?.places?.[v.id] }));
  const count = (s: TrackingStatus) => rows.filter((r) => r.status === s).length;
  const matches = (term: string, r: (typeof rows)[number]) =>
    !term || [r.vehicle.plate_number, r.vehicle.make, r.vehicle.model, r.vehicle.active_trip?.driver?.full_name, r.vehicle.assigned_driver?.full_name, r.vehicle.active_trip?.trip_number, r.place].some((x) => x?.toLowerCase().includes(term.trim().toLowerCase()));
  const listed = rows.filter((r) => (!status || r.status === status) && (!tripFilter || String(r.vehicle.active_trip?.id) === tripFilter) && matches(search, r));
  const onMap = rows.filter((r) => r.vehicle.latest_location && matches(mapSearch, r) && (!focused || r.vehicle.id === focused));
  const activeTrips = vehicles.filter((v) => v.active_trip).map((v) => v.active_trip!);

  const markers = onMap.map((r) => ({ vehicle_id: r.vehicle.id, label: String(r.index), color: TRACKING[r.status].color }));
  const map = useQuery({
    queryKey: ["gps", "map", markers, style, traffic, gps.dataUpdatedAt],
    queryFn: () => gpsService.map({ markers, style, traffic }).then((r) => r.data),
    enabled: !!meta?.map_provider_configured,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const [tripId, setTripId] = useState<number | null>(null);
  const progressTripId = tripId ?? activeTrips[0]?.id ?? null;
  const progressTrip = useQuery({ queryKey: ["trip", progressTripId], queryFn: () => tripsService.get(progressTripId!).then((r) => r.data), enabled: !!progressTripId, refetchInterval: 60_000 });

  const inProgress = summary.data?.data.find((s) => s.status === "in_progress")?.count;
  const focusedRow = rows.find((r) => r.vehicle.id === focused);

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">GPS Live Map</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Monitor your fleet&apos;s reported positions, track deliveries, and spot delays.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-500">
            <span>Transportation</span>
            <ChevronRight className="h-4 w-4" />
            <Link href={GPS_PATH} className="hover:text-ink-900">
              GPS Tracking
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-ink-900">Live Map</span>
          </nav>
          {canOperate && (
            <Button size="lg" className="sm:ml-4" onClick={() => router.push("/transportation/trip-scheduling/create")}>
              <Plus className="h-5 w-5" /> New Trip
            </Button>
          )}
        </div>
      </div>

      {meta && !meta.has_gps_data && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No GPS data has been received yet.</strong> Vehicles appear on the map once a telematics device or integration posts positions to{" "}
            <code className="rounded bg-white/60 px-1">POST /api/v1/gps/locations</code>. BlitzMove never simulates positions.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
        <Stat icon={<Truck />} tone="text-ink-800" label="Total Vehicles" value={gps.data ? vehicles.length : undefined} sub={gps.data ? `${count("on_trip") + count("delayed")} on trip | ${count("idle")} idle | ${count("offline") + count("no_signal")} offline` : undefined} />
        <Stat icon={<MapPin />} tone="text-emerald-600" label="Active Trips" value={inProgress} sub="In progress" />
        <Stat icon={<CheckCircle2 />} tone="text-sky-600" label="Completed Today" value={completedToday.data} sub="Trips departing today" />
        <Stat icon={<AlertTriangle />} tone="text-brand-600" label="Delayed Trips" value={gps.data ? count("delayed") : undefined} sub={count("delayed") ? <span className="text-brand-700">Need attention</span> : "Past estimated arrival"} />
        <Stat icon={<Fuel />} tone="text-ink-800" label="Fuel Purchased" value={fuelToday.data ? `${formatNumber(fuelToday.data.total_liters, 0)} L` : undefined} sub="Today, from fuel records" />
        <Link href="/reports" className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-ink-100 bg-white px-5 py-4 font-semibold text-sky-700 shadow-card hover:bg-sky-50 md:col-span-1">
          <BarChart3 className="h-5 w-5" /> View Reports
        </Link>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Map */}
        <Card className="min-w-0 overflow-hidden">
          <div ref={mapRef} className="relative min-h-[30rem] bg-ink-50 sm:min-h-[34rem]">
            {map.data?.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI rendered by the API
              <img src={map.data.image} alt="Fleet map" className={cn("absolute inset-0 h-full w-full object-cover", map.isFetching && "opacity-70")} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
                {map.isFetching || gps.isLoading ? <LoadingState label="Loading map…" /> : <MapIcon className="h-8 w-8 text-ink-300" />}
                {!map.isFetching && !gps.isLoading && (
                  <p className="max-w-64 text-sm text-ink-500">{!meta?.map_provider_configured ? "Map provider not configured." : (map.error?.message ?? "The map could not be drawn.")}</p>
                )}
              </div>
            )}

            {/* Controls */}
            <div className="absolute inset-x-3 top-3 flex flex-wrap items-center gap-2">
              <div className="flex overflow-hidden rounded-lg bg-white shadow-md">
                {(["streets", "satellite"] as const).map((s) => (
                  <button key={s} onClick={() => setStyle(s)} className={cn("px-3 py-2 text-sm font-medium", style === s ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-50")}>
                    {s === "streets" ? "Map View" : "Satellite"}
                  </button>
                ))}
              </div>
              <SearchInput value={mapSearch} onChange={setMapSearch} placeholder="Search vehicle, driver or location…" className="order-last w-full shadow-md sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-72" />
              <button disabled title="Geofences are not set up yet" className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm text-ink-400 shadow-md">
                <Shapes className="h-4 w-4" /> Geofences
              </button>
              <label className={cn("flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-md", style === "satellite" ? "text-ink-400" : "text-ink-700")} title={style === "satellite" ? "Traffic is shown on Map View" : undefined}>
                Traffic
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={traffic} disabled={style === "satellite"} onChange={(e) => setTraffic(e.target.checked)} />
              </label>
              <button onClick={() => mapRef.current?.requestFullscreen?.()} className="rounded-lg bg-white p-2 text-ink-700 shadow-md hover:bg-ink-50" aria-label="Full screen map">
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 space-y-1.5 rounded-lg bg-white/95 p-3 text-xs shadow-md">
              <p className="mb-1 font-semibold text-ink-900">Vehicle Status</p>
              {(Object.keys(TRACKING) as TrackingStatus[]).map((s) => (
                <p key={s} className="flex items-center gap-2 text-ink-700" title={TRACKING[s].hint}>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: TRACKING[s].color }} /> {TRACKING[s].label}
                </p>
              ))}
            </div>

            <div className="absolute right-3 bottom-3 flex flex-col items-end gap-2">
              {focusedRow && (
                <button onClick={() => setFocused(null)} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-ink-700 shadow-md hover:bg-ink-50">
                  <X className="h-3.5 w-3.5" /> {focusedRow.vehicle.plate_number} · show all
                </button>
              )}
              {map.data && <span className="rounded-md bg-white/90 px-2 py-1 text-[11px] text-ink-600 shadow">{map.data.plotted} vehicle{map.data.plotted === 1 ? "" : "s"} plotted · updated {format(new Date(gps.dataUpdatedAt || Date.now()), "h:mm a")}</span>}
            </div>
          </div>
        </Card>

        {/* Vehicle list */}
        <Card className="min-w-0">
          <CardHeader title={`Vehicle List (${vehicles.length})`} icon={<Truck />} />
          <div className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} options={(Object.keys(TRACKING) as TrackingStatus[]).map((s) => ({ value: s, label: TRACKING[s].label }))} placeholder="All Status" aria-label="Filter by tracking status" />
            <Select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} options={activeTrips.map((t) => ({ value: String(t.id), label: t.trip_number }))} placeholder="All Trips" aria-label="Filter by trip" />
            <SearchInput value={search} onChange={setSearch} placeholder="Search vehicle or driver…" />
          </div>
          {gps.isLoading ? (
            <LoadingState />
          ) : gps.error ? (
            <ErrorState message={gps.error.message} onRetry={() => gps.refetch()} />
          ) : (
            <div className="max-h-[27rem] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-ink-50 text-xs font-semibold text-ink-600">
                  <tr>
                    <th className="px-3 py-2.5">Vehicle</th>
                    <th className="px-3 py-2.5">Driver</th>
                    <th className="px-3 py-2.5">Current Location</th>
                    <th className="px-3 py-2.5">Speed</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Last Update</th>
                    <th className="sticky right-0 bg-ink-50 px-3 py-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {listed.map(({ vehicle: v, index, status: s, place }) => {
                    const loc = v.latest_location;
                    const driver = v.active_trip?.driver?.full_name ?? v.assigned_driver?.full_name;
                    return (
                      <tr key={v.id} className={cn("cursor-pointer hover:bg-ink-50", focused === v.id && "bg-brand-50/60")} onClick={() => router.push(`${GPS_PATH}/${v.id}`)}>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: TRACKING[s].color }}>
                              {index}
                            </span>
                            <span>
                              <span className="block font-semibold whitespace-nowrap text-ink-900">{v.plate_number}</span>
                              <span className="text-xs text-ink-500">
                                {v.make} {v.model}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-700">{driver ?? <span className="text-ink-400">—</span>}</td>
                        <td className="max-w-40 min-w-32 px-3 py-2.5 text-xs text-ink-700">
                          {loc ? (place ? <span className="line-clamp-2">{place}</span> : <span className="font-mono">{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>) : <span className="text-ink-400">No position</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{loc?.speed_kph != null ? `${formatNumber(loc.speed_kph)} km/h` : "—"}</td>
                        <td className="px-3 py-2.5">
                          <Badge tone={TRACKING[s].tone}>{TRACKING[s].label}</Badge>
                          {loc && s !== "offline" && loc.speed_kph != null && <span className="mt-0.5 block text-[11px] text-ink-500">{loc.speed_kph > MOVING_KPH ? "Moving" : "Stopped"}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap text-ink-600" title={loc ? formatDateTime(loc.recorded_at) : undefined}>
                          {loc ? formatRelative(loc.recorded_at) : "—"}
                        </td>
                        <td className="sticky right-0 bg-white px-3 py-2.5 text-center whitespace-nowrap shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setFocused(focused === v.id ? null : v.id)}
                            disabled={!loc}
                            className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 disabled:opacity-30"
                            aria-label={`Show ${v.plate_number} on the map`}
                            title={loc ? "Show on map" : "No position reported"}
                          >
                            <Locate className="h-4 w-4" />
                          </button>
                          <Dropdown
                            trigger={({ toggle }) => (
                              <button onClick={toggle} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100" aria-label={`Actions for ${v.plate_number}`}>
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                            items={[
                              { label: "Tracking details", icon: <Eye />, onSelect: () => router.push(`${GPS_PATH}/${v.id}`) },
                              { label: "Vehicle profile", icon: <Truck />, onSelect: () => router.push(`/fleet/vehicles/${v.id}`) },
                              ...(v.active_trip ? [{ label: "Trip itinerary", icon: <Route />, onSelect: () => router.push(`/transportation/itinerary/${v.active_trip!.id}`) }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {listed.length === 0 && <p className="p-6 text-center text-sm text-ink-500">No vehicles match these filters.</p>}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Trip progress */}
        <Card className="min-w-0 lg:col-span-2 2xl:col-span-1">
          <CardHeader
            title="Trip Progress"
            icon={<Route />}
            action={
              activeTrips.length > 0 && (
                <Select value={progressTripId ? String(progressTripId) : ""} onChange={(e) => setTripId(Number(e.target.value) || null)} options={activeTrips.map((t) => ({ value: String(t.id), label: t.trip_number }))} aria-label="Trip" className="h-9 w-44" />
              )
            }
          />
          {!progressTripId ? (
            <p className="p-6 text-sm text-ink-500">No dispatched or in-progress trips right now.</p>
          ) : progressTrip.isLoading ? (
            <LoadingState />
          ) : progressTrip.data ? (
            <div className="overflow-x-auto p-5">
              <ol className="flex min-w-max items-start">
                {(progressTrip.data.stops ?? []).map((stop, i, all) => {
                  const done = stop.status === "completed" || stop.status === "arrived";
                  const skipped = stop.status === "skipped";
                  return (
                    <li key={stop.id} className="relative flex w-36 flex-col items-center text-center">
                      {i < all.length - 1 && <span className={cn("absolute top-3.5 left-1/2 h-0.5 w-full", done ? "bg-emerald-400" : "bg-ink-200")} aria-hidden />}
                      <span className={cn("relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-white", done ? "bg-emerald-600" : skipped ? "bg-ink-400" : i === 0 ? "bg-emerald-600" : "bg-sky-600", !done && !skipped && "ring-4 ring-white")}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : skipped ? <SkipForward className="h-3.5 w-3.5" /> : i === all.length - 1 ? <Flag className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                      </span>
                      <span className="mt-2 text-sm font-semibold text-ink-900">{i === 0 ? "Start" : i === all.length - 1 ? "End" : `Stop ${i + 1}`}</span>
                      <span className="text-xs text-ink-600">{stop.actual_arrival_at ? `${formatTime(stop.actual_arrival_at)} ✓` : stop.estimated_arrival_at ? formatTime(stop.estimated_arrival_at) : "—"}</span>
                      <span className="line-clamp-2 px-1 text-xs text-ink-500">{stop.location_name}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 text-xs text-ink-500">
                {progressTrip.data.trip_number} · {progressTrip.data.vehicle?.plate_number} · {progressTrip.data.driver?.full_name}.{" "}
                <Link href={`/transportation/itinerary/${progressTrip.data.id}`} className="font-medium text-brand-600 hover:underline">
                  Open itinerary
                </Link>
              </p>
            </div>
          ) : (
            <ErrorState message={progressTrip.error?.message} onRetry={() => progressTrip.refetch()} />
          )}
        </Card>

        {/* Camera */}
        <Card className="min-w-0">
          <CardHeader title="Live Video / Street View" icon={<Video />} />
          <div className="m-4 flex aspect-video flex-col items-center justify-center gap-2 rounded-lg bg-ink-900 px-6 text-center text-ink-300">
            <WifiOff className="h-8 w-8" />
            <p className="text-sm font-medium text-white">No camera feed connected</p>
            <p className="text-xs">Live video needs a dashcam or video telematics integration. Nothing is shown until one is connected.</p>
          </div>
        </Card>

        {/* Events */}
        <Card className="min-w-0">
          <CardHeader title="Recent Events" icon={<Truck />} description="Today's dispatches, departures and stop arrivals" />
          {events.isLoading ? (
            <LoadingState />
          ) : events.error ? (
            <ErrorState message={events.error.message} onRetry={() => events.refetch()} />
          ) : (events.data?.data.length ?? 0) === 0 ? (
            <p className="p-6 text-sm text-ink-500">No trip activity recorded today.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-ink-100 overflow-auto">
              {events.data!.data.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex items-start gap-3 px-5 py-2.5 text-sm">
                  <EventIcon type={e.type} />
                  <span className="w-16 shrink-0 text-ink-500">{formatTime(e.at)}</span>
                  <span className="text-ink-800">{e.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ icon, tone, label, value, sub }: { icon: ReactNode; tone: string; label: string; value: ReactNode | undefined; sub?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-card">
      <span className={cn("mt-0.5 [&>svg]:h-7 [&>svg]:w-7", tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-700">{label}</p>
        {value === undefined ? <span className="mt-1 block h-7 w-12 animate-pulse rounded bg-ink-100" /> : <p className="text-2xl font-bold text-ink-900">{value}</p>}
        {sub && <p className="truncate text-xs text-ink-500">{sub}</p>}
      </div>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const map: Record<string, [ReactNode, string]> = {
    dispatched: [<Send key="i" />, "bg-orange-500"],
    departed: [<Play key="i" />, "bg-sky-600"],
    arrived: [<MapPin key="i" />, "bg-emerald-600"],
    skipped: [<Pause key="i" />, "bg-ink-400"],
    completed: [<CheckCircle2 key="i" />, "bg-emerald-700"],
  };
  const [icon, color] = map[type] ?? [<Circle key="i" />, "bg-ink-400"];
  return <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white [&>svg]:h-3.5 [&>svg]:w-3.5", color)}>{icon}</span>;
}
