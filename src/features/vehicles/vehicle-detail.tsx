"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Fuel, MapPin, Pencil, Route, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-current-user";
import { BODY_TYPES, FUEL_TYPES, TRIP_STATUS, VEHICLE_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { api } from "@/services/api-client";
import { vehiclesService } from "@/services/resources";
import { DetailRow } from "../orders/order-detail";

export function VehicleDetail({ id }: { id: number }) {
  const { canManageFleet } = usePermissions();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["vehicle", id], queryFn: () => vehiclesService.get(id) });
  const v = data?.data;

  if (isLoading) return <LoadingState />;
  if (error || !v) return <ErrorState message={error?.message} onRetry={() => refetch()} />;

  return (
    <>
      <Link href="/fleet/vehicles" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to vehicles
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink-100 text-ink-700">
            <Truck className="h-8 w-8" />
          </span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{v.plate_number}</h1>
              <StatusBadge status={v.status} map={VEHICLE_STATUS} />
            </div>
            <p className="text-ink-500">
              {v.make} {v.model} · {labelOf(VEHICLE_TYPES, v.vehicle_type)}
            </p>
          </div>
        </div>
        {canManageFleet && (
          <Button variant="secondary" onClick={() => router.push(`/fleet/vehicles/${v.id}/edit`)}>
            <Pencil className="h-4 w-4" /> Edit vehicle
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Vehicle Information" icon={<Truck />} />
          {v.cover_photo && (
            // eslint-disable-next-line @next/next/no-img-element -- served by the API
            <img src={api.url(v.cover_photo)} alt={v.plate_number} className="aspect-[16/9] w-full border-b border-ink-100 object-cover" />
          )}
          <CardBody>
            <dl>
              <DetailRow label="Year model">{v.year}</DetailRow>
              <DetailRow label="Color / Body">{[v.color, BODY_TYPES.find((b) => b.value === v.body_type)?.label, v.wheels ? `${v.wheels} wheeler` : null].filter(Boolean).join(" · ") || "—"}</DetailRow>
              <DetailRow label="Registration">{v.registration_expiry ? `Expires ${formatDate(v.registration_expiry)}` : "—"}</DetailRow>
              <DetailRow label="Insurance">{v.insurance_expiry ? `Expires ${formatDate(v.insurance_expiry)}` : "—"}</DetailRow>
              <DetailRow label="Depot">{v.home_depot ?? "—"}</DetailRow>
              <DetailRow label="Odometer">{v.odometer_km != null ? `${formatNumber(v.odometer_km)} km` : "—"}</DetailRow>
              <DetailRow label="Capacity">{v.capacity_kg ? `${formatNumber(v.capacity_kg)} kg` : "—"}</DetailRow>
              <DetailRow label="Fuel type">{labelOf(FUEL_TYPES, v.fuel_type)}</DetailRow>
              <DetailRow label="VIN / Chassis">{v.vin ?? "—"}</DetailRow>
              <DetailRow label="Assigned driver">{v.assigned_driver?.full_name ?? "—"}</DetailRow>
              <DetailRow label="Documents">
                <Link href={`/fleet/documents?owner=vehicle&id=${v.id}`} className="text-brand-600 hover:underline">
                  {v.documents_count ?? 0} on file
                </Link>
              </DetailRow>
              {v.notes && <DetailRow label="Notes">{v.notes}</DetailRow>}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Current Assignment" icon={<Route />} />
          <CardBody>
            {v.active_trip ? (
              <dl>
                <DetailRow label="Trip">
                  <Link href={`/transportation/itinerary/${v.active_trip.id}`} className="text-brand-600 hover:underline">
                    {v.active_trip.trip_number}
                  </Link>
                </DetailRow>
                <DetailRow label="Route">
                  {v.active_trip.origin} → {v.active_trip.destination}
                </DetailRow>
                <DetailRow label="Status">
                  <StatusBadge status={v.active_trip.status} map={TRIP_STATUS} />
                </DetailRow>
                <DetailRow label="ETA">{formatDateTime(v.active_trip.estimated_arrival_at)}</DetailRow>
              </dl>
            ) : (
              <p className="text-sm text-ink-500">Not on a dispatched trip right now.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Last Known Location" icon={<MapPin />} />
          <CardBody>
            {v.latest_location ? (
              <dl>
                <DetailRow label="Coordinates">
                  {v.latest_location.latitude.toFixed(5)}, {v.latest_location.longitude.toFixed(5)}
                </DetailRow>
                <DetailRow label="Speed">{v.latest_location.speed_kph !== null ? `${v.latest_location.speed_kph} km/h` : "—"}</DetailRow>
                <DetailRow label="Reported">{formatDateTime(v.latest_location.recorded_at)}</DetailRow>
              </dl>
            ) : (
              <p className="text-sm text-ink-500">No GPS position has been reported for this vehicle.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Recent Trips" icon={<Route />} />
          <DataTable
            rows={v.recent_trips}
            rowKey={(t) => t.id}
            empty={{ title: "No trips yet" }}
            columns={[
              { key: "no", header: "Trip No.", cell: (t) => <Link href={`/transportation/itinerary/${t.id}`} className="font-medium hover:text-brand-600">{t.trip_number}</Link> },
              { key: "route", header: "Route", cell: (t) => `${t.origin} → ${t.destination}` },
              { key: "driver", header: "Driver", cell: (t) => t.driver?.full_name },
              { key: "dep", header: "Departure", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.departure_at)}</span> },
              { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Recent Fuel Entries" icon={<Fuel />} action={<Link href={`/fleet/fuel?vehicle=${v.id}`} className="text-sm font-medium text-brand-600">Fuel history</Link>} />
          <DataTable
            rows={v.recent_fuel_records}
            rowKey={(f) => f.id}
            empty={{ title: "No fuel records" }}
            columns={[
              { key: "date", header: "Date", cell: (f) => <span className="whitespace-nowrap">{formatDateTime(f.fueled_at)}</span> },
              { key: "liters", header: "Liters", cell: (f) => formatNumber(f.liters, 2) },
              { key: "cost", header: "Cost", cell: (f) => formatCurrency(f.total_cost) },
              { key: "station", header: "Station", cell: (f) => f.station ?? "—" },
            ]}
          />
        </Card>
      </div>

    </>
  );
}
