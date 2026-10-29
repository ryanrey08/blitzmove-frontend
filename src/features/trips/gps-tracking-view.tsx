"use client";

import { useQuery } from "@tanstack/react-query";
import { Info, MapPin, Radio, Satellite } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TRIP_STATUS, VEHICLE_STATUS } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { gpsService } from "@/services/resources";

/** Shows only positions actually reported by a telematics integration. Nothing is simulated. */
export function GpsTrackingView() {
  const { data, isFetching, error, refetch } = useQuery({ queryKey: ["gps"], queryFn: gpsService.vehicles, refetchInterval: 30_000 });
  const meta = data?.meta;
  const vehicles = data?.data ?? [];
  const reporting = vehicles.filter((v) => v.latest_location).length;

  return (
    <>
      <PageHeader title="GPS Tracking" description="Last reported vehicle positions from connected GPS devices." />

      {meta && !meta.has_gps_data && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No GPS data has been received yet.</strong> Positions appear here once a telematics device or integration posts to{" "}
            <code className="rounded bg-white/60 px-1">POST /api/v1/gps/locations</code> (vehicle_id, latitude, longitude, recorded_at). BlitzMove does not simulate positions.
          </span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Vehicles reporting" value={`${reporting} / ${vehicles.length}`} icon={Satellite} tone="blue" loading={!data && isFetching} />
        <StatCard label="Last report" value={meta?.last_reported_at ? formatRelative(meta.last_reported_at) : "—"} icon={Radio} tone="green" loading={!data && isFetching} />
        <StatCard label="Map provider" value={meta?.map_provider_configured ? "Configured" : "Not configured"} icon={MapPin} tone={meta?.map_provider_configured ? "green" : "gray"} loading={!data && isFetching} />
      </div>

      <Card>
        <CardHeader title="Vehicle positions" icon={<MapPin />} description={meta?.map_provider_configured ? undefined : "A map view is enabled once NEXT_PUBLIC_MAP_PROVIDER is configured; coordinates are listed below."} />
        <DataTable
          rows={data?.data}
          loading={isFetching && !data}
          error={error}
          onRetry={() => refetch()}
          rowKey={(v) => v.id}
          empty={{ title: "No vehicles" }}
          columns={[
            { key: "plate", header: "Vehicle", cell: (v) => <Link href={`/fleet/vehicles/${v.id}`} className="font-medium text-ink-900 hover:text-brand-600">{v.plate_number}</Link> },
            { key: "status", header: "Status", cell: (v) => <StatusBadge status={v.status} map={VEHICLE_STATUS} /> },
            {
              key: "trip",
              header: "Active Trip",
              cell: (v) =>
                v.active_trip ? (
                  <span className="text-xs">
                    <Link href={`/transportation/itinerary/${v.active_trip.id}`} className="block font-medium text-ink-900 hover:text-brand-600">{v.active_trip.trip_number}</Link>
                    <StatusBadge status={v.active_trip.status} map={TRIP_STATUS} />
                  </span>
                ) : (
                  <span className="text-ink-400">—</span>
                ),
            },
            {
              key: "pos",
              header: "Last Position",
              cell: (v) =>
                v.latest_location ? (
                  <span className="font-mono text-xs">
                    {v.latest_location.latitude.toFixed(5)}, {v.latest_location.longitude.toFixed(5)}
                  </span>
                ) : (
                  <span className="text-xs text-ink-400">No position reported</span>
                ),
            },
            { key: "speed", header: "Speed", cell: (v) => (v.latest_location?.speed_kph != null ? `${v.latest_location.speed_kph} km/h` : "—") },
            { key: "time", header: "Reported", cell: (v) => (v.latest_location ? <span title={formatDateTime(v.latest_location.recorded_at)}>{formatRelative(v.latest_location.recorded_at)}</span> : "—") },
            { key: "src", header: "Source", cell: (v) => v.latest_location?.source ?? "—" },
          ]}
        />
      </Card>
    </>
  );
}
