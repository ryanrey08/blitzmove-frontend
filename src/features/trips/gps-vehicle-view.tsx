"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Radio, Truck } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { TRIP_STATUS, VEHICLE_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { gpsService } from "@/services/resources";
import { DetailRow } from "../orders/order-detail";
import { GPS_PATH } from "./gps-tracking-view";
import { RouteMap } from "./route-map";

/** `/transportation/gps-tracking/[id]`: one vehicle's recent reported positions and track. */
export function GpsVehicleView({ vehicleId }: { vehicleId: number }) {
  const { data, isLoading, isFetching, error, refetch } = useQuery({ queryKey: ["gps", "track", vehicleId], queryFn: () => gpsService.track(vehicleId), refetchInterval: 30_000 });
  const track = data?.data;
  const vehicle = track?.vehicle;
  const latest = track?.locations[0];

  return (
    <>
      <Link href={GPS_PATH} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to GPS tracking
      </Link>
      <PageHeader title={vehicle ? `Tracking · ${vehicle.plate_number}` : "Vehicle tracking"} description="Positions reported by the vehicle's GPS device, newest first." />

      {isLoading ? (
        <LoadingState />
      ) : error || !track || !vehicle ? (
        <ErrorState message={error?.message ?? "Vehicle not found."} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader title={vehicle.plate_number} icon={<Truck />} action={<StatusBadge status={vehicle.status} map={VEHICLE_STATUS} />} />
              <CardBody>
                <dl>
                  <DetailRow label="Vehicle">
                    <Link href={`/fleet/vehicles/${vehicle.id}`} className="hover:text-brand-600">
                      {vehicle.make} {vehicle.model} · {labelOf(VEHICLE_TYPES, vehicle.vehicle_type)}
                    </Link>
                  </DetailRow>
                  <DetailRow label="Driver">{vehicle.active_trip?.driver?.full_name ?? vehicle.assigned_driver?.full_name ?? "—"}</DetailRow>
                  <DetailRow label="Active trip">
                    {vehicle.active_trip ? (
                      <span className="inline-flex items-center gap-2">
                        <Link href={`/transportation/itinerary/${vehicle.active_trip.id}`} className="font-medium hover:text-brand-600">
                          {vehicle.active_trip.trip_number}
                        </Link>
                        <StatusBadge status={vehicle.active_trip.status} map={TRIP_STATUS} />
                      </span>
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                </dl>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Last position" icon={<Radio />} />
              <CardBody>
                {latest ? (
                  <dl>
                    <DetailRow label="Coordinates">
                      <span className="font-mono text-sm">
                        {latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}
                      </span>
                    </DetailRow>
                    <DetailRow label="Speed">{latest.speed_kph != null ? `${latest.speed_kph} km/h` : "—"}</DetailRow>
                    <DetailRow label="Heading">{latest.heading != null ? `${latest.heading}°` : "—"}</DetailRow>
                    <DetailRow label="Reported">
                      {formatRelative(latest.recorded_at)} ({formatDateTime(latest.recorded_at)})
                    </DetailRow>
                    <DetailRow label="Source">{latest.source ?? "—"}</DetailRow>
                  </dl>
                ) : (
                  <p className="text-sm text-ink-500">This vehicle hasn&apos;t reported a position yet. Positions arrive through POST /api/v1/gps/locations from its GPS device.</p>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Recent track" icon={<MapPin />} description={track.locations.length ? `Last ${track.locations.length} positions` : undefined} />
              <div className="p-3">
                <RouteMap
                  configured={data.meta.map_provider_configured}
                  image={track.image}
                  loading={isFetching && !track.image}
                  emptyHint={track.locations.length ? "The map could not be drawn." : "The track appears once the vehicle reports positions."}
                  className="aspect-[16/10] min-h-0"
                />
              </div>
            </Card>
            <Card>
              <CardHeader title="Position history" icon={<Radio />} />
              <DataTable
                rows={track.locations}
                rowKey={(l) => l.id}
                empty={{ title: "No positions yet", description: "Nothing has been reported for this vehicle." }}
                columns={[
                  { key: "time", header: "Reported", cell: (l) => formatDateTime(l.recorded_at) },
                  { key: "pos", header: "Position", cell: (l) => <span className="font-mono text-xs">{l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}</span> },
                  { key: "speed", header: "Speed", cell: (l) => (l.speed_kph != null ? `${l.speed_kph} km/h` : "—") },
                  { key: "src", header: "Source", cell: (l) => l.source ?? "—" },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
