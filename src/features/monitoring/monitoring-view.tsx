"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, FileWarning, Gauge, IdCard, Route, Truck, Users } from "lucide-react";
import Link from "next/link";
import { StatusDonut } from "@/components/charts/status-donut";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { DRIVER_STATUS, EXPIRY_STATUS, TRIP_STATUS, VEHICLE_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { monitoringService } from "@/services/resources";

function percent(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)}%` : "—";
}

export function MonitoringView() {
  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery({ queryKey: ["monitoring"], queryFn: monitoringService.get, refetchInterval: 60_000 });
  const m = data?.data;

  if (isLoading) return <LoadingState />;
  if (error || !m) return <ErrorState message={error?.message} onRetry={() => refetch()} />;

  const u = m.utilization;
  const expiring = [
    ...m.expiring_vehicle_documents.map((d) => ({ ...d, owner: d.vehicle?.plate_number ?? "", href: `/fleet/documents?owner=vehicle&id=${d.vehicle_id}` })),
    ...m.expiring_driver_documents.map((d) => ({ ...d, owner: d.driver?.full_name ?? "", href: `/fleet/documents?owner=driver&id=${d.driver_id}` })),
  ].sort((a, b) => (a.expires_at ?? "").localeCompare(b.expires_at ?? ""));

  return (
    <>
      <PageHeader title="Fleet Monitoring" description={`Fleet status, availability and active assignments · updated ${formatDateTime(new Date(dataUpdatedAt))}`} />

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Vehicles Available" value={`${u.vehicles_available} / ${u.vehicles_total}`} icon={Truck} tone="green" hint={`${percent(u.vehicles_available, u.vehicles_total)} of fleet`} />
        <StatCard label="Vehicles On Trip" value={u.vehicles_on_trip} icon={Gauge} tone="blue" hint={`${percent(u.vehicles_on_trip, u.vehicles_total)} utilization`} />
        <StatCard label="Drivers Available" value={`${u.drivers_available} / ${u.drivers_total}`} icon={Users} tone="green" />
        <StatCard label="Active Assignments" value={m.active_assignments.length} icon={Route} tone="amber" hint="Dispatched or in progress" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Vehicle Status" icon={<Truck />} />
          <CardBody>
            <StatusDonut data={m.vehicle_status} map={VEHICLE_STATUS} centerLabel="Vehicles" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Driver Status" icon={<Users />} />
          <CardBody>
            <StatusDonut data={m.driver_status} map={DRIVER_STATUS} centerLabel="Drivers" />
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Active Vehicle / Driver Assignments" icon={<Route />} action={<Link href="/transportation/dispatch" className="text-sm font-medium text-brand-600">Dispatch board</Link>} />
        <DataTable
          rows={m.active_assignments}
          rowKey={(t) => t.id}
          empty={{ title: "No active assignments", description: "Dispatched and in-progress trips appear here." }}
          columns={[
            { key: "trip", header: "Trip", cell: (t) => <Link href={`/transportation/itinerary/${t.id}`} className="font-medium text-ink-900 hover:text-brand-600">{t.trip_number}</Link> },
            { key: "vehicle", header: "Vehicle", cell: (t) => t.vehicle?.plate_number },
            { key: "driver", header: "Driver", cell: (t) => t.driver?.full_name },
            { key: "route", header: "Route", cell: (t) => `${t.origin} → ${t.destination}` },
            { key: "dep", header: "Departure", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.actual_departure_at ?? t.departure_at)}</span> },
            { key: "eta", header: "ETA", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.estimated_arrival_at)}</span> },
            { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
          ]}
        />
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Fleet Overview" icon={<Truck />} />
          <DataTable
            rows={m.vehicles}
            rowKey={(v) => v.id}
            className="max-h-[28rem] overflow-y-auto"
            columns={[
              { key: "plate", header: "Vehicle", cell: (v) => <Link href={`/fleet/vehicles/${v.id}`} className="font-medium text-ink-900 hover:text-brand-600">{v.plate_number}</Link> },
              { key: "type", header: "Type", cell: (v) => labelOf(VEHICLE_TYPES, v.vehicle_type) },
              { key: "driver", header: "Regular Driver", cell: (v) => v.assigned_driver?.full_name ?? "—" },
              { key: "trip", header: "Current Trip", cell: (v) => v.active_trip?.trip_number ?? "—" },
              { key: "status", header: "Status", cell: (v) => <StatusBadge status={v.status} map={VEHICLE_STATUS} /> },
            ]}
          />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Upcoming Trips" icon={<CalendarClock />} />
            <DataTable
              rows={m.upcoming_trips}
              rowKey={(t) => t.id}
              empty={{ title: "Nothing scheduled", description: "Scheduled trips from today onwards." }}
              columns={[
                { key: "trip", header: "Trip", cell: (t) => t.trip_number },
                { key: "dep", header: "Departure", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.departure_at)}</span> },
                { key: "res", header: "Vehicle / Driver", cell: (t) => `${t.vehicle?.plate_number ?? ""} · ${t.driver?.full_name ?? ""}` },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Compliance Alerts" icon={<AlertTriangle />} description="Documents and licenses expired or expiring within 30 days" />
            <ul className="divide-y divide-ink-100">
              {m.expiring_licenses.map((d) => (
                <li key={`lic-${d.id}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <IdCard className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="flex-1">
                    <Link href={`/fleet/drivers?driver=${d.id}`} className="font-medium text-ink-900 hover:text-brand-600">{d.full_name}</Link>
                    <span className="text-ink-500"> · driver&apos;s license</span>
                  </span>
                  <span className="text-xs text-ink-500">{formatDate(d.license_expiry)}</span>
                  <StatusBadge status={d.license_expired ? "expired" : "expiring_soon"} map={EXPIRY_STATUS} />
                </li>
              ))}
              {expiring.map((d) => (
                <li key={`${d.owner_type}-${d.id}`} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <FileWarning className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1">
                    <Link href={d.href} className="font-medium text-ink-900 hover:text-brand-600">{d.owner}</Link>
                    <span className="text-ink-500"> · {d.title}</span>
                  </span>
                  <span className="text-xs whitespace-nowrap text-ink-500">{formatDate(d.expires_at)}</span>
                  <StatusBadge status={d.expiry_status} map={EXPIRY_STATUS} />
                </li>
              ))}
              {m.expiring_licenses.length + expiring.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-500">No upcoming expirations.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
