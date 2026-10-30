"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, Info, Locate, Map as MapIcon, Maximize2, Minimize2, Minus, Plus, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { LoadingState } from "@/components/ui/states";
import { useDebounce } from "@/hooks/use-debounce";
import { VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { cn, formatNumber, formatTime } from "@/lib/utils";
import { gpsService, type MapViewport } from "@/services/resources";
import type { Vehicle } from "@/types/api";
import { LIVE_STATUS, STATUS_GROUPS, isFresh, type LiveStatus, type StatusGroup } from "./status";

export type MapStyle = "streets" | "satellite";
export interface MapView {
  lng: number;
  lat: number;
  zoom: number;
}
export interface TrackedRow {
  vehicle: Vehicle;
  status: LiveStatus;
  place?: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 17;

/** Web Mercator world pixels (512 px tiles, as the Mapbox Static Images API uses). */
function project(lng: number, lat: number, zoom: number) {
  const size = 512 * 2 ** zoom;
  const rad = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * size, y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size };
}

interface TrackingMapProps {
  rows: TrackedRow[];
  counts: Record<StatusGroup, number>;
  types: string[];
  type: string;
  onType: (type: string) => void;
  groups: StatusGroup[];
  onGroups: (groups: StatusGroup[]) => void;
  search: string;
  onSearch: (search: string) => void;
  style: MapStyle;
  onStyle: (style: MapStyle) => void;
  traffic: boolean;
  onTraffic: (traffic: boolean) => void;
  showLabels: boolean;
  view: MapView | null;
  onView: (view: MapView | null) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  providerConfigured: boolean;
  hasGpsData: boolean;
  loading: boolean;
  refreshedAt: number;
  now: number;
}

export function TrackingMap(props: TrackingMapProps) {
  const { rows, style, traffic, view, onView, selectedId, providerConfigured, now } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean | null>(null);

  // Request an image matching the card (in 20 px steps, within the API's limits) so pins line up with it.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === cardRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const step = (n: number, min: number) => Math.max(min, Math.min(1280, Math.round(n / 20) * 20));
  // Wait for the layout to settle (data loading resizes the card) before asking for a new picture.
  const sizeKey = useDebounce(box ? `${step(box.width, 320)}x${step(box.height, 240)}` : "", 300);
  const size = sizeKey ? { width: Number(sizeKey.split("x")[0]), height: Number(sizeKey.split("x")[1]) } : null;

  // Keep fitted pins (and their label cards) clear of the controls drawn over the map: top, right, bottom, left.
  const padding: [number, number, number, number] = box && box.width >= 640 ? [140, 70, 40, 270] : [200, 70, 50, 40];

  const plotted = rows.filter((r) => r.vehicle.latest_location);
  const ids = plotted.map((r) => r.vehicle.id);
  const map = useQuery({
    // Only a fitted view depends on which vehicles are shown.
    queryKey: ["gps", "viewport", view ?? ids, size, style, traffic, view ? null : props.refreshedAt],
    queryFn: () => gpsService.viewport({ vehicle_ids: ids, ...(view ?? {}), width: size!.width, height: size!.height, padding, style, traffic }).then((r) => r.data),
    enabled: providerConfigured && !!size,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const vp: MapViewport | undefined = map.data?.viewport;

  const zoomBy = (delta: number) => vp && onView({ lng: vp.lng, lat: vp.lat, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(vp.zoom) + delta)) });
  const selected = plotted.find((r) => r.vehicle.id === selectedId);

  // Pixel position of each vehicle over the picture (object-cover scaling of the logical image).
  const pins =
    vp && box && map.data?.image
      ? plotted.flatMap((r) => {
          const { width: W, height: H } = box;
          const scale = Math.max(W / vp.width, H / vp.height);
          const c = project(vp.lng, vp.lat, vp.zoom);
          const p = project(r.vehicle.latest_location!.longitude, r.vehicle.latest_location!.latitude, vp.zoom);
          const x = W / 2 + (p.x - c.x) * scale;
          const y = H / 2 + (p.y - c.y) * scale;
          return x < -20 || y < -20 || x > W + 20 || y > H + 20 ? [] : [{ row: r, x, y }];
        })
      : [];

  const toggleGroup = (g: StatusGroup) => props.onGroups(props.groups.includes(g) ? props.groups.filter((x) => x !== g) : [...props.groups, g]);
  const trafficBlocked = style === "satellite";

  return (
    <div ref={cardRef} className={cn("relative isolate h-[34rem] overflow-hidden rounded-xl border border-ink-100 bg-ink-100 shadow-card sm:h-[26rem] xl:h-auto xl:min-h-[390px]", fullscreen && "h-full rounded-none sm:h-full xl:h-full")}>
      {map.data?.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI rendered by the API
        <img src={map.data.image} alt="Fleet map" className={cn("absolute inset-0 h-full w-full object-cover", map.isFetching && "opacity-80")} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 pt-24 text-center">
          {map.isFetching || props.loading ? <LoadingState label="Loading map…" /> : <MapIcon className="h-9 w-9 text-ink-300" />}
          {!map.isFetching && !props.loading && <p className="max-w-72 text-sm text-ink-500">{!providerConfigured ? "Map provider not configured." : (map.error?.message ?? "The map could not be drawn.")}</p>}
        </div>
      )}

      {/* Vehicle markers */}
      {pins.map(({ row: r, x, y }) => {
        const s = LIVE_STATUS[r.status];
        const loc = r.vehicle.latest_location!;
        const fresh = isFresh(r.vehicle, now);
        const active = r.vehicle.id === selectedId;
        return (
          <button
            key={r.vehicle.id}
            type="button"
            onClick={() => props.onSelect(r.vehicle.id)}
            className={cn("absolute -translate-x-1/2 -translate-y-full focus-visible:outline-none", active ? "z-20" : "z-10")}
            style={{ left: x, top: y }}
            aria-label={`${r.vehicle.plate_number}, ${s.label}`}
          >
            {props.showLabels && (
              <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded-lg bg-white px-2 py-1 text-left text-[11px] leading-tight whitespace-nowrap shadow-md">
                <span className="block font-bold text-ink-900">{r.vehicle.plate_number}</span>
                <span className="block font-medium" style={{ color: s.color }}>
                  {s.label}
                </span>
                <span className="block text-ink-600">{fresh ? (loc.speed_kph != null ? `${formatNumber(loc.speed_kph)} km/h` : "—") : `Last: ${formatTime(loc.recorded_at)}`}</span>
              </span>
            )}
            <span className="flex flex-col items-center">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-white shadow-md", active && "ring-4 ring-brand-500/40")} style={{ backgroundColor: s.color }}>
                <Truck className="h-4 w-4" />
              </span>
              <span className="-mt-0.5 h-2 w-2 rotate-45 border-r-2 border-b-2 border-white" style={{ backgroundColor: s.color }} />
            </span>
          </button>
        );
      })}

      {/* Top bar */}
      <div className="absolute inset-x-3 top-3 z-30 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg bg-white shadow-md">
          {(["streets", "satellite"] as const).map((s) => (
            <button key={s} type="button" onClick={() => props.onStyle(s)} aria-pressed={style === s} className={cn("px-4 py-2 text-sm font-medium", style === s ? "bg-brand-600 text-white" : "text-ink-700 hover:bg-ink-50")}>
              {s === "streets" ? "Map" : "Satellite"}
            </button>
          ))}
        </div>
        <SearchInput value={props.search} onChange={props.onSearch} placeholder="Search vehicle, driver, or location..." className="order-last w-full rounded-lg bg-white shadow-md md:order-none md:mx-auto md:w-80" />
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <label
            className={cn("flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm font-medium shadow-md", trafficBlocked ? "cursor-not-allowed text-ink-400" : "cursor-pointer text-ink-700")}
            title={trafficBlocked ? "Traffic is available on the Map style only" : "Live traffic from Mapbox"}
          >
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={traffic && !trafficBlocked} disabled={trafficBlocked} onChange={(e) => props.onTraffic(e.target.checked)} />
            Show Traffic
          </label>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? document.exitFullscreen() : cardRef.current?.requestFullscreen?.())}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-ink-700 shadow-md hover:bg-ink-50"
            aria-label={fullscreen ? "Exit full screen" : "Full screen map"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="absolute top-[6.5rem] left-3 z-30 w-56 rounded-xl bg-white shadow-lg md:top-16">
        <button type="button" onClick={() => setFiltersOpen((o) => !(o ?? window.matchMedia("(min-width: 640px)").matches))} className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-ink-900" aria-expanded={filtersOpen ?? undefined}>
          Filter Vehicles
          <ChevronDown className={cn("h-4 w-4 text-ink-500 transition-transform", filtersOpen === false && "-rotate-90", filtersOpen === null && "max-sm:-rotate-90")} />
        </button>
        <div className={cn("space-y-2 px-3 pb-3", filtersOpen === false && "hidden", filtersOpen === null && "hidden sm:block")}>
          <select value={props.type} onChange={(e) => props.onType(e.target.value)} className="input h-9 py-1 text-sm" aria-label="Vehicle type">
            <option value="">All Vehicles</option>
            {props.types.map((t) => (
              <option key={t} value={t}>
                {labelOf(VEHICLE_TYPES, t)}
              </option>
            ))}
          </select>
          {STATUS_GROUPS.map((g) => (
            <label key={g.key} className="flex cursor-pointer items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={props.groups.includes(g.key)} onChange={() => toggleGroup(g.key)} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />
              <span className="flex-1">{g.label}</span>
              <span className="text-xs font-semibold text-ink-500">{props.counts[g.key]}</span>
            </label>
          ))}
        </div>
      </div>

      {!props.hasGpsData && !props.loading && (
        <span className="absolute bottom-3 left-3 z-20 flex max-w-[calc(100%-5rem)] items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-xs text-ink-700 shadow">
          <Info className="h-3.5 w-3.5 shrink-0 text-amber-600" /> No GPS positions received yet, so no vehicles are plotted.
        </span>
      )}

      {/* Zoom / locate */}
      <div className="absolute right-3 bottom-3 z-30 flex flex-col overflow-hidden rounded-lg bg-white shadow-md">
        <button type="button" onClick={() => zoomBy(1)} disabled={!vp || vp.zoom >= MAX_ZOOM} className="p-2.5 text-ink-700 hover:bg-ink-50 disabled:opacity-30" aria-label="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => zoomBy(-1)} disabled={!vp || vp.zoom <= MIN_ZOOM} className="border-t border-ink-100 p-2.5 text-ink-700 hover:bg-ink-50 disabled:opacity-30" aria-label="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => (selected ? onView({ lng: selected.vehicle.latest_location!.longitude, lat: selected.vehicle.latest_location!.latitude, zoom: 14 }) : onView(null))}
          disabled={!providerConfigured}
          className="border-t border-ink-100 p-2.5 text-ink-700 hover:bg-ink-50 disabled:opacity-30"
          aria-label={selected ? "Center on the selected vehicle" : "Fit all vehicles"}
          title={selected ? "Center on the selected vehicle" : "Fit all vehicles"}
        >
          <Locate className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
