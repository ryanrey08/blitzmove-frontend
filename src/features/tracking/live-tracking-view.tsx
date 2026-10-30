"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChartNoAxesColumn,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Crosshair,
  Download,
  Filter,
  Info,
  MapPin,
  MoreVertical,
  Navigation,
  Route,
  Settings,
  SquareStop,
  Truck,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { exportCsv } from "@/lib/export";
import { cn, formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { api } from "@/services/api-client";
import { gpsService } from "@/services/resources";
import { GPS_PATH } from "../trips/gps-tracking-view";
import { LIVE_STATUS, STATUS_GROUPS, driverOf, isFresh, liveStatus, locationText, remaining, type LiveStatus, type StatusGroup } from "./status";
import { TrackingMap, type MapStyle, type MapView, type TrackedRow } from "./tracking-map";
import { VehicleDetailCard } from "./vehicle-detail-card";

const ALL_GROUPS = STATUS_GROUPS.map((g) => g.key);

export function LiveTrackingView() {
  const router = useRouter();
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [style, setStyle] = useState<MapStyle>("streets");
  const [traffic, setTraffic] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [view, setView] = useState<MapView | null>(null);
  const [mapSearch, setMapSearch] = useState("");
  const [type, setType] = useState("");
  const [groups, setGroups] = useState<StatusGroup[]>(ALL_GROUPS);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LiveStatus | "">("");
  // undefined = default selection, null = closed by the user.
  const [selectedId, setSelectedId] = useState<number | null | undefined>(undefined);
  const mapAnchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // "Live View" re-reads the database on an interval; positions only arrive from a telematics integration.
  const gps = useQuery({ queryKey: ["gps"], queryFn: gpsService.vehicles, refetchInterval: live ? 30_000 : false });
  const trend = useQuery({ queryKey: ["gps", "fleet-trend"], queryFn: gpsService.fleetTrend, refetchInterval: live ? 300_000 : false });
  const meta = gps.data?.meta;
  const rows: TrackedRow[] = (gps.data?.data ?? []).map((v) => ({ vehicle: v, status: liveStatus(v, now), place: meta?.places?.[v.id] }));

  const inGroup = (g: StatusGroup) => rows.filter((r) => LIVE_STATUS[r.status].group === g).length;
  const counts = Object.fromEntries(ALL_GROUPS.map((g) => [g, inGroup(g)])) as Record<StatusGroup, number>;
  const types = [...new Set(rows.map((r) => r.vehicle.vehicle_type).filter(Boolean))];

  const matches = (term: string, r: TrackedRow) => {
    const t = term.trim().toLowerCase();
    const d = driverOf(r.vehicle);
    return !t || [r.vehicle.plate_number, r.vehicle.make, r.vehicle.model, d?.full_name, r.vehicle.active_trip?.destination, r.vehicle.active_trip?.trip_number, r.place].some((x) => x?.toLowerCase().includes(t));
  };
  // Map panel filters (type, status groups, map search) apply to markers and the list; the list adds its own search/status.
  const filtered = rows.filter((r) => (!type || r.vehicle.vehicle_type === type) && groups.includes(LIVE_STATUS[r.status].group) && matches(mapSearch, r));
  const listed = filtered.filter((r) => (!status || r.status === status) && matches(search, r));

  const selected =
    selectedId === null
      ? undefined
      : (rows.find((r) => r.vehicle.id === selectedId) ?? rows.find((r) => r.vehicle.latest_location) ?? rows.find((r) => r.vehicle.active_trip) ?? rows[0]);

  const centerOn = (r: TrackedRow) => {
    setSelectedId(r.vehicle.id);
    const loc = r.vehicle.latest_location;
    if (loc) {
      setView({ lng: loc.longitude, lat: loc.latitude, zoom: 14 });
      mapAnchor.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const exportRows = () =>
    exportCsv(
      "vehicle-tracking",
      ["#", "Vehicle", "Model", "Driver", "Status", "Current Location", "Destination", "Speed (km/h)", "ETA", "Last Update"],
      listed.map((r, i) => {
        const v = r.vehicle;
        const loc = v.latest_location;
        return [
          i + 1,
          v.plate_number,
          `${v.make} ${v.model}`,
          driverOf(v)?.full_name ?? "",
          LIVE_STATUS[r.status].label,
          locationText(v, r.place) ?? "",
          v.active_trip?.destination ?? "",
          isFresh(v, now) && loc?.speed_kph != null ? loc.speed_kph : "",
          v.active_trip ? formatDateTime(v.active_trip.estimated_arrival_at) : "",
          loc ? formatDateTime(loc.recorded_at) : "",
        ];
      }),
    );

  const t = trend.data?.data;

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1.5 text-sm text-ink-500">
            <span>Tracking</span>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-ink-900">Live Tracking</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Tracking</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Real-time tracking of your fleet, vehicle locations, and trip status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLive((l) => !l)}
            aria-pressed={live}
            title={live ? "Auto-refreshing every 30 seconds. Click to pause." : "Paused. Click to resume auto-refresh."}
            className={cn("flex h-11 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold shadow-sm", live ? "border-ink-200 text-ink-900" : "border-ink-200 text-ink-500")}
          >
            <span className="relative flex h-2.5 w-2.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", live ? "bg-brand-600" : "bg-ink-300")} />
            </span>
            {live ? "Live View" : "Paused"}
          </button>
          <Link href="/tracking/geofences" className="flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 shadow-sm hover:bg-ink-50">
            <Crosshair className="h-4 w-4 text-ink-600" /> Geofences
          </Link>
          <MapSettings style={style} onStyle={setStyle} traffic={traffic} onTraffic={setTraffic} showLabels={showLabels} onShowLabels={setShowLabels} />
        </div>
      </div>

      {meta && !meta.has_gps_data && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No GPS positions received yet.</strong> Trip and maintenance status below come from trip and vehicle records. Locations, speeds and map markers fill in once a telematics device posts positions to{" "}
            <code className="rounded bg-white/60 px-1">POST /api/v1/gps/locations</code>.
          </span>
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat icon={<Truck className="h-8 w-8" />} tone="bg-sky-50 text-sky-600" label="Total Vehicles" value={gps.data ? rows.length : undefined}>
          <Delta now={t?.now.total} before={t?.last_month.total} />
        </Stat>
        <Stat icon={<MapPin className="h-8 w-8" fill="currentColor" stroke="white" strokeWidth={1.5} />} tone="bg-emerald-50 text-emerald-600" label="Vehicles On Route" value={gps.data ? counts.on_route : undefined} title="Vehicles on a dispatched or in-progress trip">
          <Delta now={t?.now.on_route} before={t?.last_month.on_route} />
        </Stat>
        <Stat icon={<SquareStop className="h-8 w-8" fill="currentColor" stroke="white" strokeWidth={1.75} />} tone="bg-red-50 text-brand-600" label="Idle Vehicles" value={gps.data ? counts.idle : undefined} title={`Reported a position in the last 15 minutes, no active trip`}>
          <Delta now={t?.now.idle} before={t?.last_month.idle} upIsBad />
        </Stat>
        <Stat icon={<Wrench className="h-8 w-8" fill="currentColor" />} tone="bg-red-50 text-brand-600" label="In Maintenance" value={gps.data ? counts.maintenance : undefined} title="Vehicle status is Maintenance and no active trip">
          <Delta now={t?.now.maintenance} before={t?.last_month.maintenance} upIsBad />
        </Stat>
        <Stat icon={<CircleAlert className="h-8 w-8" fill="currentColor" stroke="white" strokeWidth={1.75} />} tone="bg-red-50 text-brand-600" label="Offline Vehicles" value={gps.data ? counts.offline : undefined} title="No position in the last 15 minutes, or never reported">
          <Delta now={t?.now.offline} before={t?.last_month.offline} upIsBad />
        </Stat>
      </div>
      {gps.error && <ErrorState message={gps.error.message} onRetry={() => gps.refetch()} />}

      {/* Map + selected vehicle */}
      <div ref={mapAnchor} className="mb-5 grid scroll-mt-4 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <TrackingMap
          rows={filtered}
          counts={counts}
          types={types}
          type={type}
          onType={setType}
          groups={groups}
          onGroups={setGroups}
          search={mapSearch}
          onSearch={setMapSearch}
          style={style}
          onStyle={setStyle}
          traffic={traffic}
          onTraffic={setTraffic}
          showLabels={showLabels}
          view={view}
          onView={setView}
          selectedId={selected?.vehicle.id ?? null}
          onSelect={setSelectedId}
          providerConfigured={!!meta?.map_provider_configured}
          hasGpsData={!!meta?.has_gps_data}
          loading={gps.isLoading}
          refreshedAt={gps.dataUpdatedAt}
          now={now}
        />
        <VehicleDetailCard
          key={selected?.vehicle.id ?? "none"}
          vehicle={selected?.vehicle}
          status={selected?.status}
          place={selected?.place}
          now={now}
          onClose={() => setSelectedId(null)}
          onViewOnMap={() => selected && centerOn(selected)}
          mapAvailable={!!meta?.map_provider_configured}
        />
      </div>

      {/* Tracking list */}
      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-ink-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <h2 className="flex items-center gap-2.5 text-base font-bold text-ink-900">
            <Truck className="h-5 w-5" /> Vehicle Tracking List
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search vehicles..." className="w-full sm:w-auto sm:min-w-0 sm:flex-1 md:w-64 md:flex-none" />
            <Dropdown
              trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className={cn("flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium", status ? "border-brand-300 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-700 hover:bg-ink-50")}>
                  <Filter className="h-4 w-4" /> {status ? LIVE_STATUS[status].label : "Filter"} <ChevronDown className="h-4 w-4" />
                </button>
              )}
              items={[{ label: "All statuses", onSelect: () => setStatus("") }, ...(Object.keys(LIVE_STATUS) as LiveStatus[]).map((s) => ({ label: LIVE_STATUS[s].label, onSelect: () => setStatus(s) }))]}
            />
            <button type="button" onClick={exportRows} disabled={!listed.length} className="flex h-10 items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40">
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>
        {gps.isLoading ? (
          <LoadingState />
        ) : gps.error ? (
          <ErrorState message={gps.error.message} onRetry={() => gps.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[68rem] text-left text-sm lg:min-w-full">
              <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Current Location</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Speed</th>
                  <th className="px-4 py-3">ETA</th>
                  <th className="sticky right-0 bg-ink-50 px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {listed.map((r, i) => {
                  const v = r.vehicle;
                  const loc = v.latest_location;
                  const d = driverOf(v);
                  const s = LIVE_STATUS[r.status];
                  const left = v.active_trip ? remaining(v.active_trip.estimated_arrival_at, now) : null;
                  return (
                    <tr key={v.id} className={cn("cursor-pointer hover:bg-ink-50", selected?.vehicle.id === v.id && "bg-brand-50/60")} onClick={() => setSelectedId(v.id)}>
                      <td className="px-4 py-3 text-ink-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          {v.cover_photo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
                            <img src={api.url(v.cover_photo)} alt="" className="h-9 w-12 shrink-0 rounded object-cover" />
                          ) : (
                            <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-ink-100 text-ink-400">
                              <Truck className="h-4 w-4" />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block font-bold whitespace-nowrap text-ink-900">{v.plate_number}</span>
                            <span className="block max-w-40 truncate text-xs text-ink-500">
                              {v.make} {v.model}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {d ? (
                          <Link href={`/fleet/drivers/${d.id}`} className="flex items-center gap-2 text-ink-800 hover:text-brand-600">
                            <Avatar name={d.full_name} src={d.photo ? api.url(d.photo) : null} size="sm" />
                            {d.full_name}
                          </Link>
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={s.tone} dot className="px-2.5 py-1">
                          {s.label}
                        </Badge>
                      </td>
                      <td className="max-w-48 min-w-36 px-4 py-3 text-ink-700">{locationText(v, r.place) ? <span className="line-clamp-2">{locationText(v, r.place)}</span> : <Dash />}</td>
                      <td className="max-w-48 min-w-36 px-4 py-3 text-ink-700">{v.active_trip ? <span className="line-clamp-2">{v.active_trip.destination}</span> : <Dash />}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-800">{isFresh(v, now) && loc?.speed_kph != null ? `${formatNumber(loc.speed_kph)} km/h` : <Dash />}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-800">
                        {v.active_trip ? (
                          <>
                            {formatTime(v.active_trip.estimated_arrival_at)}
                            <span className={cn("block text-xs", left ? "text-ink-500" : "text-amber-700")}>{left ? `${left} left` : "Overdue"}</span>
                          </>
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className="sticky right-0 bg-white px-4 py-3 text-center whitespace-nowrap shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => centerOn(r)}
                          className="rounded-md p-1.5 hover:bg-ink-100"
                          aria-label={`Show ${v.plate_number} on the map`}
                          title={loc ? "Show on map" : "Select (no GPS position to center on)"}
                        >
                          <MapPin className="h-4 w-4 text-sky-600" />
                        </button>
                        <Link href={`${GPS_PATH}/${v.id}`} className="inline-flex rounded-md p-1.5 text-sky-600 hover:bg-ink-100" aria-label={`Tracking history for ${v.plate_number}`} title="Tracking history">
                          <ChartNoAxesColumn className="h-4 w-4" />
                        </Link>
                        <Dropdown
                          trigger={({ toggle }) => (
                            <button type="button" onClick={toggle} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100" aria-label={`Actions for ${v.plate_number}`}>
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          )}
                          items={[
                            { label: "Vehicle profile", icon: <Truck />, onSelect: () => router.push(`/fleet/vehicles/${v.id}`) },
                            ...(d ? [{ label: "Driver profile", icon: <User />, onSelect: () => router.push(`/fleet/drivers/${d.id}`) }] : []),
                            { label: "Tracking history", icon: <Navigation />, onSelect: () => router.push(`${GPS_PATH}/${v.id}`) },
                            ...(v.active_trip ? [{ label: "Trip itinerary", icon: <Route />, onSelect: () => router.push(`/transportation/itinerary/${v.active_trip!.id}`) }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {listed.length === 0 && <p className="p-6 text-center text-sm text-ink-500">{rows.length ? "No vehicles match these filters." : "No vehicles yet."}</p>}
          </div>
        )}
      </Card>
    </>
  );
}

const Dash = () => <span className="text-ink-400">—</span>;

function MapSettings(props: { style: MapStyle; onStyle: (s: MapStyle) => void; traffic: boolean; onTraffic: (t: boolean) => void; showLabels: boolean; onShowLabels: (s: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900 shadow-sm hover:bg-ink-50">
        <Settings className="h-4 w-4 text-ink-600" /> Map Settings
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-60 space-y-3 rounded-xl border border-ink-100 bg-white p-4 text-sm shadow-lg">
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold tracking-wide text-ink-500 uppercase">Map style</legend>
            {(["streets", "satellite"] as const).map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-2 py-0.5 text-ink-800">
                <input type="radio" name="map-style" className="accent-brand-600" checked={props.style === s} onChange={() => props.onStyle(s)} />
                {s === "streets" ? "Map (streets)" : "Satellite"}
              </label>
            ))}
          </fieldset>
          <label className="flex cursor-pointer items-center gap-2 text-ink-800">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={props.showLabels} onChange={(e) => props.onShowLabels(e.target.checked)} />
            Show vehicle labels
          </label>
          <label className={cn("flex items-center gap-2", props.style === "satellite" ? "text-ink-400" : "cursor-pointer text-ink-800")} title={props.style === "satellite" ? "Traffic is available on the Map style only" : undefined}>
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={props.traffic && props.style !== "satellite"} disabled={props.style === "satellite"} onChange={(e) => props.onTraffic(e.target.checked)} />
            Show traffic
          </label>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, tone, label, value, title, children }: { icon: ReactNode; tone: string; label: string; value: ReactNode | undefined; title?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-card" title={title}>
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl 2xl:h-16 2xl:w-16", tone)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-tight font-semibold text-ink-700">{label}</p>
        {value === undefined ? <span className="mt-1 block h-8 w-14 animate-pulse rounded bg-ink-100" /> : <p className="text-3xl leading-tight font-bold text-ink-900">{value}</p>}
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/**
 * "↑ 12%" over "vs. last month": status counts now against the same moment a month ago, both rebuilt from
 * records the same way. A rise is red when it is bad news (idle, maintenance, offline). "—" without prior data.
 */
function Delta({ now, before, upIsBad }: { now: number | null | undefined; before: number | null | undefined; upIsBad?: boolean }) {
  const up = now != null && before != null && now > before;
  const good = up !== !!upIsBad;
  return (
    <span className="block text-sm">
      {now == null || before == null ? (
        <span className="block font-semibold text-ink-400" title="No data for last month">
          —
        </span>
      ) : now === before ? (
        <span className="block font-semibold text-ink-500">0%</span>
      ) : (
        <span className={cn("flex items-center gap-1 text-base font-bold", good ? "text-emerald-600" : "text-brand-600")}>
          {up ? <ArrowUp className="h-4 w-4" strokeWidth={2.5} /> : <ArrowDown className="h-4 w-4" strokeWidth={2.5} />}
          {before ? `${Math.round((Math.abs(now - before) / before) * 100)}%` : "new"}
        </span>
      )}
      <span className="block text-xs text-ink-500">vs. last month</span>
    </span>
  );
}
