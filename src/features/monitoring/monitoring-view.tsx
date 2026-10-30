"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Flag,
  Fuel,
  Gauge,
  Info,
  Locate,
  Map as MapIcon,
  MapPin,
  Maximize2,
  MoreVertical,
  Navigation,
  Play,
  Route,
  Send,
  SkipForward,
  SlidersHorizontal,
  Truck,
  User,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { VEHICLE_TYPES, labelOf, type Tone } from "@/lib/constants";
import { cn, formatDateTime, formatNumber, formatRelative, formatTime } from "@/lib/utils";
import { api } from "@/services/api-client";
import { gpsService, monitoringService } from "@/services/resources";
import type { TripEvent, Vehicle } from "@/types/api";
import { GPS_PATH } from "../trips/gps-tracking-view";

/** A position older than this counts as offline. */
const STALE_MINUTES = 15;
/** At or below this speed a vehicle counts as stopped. */
const MOVING_KPH = 3;

type FleetStatus = "on_trip" | "delayed" | "idle" | "maintenance" | "offline" | "no_signal";

/**
 * Trip state comes from trip records, so a vehicle on a dispatched trip shows On Trip even before its
 * GPS reports. Idle/Offline need a reported position; a vehicle that has never reported shows No Signal.
 */
const STATUS: Record<FleetStatus, { label: string; tone: Tone; color: string }> = {
  on_trip: { label: "On Trip", tone: "green", color: "#16a34a" },
  delayed: { label: "Delayed", tone: "amber", color: "#f59e0b" },
  idle: { label: "Idle", tone: "gray", color: "#667085" },
  maintenance: { label: "Maintenance", tone: "violet", color: "#7c3aed" },
  offline: { label: "Offline", tone: "red", color: "#e30613" },
  no_signal: { label: "No Signal", tone: "gray", color: "#98a2b3" },
};

const TABS: { key: string; label: string; match: FleetStatus[] }[] = [
  { key: "", label: "All", match: [] },
  { key: "on_trip", label: "On Trip", match: ["on_trip", "delayed"] },
  { key: "idle", label: "Idle", match: ["idle"] },
  { key: "offline", label: "Offline", match: ["offline", "no_signal", "maintenance"] },
];

const isFresh = (v: Vehicle) => !!v.latest_location && Date.now() - new Date(v.latest_location.recorded_at).getTime() <= STALE_MINUTES * 60_000;

function fleetStatus(v: Vehicle): FleetStatus {
  if (v.active_trip) return new Date(v.active_trip.estimated_arrival_at).getTime() < Date.now() ? "delayed" : "on_trip";
  // Off the road for workshop work, per the vehicle record.
  if (v.status === "maintenance") return "maintenance";
  if (!v.latest_location) return "no_signal";
  return isFresh(v) ? "idle" : "offline";
}

export function MonitoringView() {
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [style, setStyle] = useState<"streets" | "satellite">("streets");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [popup, setPopup] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // "Live View" re-reads the database on an interval; positions only arrive from a telematics integration.
  const poll = live ? 30_000 : false;
  const summary = useQuery({ queryKey: ["monitoring"], queryFn: monitoringService.get, refetchInterval: live ? 60_000 : false });
  const gps = useQuery({ queryKey: ["gps"], queryFn: gpsService.vehicles, refetchInterval: poll });
  const meta = gps.data?.meta;
  const rows = (gps.data?.data ?? []).map((v, i) => ({ vehicle: v, index: i + 1, status: fleetStatus(v), place: meta?.places?.[v.id] }));
  const count = (key: string) => (key ? rows.filter((r) => TABS.find((t) => t.key === key)!.match.includes(r.status)).length : rows.length);

  const term = search.trim().toLowerCase();
  const listed = rows.filter(
    (r) =>
      (!tab || TABS.find((t) => t.key === tab)!.match.includes(r.status)) &&
      (!type || r.vehicle.vehicle_type === type) &&
      (!term || [r.vehicle.plate_number, r.vehicle.make, r.vehicle.model, r.vehicle.active_trip?.driver?.full_name, r.vehicle.assigned_driver?.full_name, r.place].some((x) => x?.toLowerCase().includes(term))),
  );
  const types = [...new Set(rows.map((r) => r.vehicle.vehicle_type).filter(Boolean))];

  // Default selection: the first vehicle on a trip, else the first vehicle.
  const selected = rows.find((r) => r.vehicle.id === selectedId) ?? rows.find((r) => r.vehicle.active_trip) ?? rows[0];
  const sv = selected?.vehicle;
  const select = (id: number) => {
    setSelectedId(id);
    setShowRoute(false);
    setPopup(true);
  };

  const plotted = rows.filter((r) => r.vehicle.latest_location && (!focused || r.vehicle.id === sv?.id));
  const markers = plotted.map((r) => ({ vehicle_id: r.vehicle.id, label: String(r.index), color: STATUS[r.status].color }));
  const map = useQuery({
    queryKey: ["gps", "map", markers, style, gps.dataUpdatedAt],
    queryFn: () => gpsService.map({ markers, style, traffic: false }).then((r) => r.data),
    enabled: !!meta?.map_provider_configured && !showRoute,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const track = useQuery({
    queryKey: ["gps", "track", sv?.id],
    queryFn: () => gpsService.track(sv!.id).then((r) => r.data),
    enabled: showRoute && !!sv,
    refetchInterval: poll,
  });
  const events = useQuery({
    queryKey: ["gps", "events", sv?.id],
    queryFn: () => gpsService.events(20, sv!.id).then((r) => r.data),
    enabled: !!sv,
    refetchInterval: live ? 60_000 : false,
  });

  const m = summary.data?.data;
  const today = m?.today;
  const week = m?.last_week;
  const onRoad = count("on_trip");
  const image = showRoute ? track.data?.image : map.data?.image;
  const mapBusy = showRoute ? track.isFetching : map.isFetching;

  return (
    <div ref={pageRef} className="[&:fullscreen]:overflow-auto [&:fullscreen]:bg-ink-50 [&:fullscreen]:p-6">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Monitoring</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Real-time monitoring of your fleet, vehicle locations, and trip status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLive((l) => !l)}
            aria-pressed={live}
            title={live ? "Auto-refreshing every 30 seconds. Click to pause." : "Paused. Click to resume auto-refresh."}
            className={cn("flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold shadow-sm", live ? "border-brand-200 bg-white text-ink-900" : "border-ink-200 bg-white text-ink-500")}
          >
            <span className="relative flex h-2.5 w-2.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", live ? "bg-brand-600" : "bg-ink-300")} />
            </span>
            {live ? "Live View" : "Paused"}
          </button>
          <span className="flex h-11 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-medium text-ink-800 shadow-sm">
            <CalendarDays className="h-4 w-4 text-ink-500" /> {format(now, "MMM d, yyyy h:mm a")}
          </span>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : pageRef.current?.requestFullscreen?.())}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-200 bg-white text-ink-700 shadow-sm hover:bg-ink-50"
            aria-label="Full screen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {meta && !meta.has_gps_data && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No GPS positions received yet.</strong> Trip figures below come from trip and fuel records. Locations, speeds and the map fill in once a telematics device posts positions to{" "}
            <code className="rounded bg-white/60 px-1">POST /api/v1/gps/locations</code>.
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Stat icon={Truck} tone="bg-sky-50 text-sky-600" label="Total Vehicles" value={gps.data ? rows.length : undefined}>
          {gps.data && (
            <span className="flex flex-col gap-0.5">
              <Dot color="bg-emerald-500">{onRoad} On the Road</Dot>
              <Dot color="bg-ink-400">{count("idle")} Idle</Dot>
              <Dot color="bg-brand-600">{count("offline")} Offline</Dot>
            </span>
          )}
        </Stat>
        <Stat icon={MapPin} tone="bg-emerald-50 text-emerald-600" label="Active Trips" value={m?.active_trips.total}>
          {m && (
            <span className="flex flex-col gap-0.5">
              <Dot color="bg-emerald-500">{m.active_trips.on_time} On Time</Dot>
              <Dot color="bg-amber-500">{m.active_trips.delayed} Delayed</Dot>
              <Dot color="bg-brand-600">{m.active_trips.cancelled_today} Cancelled</Dot>
            </span>
          )}
        </Stat>
        <Stat icon={Route} tone="bg-sky-50 text-sky-600" label="Total Distance Today" value={today && `${formatNumber(today.distance_km)} km`} title="Planned distance of trips completed today">
          {today && week && <Delta now={today.distance_km} before={week.distance_km} />}
        </Stat>
        <Stat icon={Fuel} tone="bg-sky-50 text-sky-600" label="Total Fuel Today" value={today && `${formatNumber(today.fuel_liters)} L`} title="Liters entered in today's fuel records">
          {today && week && <Delta now={today.fuel_liters} before={week.fuel_liters} upIsBad />}
        </Stat>
        <Stat icon={Gauge} tone="bg-orange-50 text-orange-500" label="Average Speed" value={today && (today.average_speed_kph != null ? `${formatNumber(today.average_speed_kph)} km/h` : "—")} title="Average of today's moving GPS samples">
          {today && week && (today.average_speed_kph != null ? <Delta now={today.average_speed_kph} before={week.average_speed_kph} /> : <span className="text-xs text-ink-500">No GPS speed data today</span>)}
        </Stat>
      </div>
      {summary.error && <ErrorState message={summary.error.message} onRetry={() => summary.refetch()} />}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Left: map + trip summary */}
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            <div className="relative h-[30rem] bg-ink-50 sm:h-[34rem]">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI rendered by the API
                <img src={image} alt={showRoute ? `${sv?.plate_number} route` : "Fleet map"} className={cn("absolute inset-0 h-full w-full object-cover", mapBusy && "opacity-70")} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  {mapBusy || gps.isLoading ? <LoadingState label="Loading map…" /> : <MapIcon className="h-9 w-9 text-ink-300" />}
                  {!mapBusy && !gps.isLoading && (
                    <p className="max-w-72 text-sm text-ink-500">
                      {!meta?.map_provider_configured
                        ? "Map provider not configured."
                        : showRoute
                          ? (track.error?.message ?? `${sv?.plate_number} has no reported positions to draw.`)
                          : meta && !meta.has_gps_data
                            ? "No GPS positions received yet."
                            : (map.error?.message ?? "The map could not be drawn.")}
                    </p>
                  )}
                </div>
              )}

              {/* Map / Satellite */}
              <div className="absolute top-3 left-3 flex overflow-hidden rounded-lg bg-white shadow-md">
                {(["streets", "satellite"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setStyle(s)} disabled={showRoute} className={cn("px-4 py-2 text-sm font-medium disabled:opacity-50", style === s ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-50")}>
                    {s === "streets" ? "Map" : "Satellite"}
                  </button>
                ))}
              </div>

              {/* Locate / show all */}
              <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-lg bg-white shadow-md sm:top-auto sm:bottom-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRoute(false);
                    setFocused(true);
                  }}
                  disabled={!sv?.latest_location}
                  className="p-2.5 text-ink-700 hover:bg-ink-50 disabled:opacity-30"
                  aria-label="Center on the selected vehicle"
                  title="Center on the selected vehicle"
                >
                  <Locate className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRoute(false);
                    setFocused(false);
                  }}
                  className="border-t border-ink-100 p-2.5 text-ink-700 hover:bg-ink-50"
                  aria-label="Show the whole fleet"
                  title="Show the whole fleet"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>

              {/* Selected vehicle */}
              {sv && popup && (
                <div className="absolute right-3 bottom-3 left-3 rounded-xl bg-white p-3 shadow-lg sm:top-16 sm:right-auto sm:bottom-auto sm:w-80">
                  <div className="flex gap-3">
                    {sv.cover_photo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
                      <img src={api.url(sv.cover_photo)} alt={sv.plate_number} className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-400">
                        <Truck className="h-6 w-6" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="font-semibold text-ink-900">{sv.plate_number}</p>
                        <Badge tone={STATUS[selected.status].tone} dot>
                          {STATUS[selected.status].label}
                        </Badge>
                        <button type="button" onClick={() => setPopup(false)} className="-mt-1 -mr-1 ml-auto rounded p-1 text-ink-500 hover:bg-ink-100" aria-label="Close vehicle card">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="truncate text-xs text-ink-500">
                        {sv.make} {sv.model} ({labelOf(VEHICLE_TYPES, sv.vehicle_type)})
                      </p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-500">Driver</dt>
                    <dd className="truncate font-medium text-ink-800">
                      <DriverLink vehicle={sv} />
                    </dd>
                    <dt className="text-ink-500">Trip</dt>
                    <dd className="truncate font-medium text-ink-800">
                      {sv.active_trip ? (
                        <Link href={`/transportation/itinerary/${sv.active_trip.id}`} className="hover:text-brand-600">
                          {sv.active_trip.trip_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </dd>
                    <dt className="text-ink-500">Speed</dt>
                    <dd className="font-medium text-ink-800">{isFresh(sv) && sv.latest_location?.speed_kph != null ? `${formatNumber(sv.latest_location.speed_kph)} km/h` : "—"}</dd>
                    <dt className="text-ink-500">Last Update</dt>
                    <dd className="font-medium text-ink-800">{sv.latest_location ? formatDateTime(sv.latest_location.recorded_at) : "No GPS position yet"}</dd>
                    <dt className="text-ink-500">Location</dt>
                    <dd className="truncate font-medium text-ink-800">{location(sv, selected.place)}</dd>
                  </dl>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href={`/fleet/vehicles/${sv.id}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-50">
                      <Eye className="h-3.5 w-3.5 text-sky-600" /> View Details
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowRoute((s) => !s)}
                      disabled={!sv.latest_location || !meta?.map_provider_configured}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-ink-50 disabled:opacity-40"
                      title={sv.latest_location ? undefined : "No reported positions to draw"}
                    >
                      {showRoute ? <X className="h-3.5 w-3.5" /> : <Navigation className="h-3.5 w-3.5 text-sky-600" />} {showRoute ? "Close Route" : "Track Route"}
                    </button>
                  </div>
                </div>
              )}

              {!showRoute && map.data && (
                <span className="absolute bottom-3 left-3 hidden rounded-md bg-white/90 px-2 py-1 text-[11px] text-ink-600 shadow sm:block">
                  {map.data.plotted} vehicle{map.data.plotted === 1 ? "" : "s"} plotted · pins numbered as in Fleet Status
                </span>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Trip Summary (Today)" icon={<Route />} />
            <div className="grid grid-cols-1 divide-ink-100 sm:grid-cols-2 sm:divide-x 2xl:grid-cols-4 [&>*]:border-ink-100 max-sm:[&>*+*]:border-t">
              <SummaryTile icon={CheckCircle2} tone="text-emerald-600 bg-emerald-50" label="Completed Trips" value={today?.completed}>
                {today && week && <Delta now={today.completed} before={week.completed} />}
              </SummaryTile>
              <SummaryTile icon={Clock} tone="text-amber-600 bg-amber-50" label="Delayed Trips" value={today?.delayed}>
                {today && week && <Delta now={today.delayed} before={week.delayed} upIsBad />}
              </SummaryTile>
              <SummaryTile icon={XCircle} tone="text-white bg-brand-600" label="Cancelled Trips" value={today?.cancelled}>
                {today && week && <Delta now={today.cancelled} before={week.cancelled} upIsBad />}
              </SummaryTile>
              <SummaryTile icon={Route} tone="text-sky-600 bg-sky-50" label="Total Distance" value={today && `${formatNumber(today.distance_km)} km`}>
                {today && week && <Delta now={today.distance_km} before={week.distance_km} />}
              </SummaryTile>
            </div>
          </Card>
        </div>

        {/* Right: fleet status + events */}
        <div className="min-w-0 space-y-5">
          <Card className="min-w-0">
            <CardHeader title="Fleet Status" icon={<Truck />} />
            <div className="grid grid-cols-2 gap-1 px-3 pt-3 sm:grid-cols-4">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn("rounded-lg border px-3 py-2 text-sm font-medium", tab === t.key ? "border-brand-600 bg-brand-600 text-white" : "border-ink-200 text-ink-700 hover:bg-ink-50")}
                >
                  {t.label} ({count(t.key)})
                </button>
              ))}
            </div>
            <div className="flex gap-2 p-3">
              <SearchInput value={search} onChange={setSearch} placeholder="Search vehicle, driver or plate number..." className="min-w-0 flex-1" />
              <Dropdown
                trigger={({ toggle }) => (
                  <button type="button" onClick={toggle} className={cn("flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium", type ? "border-brand-300 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:bg-ink-50")}>
                    <SlidersHorizontal className="h-4 w-4" /> {type ? labelOf(VEHICLE_TYPES, type) : "Filter"}
                  </button>
                )}
                items={[{ label: "All vehicle types", onSelect: () => setType("") }, ...types.map((t) => ({ label: labelOf(VEHICLE_TYPES, t), onSelect: () => setType(t) }))]}
              />
            </div>
            {gps.isLoading ? (
              <LoadingState />
            ) : gps.error ? (
              <ErrorState message={gps.error.message} onRetry={() => gps.refetch()} />
            ) : (
              <div className="max-h-[25rem] overflow-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-ink-50 text-xs font-semibold text-ink-600">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Vehicle</th>
                      <th className="px-3 py-2.5">Driver</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Location</th>
                      <th className="px-3 py-2.5">Speed</th>
                      <th className="sticky right-0 bg-ink-50 px-3 py-2.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {listed.map(({ vehicle: v, index, status: s, place }) => (
                      <tr key={v.id} className={cn("cursor-pointer hover:bg-ink-50", sv?.id === v.id && "bg-brand-50/60")} onClick={() => select(v.id)}>
                        <td className="px-3 py-2.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: STATUS[s].color }}>
                            {index}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="flex items-center gap-2">
                            {v.cover_photo ? (
                              // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
                              <img src={api.url(v.cover_photo)} alt="" className="hidden h-8 w-11 shrink-0 rounded object-cover 2xl:block" />
                            ) : (
                              <span className="hidden h-8 w-11 shrink-0 items-center justify-center rounded bg-ink-100 text-ink-400 2xl:flex">
                                <Truck className="h-4 w-4" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block font-semibold whitespace-nowrap text-ink-900">{v.plate_number}</span>
                              <span className="block max-w-28 truncate text-xs text-ink-500">
                                {v.make} {v.model}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-ink-700" onClick={(e) => e.stopPropagation()}>
                          <DriverLink vehicle={v} />
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={STATUS[s].tone} dot className="whitespace-nowrap">
                            {STATUS[s].label}
                          </Badge>
                        </td>
                        <td className="max-w-32 min-w-24 px-3 py-2.5 text-xs text-ink-700">
                          <span className="line-clamp-2">{location(v, place)}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{isFresh(v) && v.latest_location?.speed_kph != null ? `${formatNumber(v.latest_location.speed_kph)} km/h` : <span className="text-ink-400">—</span>}</td>
                        <td className="sticky right-0 bg-white px-3 py-2.5 text-center whitespace-nowrap shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              select(v.id);
                              setFocused(true);
                            }}
                            disabled={!v.latest_location}
                            className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 disabled:opacity-30"
                            aria-label={`Show ${v.plate_number} on the map`}
                            title={v.latest_location ? "Show on map" : "No position reported"}
                          >
                            <MapPin className="h-4 w-4 text-sky-600" />
                          </button>
                          <Dropdown
                            trigger={({ toggle }) => (
                              <button type="button" onClick={toggle} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100" aria-label={`Actions for ${v.plate_number}`}>
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                            items={[
                              { label: "Vehicle profile", icon: <Truck />, onSelect: () => router.push(`/fleet/vehicles/${v.id}`) },
                              ...(driverOf(v) ? [{ label: "Driver profile", icon: <User />, onSelect: () => router.push(`/fleet/drivers/${driverOf(v)!.id}`) }] : []),
                              { label: "Tracking history", icon: <Navigation />, onSelect: () => router.push(`${GPS_PATH}/${v.id}`) },
                              ...(v.active_trip ? [{ label: "Trip itinerary", icon: <Route />, onSelect: () => router.push(`/transportation/itinerary/${v.active_trip!.id}`) }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {listed.length === 0 && <p className="p-6 text-center text-sm text-ink-500">{rows.length ? "No vehicles match these filters." : "No vehicles yet."}</p>}
              </div>
            )}
          </Card>

          <Card className="min-w-0">
            <CardHeader
              title={`Trip Events${sv ? ` (${sv.plate_number})` : ""}`}
              icon={<Clock />}
              action={
                sv && (
                  <Link href={`${GPS_PATH}/${sv.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    View All
                  </Link>
                )
              }
            />
            {!sv ? (
              <p className="p-6 text-sm text-ink-500">No vehicles yet.</p>
            ) : events.isLoading ? (
              <LoadingState />
            ) : events.error ? (
              <ErrorState message={events.error.message} onRetry={() => events.refetch()} />
            ) : (
              <Timeline vehicle={sv} place={selected.place} events={events.data ?? []} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function location(v: Vehicle, place?: string) {
  const loc = v.latest_location;
  if (!loc) return v.active_trip ? `En route to ${v.active_trip.destination} (no GPS)` : "No GPS position";
  return place ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
}

const driverOf = (v: Vehicle) => v.active_trip?.driver ?? v.assigned_driver ?? null;

function DriverLink({ vehicle }: { vehicle: Vehicle }) {
  const d = driverOf(vehicle);
  if (!d) return <span className="text-ink-400">—</span>;
  return (
    <Link href={`/fleet/drivers/${d.id}`} className="hover:text-brand-600">
      {d.full_name}
    </Link>
  );
}

const EVENT: Record<TripEvent["type"], { title: string; icon: LucideIcon; tone: string; dot: string }> = {
  dispatched: { title: "Dispatched", icon: Send, tone: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
  departed: { title: "Trip Started", icon: Play, tone: "bg-sky-50 text-sky-600", dot: "bg-sky-600" },
  arrived: { title: "Check-in", icon: Flag, tone: "bg-sky-50 text-sky-600", dot: "bg-sky-600" },
  skipped: { title: "Stop Skipped", icon: SkipForward, tone: "bg-ink-100 text-ink-500", dot: "bg-ink-400" },
  completed: { title: "Trip Completed", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
};

/** Today's events for one vehicle, with its latest GPS report (if it reported today) on top. */
function Timeline({ vehicle, place, events }: { vehicle: Vehicle; place?: string; events: TripEvent[] }) {
  const loc = vehicle.latest_location;
  const items: { key: string; at: string; title: string; icon: LucideIcon; tone: string; dot: string; location: string; detail: ReactNode }[] = [];
  if (loc && new Date(loc.recorded_at).toDateString() === new Date().toDateString()) {
    const moving = (loc.speed_kph ?? 0) > MOVING_KPH;
    items.push({
      key: "gps",
      at: loc.recorded_at,
      title: isFresh(vehicle) ? (moving ? "Moving" : "Stopped") : "Last GPS report",
      icon: moving ? Navigation : Circle,
      tone: moving ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-500",
      dot: moving ? "bg-emerald-500" : "bg-ink-400",
      location: place ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`,
      detail: loc.speed_kph != null ? `${formatNumber(loc.speed_kph)} km/h` : formatRelative(loc.recorded_at),
    });
  }
  events.forEach((e, i) =>
    items.push({
      key: `${e.at}-${i}`,
      at: e.at,
      ...EVENT[e.type],
      location: e.location,
      detail: (
        <Link href={`/transportation/itinerary/${e.trip_id}`} className="hover:text-brand-600">
          {e.trip_number}
        </Link>
      ),
    }),
  );

  if (items.length === 0) return <p className="p-6 text-sm text-ink-500">No trip activity or GPS reports for {vehicle.plate_number} today.</p>;

  return (
    <ol className="max-h-80 overflow-auto px-5 py-4">
      {items.map((it, i) => (
        <li key={it.key} className="relative flex items-start gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-sky-200" aria-hidden />}
          <span className={cn("relative z-10 mt-2.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white", it.dot)} />
          <span className="w-16 shrink-0 pt-2 text-xs whitespace-nowrap text-ink-600">{formatTime(it.at)}</span>
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full [&>svg]:h-4 [&>svg]:w-4", it.tone)}>
            <it.icon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink-900">{it.title}</span>
            <span className="block truncate text-xs text-ink-500">{it.location}</span>
          </span>
          <span className="shrink-0 pt-1 text-xs font-medium text-ink-600">{it.detail}</span>
        </li>
      ))}
    </ol>
  );
}

function Stat({ icon: Icon, tone, label, value, title, children }: { icon: LucideIcon; tone: string; label: string; value: ReactNode | undefined; title?: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-ink-100 bg-white p-4 shadow-card" title={title}>
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-7 w-7" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink-600">{label}</p>
        {value === undefined ? <span className="mt-1 block h-7 w-14 animate-pulse rounded bg-ink-100" /> : <p className="text-2xl leading-tight font-bold text-ink-900">{value}</p>}
        <div className="mt-1 text-sm text-ink-600">{children}</div>
      </div>
    </div>
  );
}

function SummaryTile({ icon: Icon, tone, label, value, children }: { icon: LucideIcon; tone: string; label: string; value: ReactNode | undefined; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4">
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-600">{label}</p>
        {value === undefined ? <span className="mt-1 block h-6 w-10 animate-pulse rounded bg-ink-100" /> : <p className="text-xl leading-tight font-bold text-ink-900">{value}</p>}
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("h-2 w-2 rounded-full", color)} /> {children}
    </span>
  );
}

/** "↑ 12%" over "vs. last week" (same weekday). When a rise is bad news (delays, fuel) it shows in red. */
function Delta({ now, before, upIsBad }: { now: number; before: number | null; upIsBad?: boolean }) {
  if (before == null) return <span className="text-xs text-ink-500">No data last week</span>;
  const up = now > before;
  const good = up !== !!upIsBad;
  return (
    <span className="block text-sm">
      {now === before ? (
        <span className="block font-semibold text-ink-500">0%</span>
      ) : (
        <span className={cn("flex items-center gap-1 font-semibold", good ? "text-emerald-600" : "text-brand-600")}>
          {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          {before ? `${Math.round((Math.abs(now - before) / before) * 100)}%` : "new"}
        </span>
      )}
      <span className="block text-xs text-ink-500">vs. last week</span>
    </span>
  );
}
