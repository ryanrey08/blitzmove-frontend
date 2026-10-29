"use client";

import { ArrowLeft, CheckCircle2, Clock, MapPin, Pencil, Plus, SkipForward, Trash2, Truck, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { STOP_STATUS, STOP_TYPE, TRIP_STATUS } from "@/lib/constants";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import { stopsService } from "@/services/resources";
import type { StopStatus, TripStop } from "@/types/api";
import { DetailRow } from "../orders/order-detail";
import { StopDialog } from "./stop-dialog";
import { TRIP_KEYS, useTrip } from "./use-trip";

export const ITINERARY_PATH = "/transportation/itinerary";

const MARKER: Record<string, string> = { pickup: "bg-emerald-600", stop: "bg-sky-600", dropoff: "bg-brand-600" };

/** `/transportation/itinerary/[id]`: one trip's stops, with progress and editing. */
export function ItineraryTripView({ tripId }: { tripId: number }) {
  const { canOperate } = usePermissions();
  const { data, isLoading, error, refetch } = useTrip(tripId);
  const [editingStop, setEditingStop] = useState<TripStop | null | undefined>(undefined);
  const [removing, setRemoving] = useState<TripStop | null>(null);

  const progress = useApiMutation(({ stop, status }: { stop: TripStop; status: StopStatus }) => stopsService.update(stop.trip_id, stop.id, { status }), { invalidate: TRIP_KEYS });
  const remove = useApiMutation(() => stopsService.remove(removing!.trip_id, removing!.id), { invalidate: TRIP_KEYS, onSuccess: () => setRemoving(null) });

  const trip = data?.data;
  const editable = trip && !["completed", "cancelled"].includes(trip.status) && canOperate;

  return (
    <>
      <Link href={ITINERARY_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to itinerary
      </Link>
      <PageHeader title={trip ? `Itinerary · ${trip.trip_number}` : "Itinerary"} description="Trip stops, estimated times and progress along the route." />

      {isLoading ? (
        <LoadingState />
      ) : error || !trip ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader title={trip.trip_number} icon={<Truck />} action={<StatusBadge status={trip.status} map={TRIP_STATUS} />} />
            <CardBody>
              <dl>
                <DetailRow label="Route">
                  {trip.origin} → {trip.destination}
                </DetailRow>
                <DetailRow label="Departure">{formatDateTime(trip.departure_at)}</DetailRow>
                <DetailRow label="Est. arrival">{formatDateTime(trip.estimated_arrival_at)}</DetailRow>
                {trip.actual_departure_at && <DetailRow label="Departed">{formatDateTime(trip.actual_departure_at)}</DetailRow>}
                {trip.actual_arrival_at && <DetailRow label="Arrived">{formatDateTime(trip.actual_arrival_at)}</DetailRow>}
                <DetailRow label="Distance">{trip.distance_km ? `${formatNumber(trip.distance_km, 1)} km` : "Not recorded"}</DetailRow>
                <DetailRow label="Order">{trip.order ? <Link href={`/orders/${trip.order.id}`} className="text-brand-600 hover:underline">{trip.order.order_number} · {trip.order.customer_name}</Link> : "—"}</DetailRow>
                <DetailRow label="Vehicle">{trip.vehicle ? `${trip.vehicle.plate_number} · ${trip.vehicle.make} ${trip.vehicle.model}` : "—"}</DetailRow>
                <DetailRow label="Driver">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 text-ink-400" />
                    {trip.driver?.full_name} · {trip.driver?.phone}
                  </span>
                </DetailRow>
                {trip.notes && <DetailRow label="Notes"><span className="whitespace-pre-line">{trip.notes}</span></DetailRow>}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/transportation/dispatch/${trip.id}`}>
                  <Button variant="secondary" size="sm">Open in dispatch</Button>
                </Link>
                <Link href={`/transportation/route-optimization?trip=${trip.id}`}>
                  <Button variant="secondary" size="sm">Plan route</Button>
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Stops"
              icon={<MapPin />}
              description={`${trip.stops?.length ?? 0} stops`}
              action={
                editable && (
                  <Button size="sm" onClick={() => setEditingStop(null)}>
                    <Plus className="h-4 w-4" /> Add stop
                  </Button>
                )
              }
            />
            <ol className="relative px-5 py-4">
              {trip.stops?.map((stop, index) => {
                const last = index === (trip.stops?.length ?? 0) - 1;
                return (
                  <li key={stop.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {!last && <span className="absolute top-8 left-[0.95rem] h-[calc(100%-1.5rem)] w-px bg-ink-200" aria-hidden />}
                    <span className={cn("relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", MARKER[stop.type])}>
                      {stop.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : stop.sequence}
                    </span>
                    <div className="min-w-0 flex-1 rounded-lg border border-ink-100 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink-900">{stop.location_name}</p>
                        <StatusBadge status={stop.type} map={STOP_TYPE} dot={false} />
                        <StatusBadge status={stop.status} map={STOP_STATUS} />
                      </div>
                      {stop.address && <p className="mt-0.5 text-sm text-ink-600">{stop.address}</p>}
                      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> ETA {formatDateTime(stop.estimated_arrival_at)}
                        </span>
                        {stop.actual_arrival_at && <span>Actual {formatDateTime(stop.actual_arrival_at)}</span>}
                        {stop.order && <span>Order {stop.order.order_number}</span>}
                      </p>
                      {stop.notes && <p className="mt-1 text-xs text-ink-600">{stop.notes}</p>}
                      {canOperate && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {trip.status === "in_progress" && stop.status === "pending" && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => progress.mutate({ stop, status: "arrived" })}>Arrived</Button>
                              <Button size="sm" variant="secondary" onClick={() => progress.mutate({ stop, status: "completed" })}>Completed</Button>
                              {stop.type === "stop" && (
                                <Button size="sm" variant="ghost" onClick={() => progress.mutate({ stop, status: "skipped" })}>
                                  <SkipForward className="h-3.5 w-3.5" /> Skip
                                </Button>
                              )}
                            </>
                          )}
                          {trip.status === "in_progress" && stop.status === "arrived" && (
                            <Button size="sm" variant="secondary" onClick={() => progress.mutate({ stop, status: "completed" })}>Mark completed</Button>
                          )}
                          {editable && (
                            <Button size="sm" variant="ghost" onClick={() => setEditingStop(stop)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                          )}
                          {editable && stop.type === "stop" && (
                            <Button size="sm" variant="ghost" className="text-brand-700" onClick={() => setRemoving(stop)}>
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      )}

      {trip && <StopDialog tripId={trip.id} open={editingStop !== undefined} stop={editingStop ?? null} onClose={() => setEditingStop(undefined)} />}
      <ConfirmDialog
        open={!!removing}
        title="Remove stop"
        message={`Remove “${removing?.location_name}” from the itinerary?`}
        confirmLabel="Remove"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate(undefined)}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
