"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, MapPinned } from "lucide-react";
import type { ReactNode } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { routingService } from "@/services/resources";

/** Faint grid standing in for map tiles when there is no route image. */
const MAP_GRID = {
  backgroundImage: "linear-gradient(rgba(16,24,40,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(16,24,40,0.05) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
};

export interface RouteStop {
  label: string;
  query?: string | null;
}

export function useRoutingStatus() {
  const routing = useQuery({ queryKey: ["routing", "status"], queryFn: routingService.status, staleTime: 300_000 });
  return { configured: routing.data?.data.configured ?? false, provider: routing.data?.data.provider ?? null };
}

/** Routes the stops through the API's routing provider (debounced; needs at least an origin and destination). */
export function useRoutePreview(stops: RouteStop[], enabled: boolean, legendInset = false) {
  const named = stops.filter((s) => s.label.trim());
  const key = useDebounce(JSON.stringify(named.map((s) => ({ label: s.label.trim(), query: s.query?.trim() || null }))), 600);
  const debounced = JSON.parse(key) as RouteStop[];
  return useQuery({
    queryKey: ["routing", "preview", key, legendInset],
    queryFn: () => routingService.preview(debounced, { legendInset }).then((r) => r.data),
    enabled: enabled && debounced.length >= 2 && named.length === stops.length,
    placeholderData: keepPreviousData,
    staleTime: 600_000,
    retry: false,
  });
}

/** Map area: the provider's route image, or a placeholder explaining why there is none. */
export function RouteMap({
  configured,
  image,
  loading,
  error,
  unresolved = [],
  emptyHint,
  overlay,
  className,
}: {
  configured: boolean;
  image?: string | null;
  loading?: boolean;
  error?: string | null;
  unresolved?: string[];
  emptyHint?: string;
  overlay?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative min-h-80 overflow-hidden rounded-lg border border-ink-100 bg-ink-50", className)} style={image ? undefined : MAP_GRID}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI from the API, not an optimizable asset
        <img src={image} alt="Route map" className={cn("absolute inset-0 h-full w-full object-cover", loading && "opacity-60")} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center sm:pr-60">
          {loading ? <Loader2 className="h-7 w-7 animate-spin text-brand-600" /> : <MapPinned className="h-8 w-8 text-ink-300" />}
          <p className="text-sm font-medium text-ink-700">{!configured ? "Map provider not configured" : loading ? "Drawing route…" : error ? "Route unavailable" : "No route yet"}</p>
          <p className="max-w-56 text-xs text-ink-500">{!configured ? "Connect a map provider to draw the route." : (error ?? emptyHint)}</p>
        </div>
      )}
      {overlay && <div className="absolute inset-0 flex items-start justify-end p-3">{overlay}</div>}
      {unresolved.length > 0 && (
        <p className="absolute right-3 bottom-3 left-3 flex items-start gap-2 rounded-md bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Couldn&apos;t locate {unresolved.join(", ")}. Add a fuller address so the stop can be placed on the map.
        </p>
      )}
    </div>
  );
}
