"use client";

import { useQuery } from "@tanstack/react-query";
import { Info, MapPin, Radio, Satellite } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { TRIP_STATUS, VEHICLE_STATUS, statusOptions } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { gpsService } from "@/services/resources";

export const GPS_PATH = "/transportation/gps-tracking";
/** A position older than this is shown as stale. */
const STALE_MINUTES = 15;

const TABS = [
  { value: "all", label: "All vehicles" },
  { value: "reporting", label: "Reporting" },
  { value: "silent", label: "No position" },
  { value: "active", label: "On a trip" },
];

/** Shows only positions actually reported by a telematics integration. Nothing is simulated. */
export function GpsTrackingView() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const { data, isFetching, error, refetch } = useQuery({ queryKey: ["gps"], queryFn: gpsService.vehicles, refetchInterval: 30_000 });
  const meta = data?.meta;
  const vehicles = data?.data ?? [];
  const reporting = vehicles.filter((v) => v.latest_location).length;

  // The API returns the whole (small) fleet, so filtering happens here.
  const term = search.trim().toLowerCase();
  const rows = vehicles.filter(
    (v) =>
      (tab === "all" || (tab === "reporting" && v.latest_location) || (tab === "silent" && !v.latest_location) || (tab === "active" && v.active_trip)) &&
      (!status || v.status === status) &&
      (!term || [v.plate_number, v.make, v.model, v.assigned_driver?.full_name, v.active_trip?.trip_number].some((x) => x?.toLowerCase().includes(term))),
  );

  return (
    <>
      <PageHeader title="GPS Tracking" description="Each vehicle's last reported position. Open a vehicle to see its recent track." />

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
        <Tabs className="px-4 pt-2" value={tab} onChange={setTab} tabs={TABS} />
        <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <SearchInput value={search} onChange={setSearch} placeholder="Search plate, vehicle, driver, trip…" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions(VEHICLE_STATUS)} placeholder="All vehicle statuses" aria-label="Filter by vehicle status" />
        </div>
        <DataTable
          rows={data ? rows : undefined}
          loading={isFetching && !data}
          error={error}
          onRetry={() => refetch()}
          rowKey={(v) => v.id}
          onRowClick={(v) => router.push(`${GPS_PATH}/${v.id}`)}
          empty={{ title: "No vehicles match", description: "Try another tab, status or search." }}
          columns={[
            {
              key: "plate",
              header: "Vehicle",
              cell: (v) => (
                <span>
                  <span className="block font-semibold text-ink-900">{v.plate_number}</span>
                  <span className="text-xs text-ink-500">
                    {v.make} {v.model}
                  </span>
                </span>
              ),
            },
            { key: "status", header: "Status", cell: (v) => <StatusBadge status={v.status} map={VEHICLE_STATUS} /> },
            { key: "driver", header: "Driver", cell: (v) => v.active_trip?.driver?.full_name ?? v.assigned_driver?.full_name ?? <span className="text-ink-400">—</span> },
            {
              key: "trip",
              header: "Active Trip",
              cell: (v) =>
                v.active_trip ? (
                  <span className="text-xs">
                    <Link href={`/transportation/itinerary/${v.active_trip.id}`} onClick={(e) => e.stopPropagation()} className="block font-medium text-ink-900 hover:text-brand-600">
                      {v.active_trip.trip_number}
                    </Link>
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
            {
              key: "time",
              header: "Reported",
              cell: (v) => {
                if (!v.latest_location) return "—";
                const stale = Date.now() - new Date(v.latest_location.recorded_at).getTime() > STALE_MINUTES * 60_000;
                return (
                  <span title={formatDateTime(v.latest_location.recorded_at)} className={stale ? "text-amber-700" : "text-emerald-700"}>
                    {formatRelative(v.latest_location.recorded_at)}
                  </span>
                );
              },
            },
            { key: "src", header: "Source", cell: (v) => v.latest_location?.source ?? "—" },
          ]}
        />
      </Card>
    </>
  );
}
