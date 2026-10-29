"use client";

import { useQuery } from "@tanstack/react-query";
import { differenceInYears } from "date-fns";
import { Ban, CheckCircle2, Clock, IdCard, Pencil, PhoneCall, Truck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { DRIVER_STATUS, LICENSE_TYPES, TRIP_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { api } from "@/services/api-client";
import { driversService } from "@/services/resources";
import type { Driver, Trip } from "@/types/api";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-0.5 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="min-w-0 break-words text-ink-900">{value || "—"}</span>
    </div>
  );
}

function Section({ title, icon, action, children }: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-ink-500">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function TripsTable({ trips }: { trips: Trip[] }) {
  if (!trips.length) return <p className="text-sm text-ink-500">No trips yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-xs text-ink-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Date</th>
            <th className="py-2 pr-3 font-medium">Trip No.</th>
            <th className="py-2 pr-3 font-medium">Route</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {trips.map((t) => (
            <tr key={t.id}>
              <td className="py-2 pr-3 whitespace-nowrap">{formatDate(t.departure_at)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">
                <Link href={`/transportation/itinerary/${t.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                  {t.trip_number}
                </Link>
              </td>
              <td className="py-2 pr-3">
                {t.origin} → {t.destination}
              </td>
              <td className="py-2">
                <StatusBadge status={t.status} map={TRIP_STATUS} dot={false} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Driver detail side panel, as in the Driver Management reference. */
export function DriverPanel({ id, onClose, onEdit, canEdit }: { id: number; onClose: () => void; onEdit: (d: Driver) => void; canEdit: boolean }) {
  const [tab, setTab] = useState<"overview" | "trips">("overview");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["driver", id],
    queryFn: () => driversService.detail(id),
  });
  const d = data?.data;
  const performance = data?.performance;

  if (isLoading)
    return (
      <Card>
        <LoadingState />
      </Card>
    );
  if (error || !d)
    return (
      <Card>
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      </Card>
    );

  const vehicle = d.assigned_vehicle;
  const vehiclePhoto = vehicle?.cover_photo ?? vehicle?.photos?.[0]?.path;
  const trips = d.recent_trips ?? [];

  return (
    <Card className="@container h-fit overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-semibold text-ink-900">{d.full_name}</h2>
          <StatusBadge status={d.status} map={DRIVER_STATUS} dot={false} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => onEdit(d)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Driver
            </Button>
          )}
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100" aria-label="Close driver details">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 @sm:flex-row">
        <Avatar name={d.full_name} src={d.photo ? `${api.url(d.photo)}?v=${d.updated_at}` : null} size="lg" className="h-24 w-24 shrink-0 rounded-2xl text-3xl" />
        <div className="min-w-0 flex-1">
          <Row label="Driver ID" value={d.employee_code} />
          <Row label="Contact No." value={d.phone} />
          <Row label="Email" value={d.email} />
          <Row label="Address" value={d.address} />
          <Row label="Date of Birth" value={d.date_of_birth && `${formatDate(d.date_of_birth)} (${differenceInYears(new Date(), new Date(d.date_of_birth))} yrs)`} />
          <Row label="Date Hired" value={formatDate(d.date_hired)} />
        </div>
      </div>

      <Tabs
        className="px-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "trips", label: "Trips", count: d.trips_count },
        ]}
      />

      {tab === "overview" ? (
        <div className="space-y-5 px-5 py-4">
          <div className="grid gap-5 @lg:grid-cols-2">
            <Section title="License Information" icon={<IdCard />}>
              <Row label="License No." value={d.license_number} />
              <Row label="License Type" value={labelOf(LICENSE_TYPES, d.license_type)} />
              <Row
                label="Expiry Date"
                value={
                  <span className={d.license_expired ? "font-medium text-brand-700" : undefined}>
                    {formatDate(d.license_expiry)}
                    {d.license_expired && " (expired)"}
                  </span>
                }
              />
              <Row label="Restrictions" value={d.license_restrictions} />
            </Section>
            <Section title="Assigned Vehicle" icon={<Truck />}>
              {vehicle ? (
                <Link href={`/fleet/vehicles/${vehicle.id}`} className="flex gap-3 rounded-lg border border-ink-100 p-2.5 hover:border-ink-200">
                  <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink-50">
                    {vehiclePhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- served by the API
                      <img src={api.url(vehiclePhoto)} alt={vehicle.plate_number} className="h-full w-full object-cover" />
                    ) : (
                      <Truck className="h-6 w-6 text-ink-300" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink-900">{vehicle.plate_number}</span>
                    <span className="block truncate text-sm text-ink-600">
                      {vehicle.make} {vehicle.model}
                    </span>
                    <span className="text-xs text-ink-500">{labelOf(VEHICLE_TYPES, vehicle.vehicle_type)}</span>
                  </span>
                </Link>
              ) : (
                <p className="text-sm text-ink-500">No assigned vehicle.</p>
              )}
            </Section>
          </div>

          {(d.emergency_contact_name || d.emergency_contact_phone) && (
            <Section title="Emergency Contact" icon={<PhoneCall />}>
              <Row label="Name" value={d.emergency_contact_name} />
              <Row label="Contact No." value={d.emergency_contact_phone} />
              <Row label="Relationship" value={d.emergency_contact_relation} />
            </Section>
          )}

          <Section title="Performance (Last 30 Days)">
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  icon: CheckCircle2,
                  tone: "text-emerald-600",
                  value: performance?.completed_trips ?? 0,
                  label: "Completed trips",
                },
                {
                  icon: Clock,
                  tone: "text-sky-600",
                  value: performance?.on_time_rate != null ? `${performance.on_time_rate}%` : "—",
                  label: "On-time arrival",
                },
                {
                  icon: Ban,
                  tone: "text-brand-600",
                  value: performance?.cancelled_trips ?? 0,
                  label: "Cancelled trips",
                },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-ink-50 p-3">
                  <m.icon className={cn("mb-1 h-5 w-5", m.tone)} />
                  <p className="text-xl font-bold text-ink-900">{m.value}</p>
                  <p className="text-xs text-ink-500">{m.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-400">From trip records. Ratings and incidents aren&apos;t tracked.</p>
          </Section>

          <Section
            title="Recent Trips"
            action={
              trips.length > 3 && (
                <button onClick={() => setTab("trips")} className="text-xs font-medium text-brand-600 hover:underline">
                  View all
                </button>
              )
            }
          >
            <TripsTable trips={trips.slice(0, 3)} />
          </Section>
        </div>
      ) : (
        <div className="px-5 py-4">
          <TripsTable trips={trips} />
          {(d.trips_count ?? 0) > trips.length && (
            <p className="mt-2 text-xs text-ink-500">
              Showing the latest {trips.length} of {d.trips_count} trips.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
