"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, Download, Map as MapIcon, Eye, Info, MapPin, MoreVertical, Radio, Route, Satellite, Truck, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Dropdown } from "@/components/ui/dropdown";
import { Select } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { StatFilterCards } from "@/components/ui/stat-filter-cards";
import { TRIP_STATUS, VEHICLE_STATUS, statusOptions } from "@/lib/constants";
import { exportCsv } from "@/lib/export";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { gpsService } from "@/services/resources";
import type { Vehicle } from "@/types/api";

export const GPS_PATH = "/transportation/gps-tracking";
/** A position older than this is shown as stale. */
const STALE_MINUTES = 15;

const TABS = [
  { value: "all", label: "All vehicles" },
  { value: "reporting", label: "Reporting" },
  { value: "stale", label: "Stale position" },
  { value: "silent", label: "No position" },
  { value: "active", label: "On a trip" },
];

const isStale = (v: Vehicle) => !!v.latest_location && Date.now() - new Date(v.latest_location.recorded_at).getTime() > STALE_MINUTES * 60_000;

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
      (tab === "all" || (tab === "reporting" && v.latest_location) || (tab === "stale" && isStale(v)) || (tab === "silent" && !v.latest_location) || (tab === "active" && v.active_trip)) &&
      (!status || v.status === status) &&
      (!term || [v.plate_number, v.make, v.model, v.assigned_driver?.full_name, v.active_trip?.trip_number].some((x) => x?.toLowerCase().includes(term))),
  );

  const runExport = () =>
    exportCsv(
      "gps-positions",
      ["Vehicle", "Make / Model", "Status", "Driver", "Active Trip", "Latitude", "Longitude", "Speed (km/h)", "Reported", "Source"],
      rows.map((v) => [
        v.plate_number,
        `${v.make} ${v.model}`,
        VEHICLE_STATUS[v.status].label,
        v.active_trip?.driver?.full_name ?? v.assigned_driver?.full_name,
        v.active_trip?.trip_number,
        v.latest_location?.latitude,
        v.latest_location?.longitude,
        v.latest_location?.speed_kph,
        v.latest_location ? formatDateTime(v.latest_location.recorded_at) : "",
        v.latest_location?.source,
      ]),
    );

  return (
    <>
      <PageHeader
        title="GPS Tracking"
        description="Each vehicle's last reported position. Open a vehicle to see its recent track."
        actions={
          <>
            <Button variant="secondary" size="lg" onClick={runExport} disabled={!data}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button size="lg" onClick={() => router.push(`${GPS_PATH}/live`)}>
              <MapIcon className="h-4 w-4" /> Live Map Dashboard
            </Button>
          </>
        }
      />

      {meta && !meta.has_gps_data && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>No GPS data has been received yet.</strong> Positions appear here once a telematics device or integration posts to{" "}
            <code className="rounded bg-white/60 px-1">POST /api/v1/gps/locations</code> (vehicle_id, latitude, longitude, recorded_at). BlitzMove does not simulate positions.
          </span>
        </div>
      )}

      <StatFilterCards
        active={tab}
        onSelect={setTab}
        loading={!data}
        cards={[
          { key: "all", label: "All Vehicles", icon: Truck, tone: "bg-brand-50 text-brand-600", count: vehicles.length, hint: meta?.map_provider_configured ? "Map provider configured" : "No map provider" },
          { key: "reporting", label: "Reporting", icon: Satellite, tone: "bg-emerald-50 text-emerald-600", count: reporting, hint: meta?.last_reported_at ? `Last ${formatRelative(meta.last_reported_at)}` : "Nothing received yet" },
          { key: "stale", label: "Stale", icon: Clock, tone: "bg-amber-50 text-amber-600", count: vehicles.filter(isStale).length, hint: `No update in ${STALE_MINUTES}+ min` },
          { key: "silent", label: "No Position", icon: Radio, tone: "bg-ink-100 text-ink-600", count: vehicles.length - reporting, hint: "Never reported" },
          { key: "active", label: "On a Trip", icon: MapPin, tone: "bg-sky-50 text-sky-600", count: vehicles.filter((v) => v.active_trip).length, hint: "Dispatched or in progress" },
        ]}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]">
        <Select value={tab} onChange={(e) => setTab(e.target.value)} options={TABS} aria-label="Filter by position" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} options={statusOptions(VEHICLE_STATUS)} placeholder="All Vehicle Status" aria-label="Filter by vehicle status" />
        <SearchInput value={search} onChange={setSearch} placeholder="Search plate, vehicle, driver, trip…" />
        <Button
          variant="secondary"
          onClick={() => {
            setTab("all");
            setStatus("");
            setSearch("");
          }}
          disabled={tab === "all" && !status && !search}
          className="h-10"
        >
          <X className="h-4 w-4" /> Clear
        </Button>
      </div>

      <Card>
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
            { key: "status", header: "Status", cell: (v) => <StatusBadge status={v.status} map={VEHICLE_STATUS} dot={false} /> },
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
                    <StatusBadge status={v.active_trip.status} map={TRIP_STATUS} dot={false} />
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
            {
              key: "actions",
              header: "Actions",
              headerClassName: "sticky right-0 bg-ink-50 text-center",
              className: "sticky right-0 bg-white text-center shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
              cell: (v) => (
                // Clicks here must not open the row.
                <div onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={({ toggle }) => (
                      <button onClick={toggle} className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Actions for ${v.plate_number}`}>
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                    items={[
                      { label: "View tracking", icon: <Eye />, onSelect: () => router.push(`${GPS_PATH}/${v.id}`) },
                      { label: "Vehicle details", icon: <Truck />, onSelect: () => router.push(`/fleet/vehicles/${v.id}`) },
                      ...(v.active_trip ? [{ label: "Trip itinerary", icon: <Route />, onSelect: () => router.push(`/transportation/itinerary/${v.active_trip!.id}`) }] : []),
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
