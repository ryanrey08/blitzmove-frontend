"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Info, MapPinned, Save, Sparkles, Undo2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { STOP_TYPE, TRIP_STATUS } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { routingService, stopsService, tripsService } from "@/services/resources";
import type { TripStop } from "@/types/api";
import { TripPicker } from "./trip-picker";
import { TRIP_KEYS, useTrip } from "./use-trip";

/**
 * Manual route planning. Stop order can be changed and saved; automatic
 * optimisation, distances and travel times require a configured routing provider.
 */
export function RouteOptimizationView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = Number(searchParams.get("trip")) || null;
  const { canOperate } = usePermissions();
  const routing = useQuery({ queryKey: ["routing", "status"], queryFn: routingService.status, staleTime: 300_000 });
  const { data, isLoading, error, refetch } = useTrip(tripId);
  const trip = data?.data;
  const [order, setOrder] = useState<TripStop[]>([]);

  const stops = useMemo(() => trip?.stops ?? [], [trip]);
  useEffect(() => setOrder(stops.filter((s) => s.type === "stop")), [stops]);

  const original = stops.filter((s) => s.type === "stop").map((s) => s.id).join(",");
  const dirty = order.map((s) => s.id).join(",") !== original;
  const editable = !!trip && !["completed", "cancelled"].includes(trip.status) && canOperate;
  const configured = routing.data?.data.configured ?? false;

  const save = useApiMutation(() => stopsService.reorder(tripId!, order.map((s) => s.id)), { invalidate: TRIP_KEYS });
  const optimize = useApiMutation(() => tripsService.optimize(tripId!), { invalidate: TRIP_KEYS });

  const move = (index: number, delta: number) =>
    setOrder((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const pickup = stops.find((s) => s.type === "pickup");
  const dropoff = stops.find((s) => s.type === "dropoff");
  const planned = [pickup, ...order, dropoff].filter(Boolean) as TripStop[];

  return (
    <>
      <PageHeader title="Route Optimization" description="Plan the stop sequence for a trip and save it to the itinerary." />

      <div
        className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        role="status"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {configured ? (
          <span>Routing provider “{routing.data?.data.provider}” is configured. Automatic optimisation is available.</span>
        ) : (
          <span>
            <strong>No routing or map provider is configured.</strong> You can order stops manually and save the plan. Automatic optimisation, road distances and drive times are not
            calculated until a provider is connected (set <code className="rounded bg-white/60 px-1">ROUTING_PROVIDER</code> on the API and bind a <code className="rounded bg-white/60 px-1">RoutingProvider</code> implementation).
          </span>
        )}
      </div>

      <Card className="mb-6">
        <CardBody>
          <TripPicker value={tripId} openOnly onChange={(id) => router.replace(id ? `/transportation/route-optimization?trip=${id}` : "/transportation/route-optimization")} />
        </CardBody>
      </Card>

      {!tripId ? (
        <Card>
          <EmptyState title="Select a trip to plan" description="Open trips (scheduled, dispatched or in progress) are listed." icon={<MapPinned className="h-6 w-6" />} />
        </Card>
      ) : isLoading ? (
        <LoadingState />
      ) : error || !trip ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              title="Stop sequence"
              icon={<MapPinned />}
              description={`${trip.trip_number} · ${trip.origin} → ${trip.destination}`}
              action={<StatusBadge status={trip.status} map={TRIP_STATUS} />}
            />
            <ol className="divide-y divide-ink-100">
              {pickup && <FixedStop stop={pickup} />}
              {order.map((stop, index) => (
                <li key={stop.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">{index + 2}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{stop.location_name}</p>
                    <p className="truncate text-xs text-ink-500">{stop.address ?? "No address"} · ETA {formatDateTime(stop.estimated_arrival_at)}</p>
                  </div>
                  {editable && (
                    <div className="flex gap-1">
                      <Button variant="secondary" size="icon" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${stop.location_name} up`}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="icon" onClick={() => move(index, 1)} disabled={index === order.length - 1} aria-label={`Move ${stop.location_name} down`}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
              {order.length === 0 && <li className="px-5 py-4 text-sm text-ink-500">No intermediate stops. Add stops in the Itinerary page to plan a multi-drop route.</li>}
              {dropoff && <FixedStop stop={dropoff} />}
            </ol>
            {editable && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3">
                <Button variant="ghost" onClick={() => setOrder(stops.filter((s) => s.type === "stop"))} disabled={!dirty}>
                  <Undo2 className="h-4 w-4" /> Reset
                </Button>
                <Button variant="secondary" onClick={() => optimize.mutate(undefined)} disabled={!configured} loading={optimize.isPending} title={configured ? undefined : "Requires a routing provider"}>
                  <Sparkles className="h-4 w-4" /> Optimize automatically
                </Button>
                <Button onClick={() => save.mutate(undefined)} disabled={!dirty} loading={save.isPending}>
                  <Save className="h-4 w-4" /> Save stop order
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Route summary" icon={<Info />} />
            <CardBody className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-xs text-ink-500">Stops</p>
                  <p className="text-xl font-bold text-ink-900">{planned.length}</p>
                </div>
                <div className="rounded-lg bg-ink-50 p-3">
                  <p className="text-xs text-ink-500">Planned distance</p>
                  <p className="text-xl font-bold text-ink-900">{trip.distance_km ? `${formatNumber(trip.distance_km, 1)} km` : "—"}</p>
                  {!trip.distance_km && <p className="text-xs text-ink-500">Not recorded</p>}
                </div>
                <div className="col-span-2 rounded-lg bg-ink-50 p-3">
                  <p className="text-xs text-ink-500">Scheduled window</p>
                  <p className="font-medium text-ink-900">
                    {formatDateTime(trip.departure_at)} → {formatDateTime(trip.estimated_arrival_at)}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 font-medium text-ink-900">Planned sequence</p>
                <p className="text-ink-600">{planned.map((s) => s.location_name).join(" → ")}</p>
              </div>
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-ink-200 bg-ink-50 p-4 text-center text-xs text-ink-500">
                Map preview appears here once a map provider is configured (NEXT_PUBLIC_MAP_PROVIDER).
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}

function FixedStop({ stop }: { stop: TripStop }) {
  return (
    <li className="flex items-center gap-3 bg-ink-50/60 px-5 py-3">
      <StatusBadge status={stop.type} map={STOP_TYPE} dot={false} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink-900">{stop.location_name}</p>
        <p className="truncate text-xs text-ink-500">
          {stop.address ?? "No address"} · {formatDateTime(stop.estimated_arrival_at)}
        </p>
      </div>
      <span className="text-xs text-ink-400">Fixed</span>
    </li>
  );
}
