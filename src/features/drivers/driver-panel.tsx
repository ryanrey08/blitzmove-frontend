"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, IdCard, Pencil, Route, Truck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { DRIVER_STATUS, LICENSE_TYPES, TRIP_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { driversService } from "@/services/resources";
import type { Driver } from "@/types/api";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-0.5 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-900">{value || "—"}</span>
    </div>
  );
}

/** Driver detail side panel, as in the Driver Management reference. */
export function DriverPanel({ id, onClose, onEdit, canEdit }: { id: number; onClose: () => void; onEdit: (d: Driver) => void; canEdit: boolean }) {
  const [tab, setTab] = useState<"overview" | "trips">("overview");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["driver", id], queryFn: () => driversService.get(id) });
  const d = data?.data;

  return (
    <Card className="overflow-hidden">
      {isLoading ? (
        <LoadingState />
      ) : error || !d ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-ink-900">{d.full_name}</h2>
              <StatusBadge status={d.status} map={DRIVER_STATUS} />
            </div>
            <div className="flex items-center gap-1">
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

          <div className="flex gap-4 px-5 py-4">
            <Avatar name={d.full_name} size="lg" className="rounded-2xl" />
            <div className="min-w-0 flex-1">
              <Row label="Driver ID" value={d.employee_code} />
              <Row label="Contact No." value={d.phone} />
              <Row label="Email" value={d.email} />
              <Row label="Address" value={d.address} />
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
              <div className="grid gap-5 sm:grid-cols-2">
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <IdCard className="h-4 w-4" /> License Information
                  </h3>
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
                </section>
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <Truck className="h-4 w-4" /> Assigned Vehicle
                  </h3>
                  {d.assigned_vehicle ? (
                    <Link href={`/fleet/vehicles/${d.assigned_vehicle.id}`} className="block rounded-lg border border-ink-100 p-3 hover:border-ink-200">
                      <p className="font-semibold text-ink-900">{d.assigned_vehicle.plate_number}</p>
                      <p className="text-sm text-ink-600">
                        {d.assigned_vehicle.make} {d.assigned_vehicle.model}
                      </p>
                      <p className="text-xs text-ink-500">{labelOf(VEHICLE_TYPES, d.assigned_vehicle.vehicle_type)}</p>
                    </Link>
                  ) : (
                    <p className="text-sm text-ink-500">No regular vehicle.</p>
                  )}
                </section>
              </div>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-ink-900">Activity</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-ink-50 p-3">
                    <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-600" />
                    <p className="text-xl font-bold text-ink-900">{d.completed_trips_count ?? 0}</p>
                    <p className="text-xs text-ink-500">Completed trips</p>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-3">
                    <Route className="mb-1 h-5 w-5 text-sky-600" />
                    <p className="text-xl font-bold text-ink-900">{d.trips_count ?? 0}</p>
                    <p className="text-xs text-ink-500">Total trips</p>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-3">
                    <AlertTriangle className="mb-1 h-5 w-5 text-amber-600" />
                    <p className="text-xl font-bold text-ink-900">{d.documents_count ?? 0}</p>
                    <p className="text-xs text-ink-500">
                      <Link href={`/fleet/documents?owner=driver&id=${d.id}`} className="hover:underline">
                        Documents
                      </Link>
                    </p>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="overflow-x-auto px-5 py-4">
              {d.recent_trips?.length ? (
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs text-ink-500">
                    <tr>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Trip No.</th>
                      <th className="py-2 pr-3">Route</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {d.recent_trips.map((t) => (
                      <tr key={t.id}>
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(t.departure_at)}</td>
                        <td className="py-2 pr-3">
                          <Link href={`/transportation/itinerary/${t.id}`} className="font-medium hover:text-brand-600">
                            {t.trip_number}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {t.origin} → {t.destination}
                        </td>
                        <td className="py-2">
                          <StatusBadge status={t.status} map={TRIP_STATUS} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-ink-500">No trips yet.</p>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
