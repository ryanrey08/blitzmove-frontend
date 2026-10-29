"use client";

import { ArrowLeft, CalendarClock, ClipboardList, History, MapPinned, Pencil, Route, Trash2, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { STOP_ACTIVITY, STOP_STATUS, STOP_TYPE, TRIP_PRIORITY, TRIP_STATUS, TRIP_TYPES, labelOf } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { tripsService } from "@/services/resources";
import { DetailRow } from "../orders/order-detail";
import { DeleteTripDialog, TRIPS_PATH, isDeletable, isEditable } from "./trip-schedule-view";
import { TRIP_KEYS, useTrip } from "./use-trip";

export function TripDetail({ id }: { id: number }) {
  const router = useRouter();
  const { canOperate } = usePermissions();
  const [deleting, setDeleting] = useState(false);
  const { data, isLoading, error, refetch } = useTrip(id);
  const trip = data?.data;
  const remove = useApiMutation(() => tripsService.remove(id), { invalidate: TRIP_KEYS, onSuccess: () => router.push(TRIPS_PATH) });

  if (isLoading) return <LoadingState />;
  if (error || !trip) return <ErrorState message={error?.message ?? "Trip not found."} onRetry={() => refetch()} />;

  return (
    <>
      <Link href={TRIPS_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to trips
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{trip.trip_number}</h1>
            <StatusBadge status={trip.status} map={TRIP_STATUS} />
            <StatusBadge status={trip.priority} map={TRIP_PRIORITY} dot={false} />
          </div>
          <p className="mt-1 text-ink-500">
            {trip.origin} → {trip.destination}
            {trip.reference_no ? ` · Ref ${trip.reference_no}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push(`/transportation/itinerary?trip=${trip.id}`)}>
            <MapPinned className="h-4 w-4" /> Itinerary
          </Button>
          {canOperate && (
            <>
              <Button variant="secondary" onClick={() => setDeleting(true)} disabled={!isDeletable(trip)} title={isDeletable(trip) ? undefined : "In-progress trips cannot be deleted"}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button onClick={() => router.push(`${TRIPS_PATH}/${trip.id}/edit`)} disabled={!isEditable(trip)} title={isEditable(trip) ? undefined : "Only scheduled trips can be edited"}>
                <Pencil className="h-4 w-4" /> Edit Trip
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Trip Information" icon={<ClipboardList />} />
          <CardBody>
            <dl>
              <DetailRow label="Trip type">{labelOf(TRIP_TYPES, trip.trip_type)}</DetailRow>
              <DetailRow label="Priority">{TRIP_PRIORITY[trip.priority]?.label}</DetailRow>
              <DetailRow label="Reference no.">{trip.reference_no}</DetailRow>
              <DetailRow label="Order">
                {trip.order ? (
                  <Link href={`/orders/${trip.order.id}`} className="font-medium hover:text-brand-600">
                    {trip.order.order_number} · {trip.order.customer_name}
                  </Link>
                ) : null}
              </DetailRow>
              <DetailRow label="Distance">{trip.distance_km !== null ? `${formatNumber(trip.distance_km, 1)} km` : null}</DetailRow>
              <DetailRow label="Remarks">{trip.notes ? <span className="whitespace-pre-line">{trip.notes}</span> : null}</DetailRow>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Schedule" icon={<CalendarClock />} />
          <CardBody>
            <dl>
              <DetailRow label="Departure">{formatDateTime(trip.departure_at)}</DetailRow>
              <DetailRow label="Est. arrival">{formatDateTime(trip.estimated_arrival_at)}</DetailRow>
              <DetailRow label="Actual departure">{trip.actual_departure_at ? formatDateTime(trip.actual_departure_at) : null}</DetailRow>
              <DetailRow label="Actual arrival">{trip.actual_arrival_at ? formatDateTime(trip.actual_arrival_at) : null}</DetailRow>
              <DetailRow label="Dispatched">{trip.dispatched_at ? `${formatDateTime(trip.dispatched_at)}${trip.dispatched_by ? ` by ${trip.dispatched_by.name}` : ""}` : null}</DetailRow>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Vehicle & Driver" icon={<Truck />} />
          <CardBody>
            <dl>
              <DetailRow label="Vehicle">{trip.vehicle ? <Link href={`/fleet/vehicles/${trip.vehicle.id}`} className="font-medium hover:text-brand-600">{trip.vehicle.plate_number} · {trip.vehicle.make} {trip.vehicle.model}</Link> : null}</DetailRow>
              <DetailRow label="Driver">{trip.driver ? `${trip.driver.full_name} · ${trip.driver.phone}` : null}</DetailRow>
              <DetailRow label="Co-driver">{trip.co_driver ? `${trip.co_driver.full_name} · ${trip.co_driver.phone}` : null}</DetailRow>
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Stops" icon={<Route />} description={`${trip.stops?.length ?? 0} stops in order`} />
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer / Location</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Order No.</th>
                <th className="px-4 py-3">Stop Type</th>
                <th className="px-4 py-3">ETA</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {(trip.stops ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-semibold text-ink-900">{s.sequence}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{s.location_name}</td>
                  <td className="max-w-64 px-4 py-3 text-xs text-ink-600">{s.address ?? "—"}</td>
                  <td className="px-4 py-3">{s.order?.order_number ?? "—"}</td>
                  <td className="px-4 py-3">{s.activity ? <StatusBadge status={s.activity} map={STOP_ACTIVITY} dot={false} /> : <StatusBadge status={s.type} map={STOP_TYPE} dot={false} />}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(s.estimated_arrival_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} map={STOP_STATUS} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!!trip.assignments?.length && (
        <Card className="mt-6">
          <CardHeader title="Assignment history" icon={<History />} />
          <ul className="divide-y divide-ink-100">
            {trip.assignments.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 px-5 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="text-ink-900">
                  {a.vehicle?.plate_number} · {a.driver?.full_name}
                  {a.reason && <span className="text-ink-500"> — {a.reason}</span>}
                </span>
                <span className="text-xs text-ink-500">
                  {formatDateTime(a.assigned_at)}
                  {a.assigned_by ? ` by ${a.assigned_by.name}` : ""}
                  {a.released_at ? ` · released ${formatDateTime(a.released_at)}` : " · current"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <DeleteTripDialog trip={deleting ? trip : null} loading={remove.isPending} error={remove.error?.message} onConfirm={() => remove.mutate(undefined)} onClose={() => { remove.reset(); setDeleting(false); }} />
    </>
  );
}
