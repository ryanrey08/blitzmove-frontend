"use client";

import { Activity, CalendarClock, Clock, Flag, Gauge, MapPin, MessageSquare, Route, Truck, User, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DRIVER_STATUS, FUEL_TYPES, LICENSE_TYPES, TRIP_STATUS, VEHICLE_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { api } from "@/services/api-client";
import type { Vehicle } from "@/types/api";
import { LIVE_STATUS, driverOf, isFresh, locationText, remaining, type LiveStatus } from "./status";

type Tab = "live" | "details" | "trip" | "driver";
const TABS: { value: Tab; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "details", label: "Details" },
  { value: "trip", label: "Trip" },
  { value: "driver", label: "Driver" },
];

interface VehicleDetailCardProps {
  vehicle: Vehicle | undefined;
  status: LiveStatus | undefined;
  place?: string;
  now: number;
  onClose: () => void;
  onViewOnMap: () => void;
  mapAvailable: boolean;
}

export function VehicleDetailCard({ vehicle: v, status, place, now, onClose, onViewOnMap, mapAvailable }: VehicleDetailCardProps) {
  const [tab, setTab] = useState<Tab>("live");

  if (!v || !status) {
    return (
      <Card className="flex min-h-[390px] flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
          <Truck className="h-7 w-7" />
        </span>
        <p className="font-semibold text-ink-900">No vehicle selected</p>
        <p className="max-w-60 text-sm text-ink-500">Select a vehicle on the map or in the tracking list to see its live status.</p>
      </Card>
    );
  }

  const s = LIVE_STATUS[status];
  const loc = v.latest_location;
  const trip = v.active_trip;
  const driver = driverOf(v);
  const fresh = isFresh(v, now);
  const left = trip ? remaining(trip.estimated_arrival_at, now) : null;

  return (
    <Card className="flex min-h-[390px] flex-col">
      <div className="flex gap-3 px-5 pt-5">
        {v.cover_photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
          <img src={api.url(v.cover_photo)} alt={v.plate_number} className="h-14 w-20 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-400">
            <Truck className="h-7 w-7" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="truncate text-lg leading-tight font-bold text-ink-900">{v.plate_number}</p>
            <Badge tone={s.tone} dot>
              {s.label}
            </Badge>
            <button type="button" onClick={onClose} className="-mt-1 -mr-1 ml-auto rounded p-1 text-ink-500 hover:bg-ink-100" aria-label="Close vehicle details">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-500">
            {v.make} {v.model} ({labelOf(VEHICLE_TYPES, v.vehicle_type)})
          </p>
        </div>
      </div>

      <div role="tablist" className="mt-4 flex gap-1 border-b border-ink-100 px-5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn("-mb-px flex-1 border-b-2 px-2 py-2.5 text-sm font-medium", tab === t.value ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-800")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <dl className="grid flex-1 grid-cols-[auto_minmax(0,1fr)] content-start gap-x-4 gap-y-3 px-5 py-4 text-sm">
        {tab === "live" && (
          <>
            <Row icon={User} label="Driver">
              {driver ? (
                <Link href={`/fleet/drivers/${driver.id}`} className="flex items-center gap-2 hover:text-brand-600">
                  <Avatar name={driver.full_name} src={driver.photo ? api.url(driver.photo) : null} size="sm" className="h-6 w-6 text-[10px]" />
                  <span className="truncate">{driver.full_name}</span>
                </Link>
              ) : null}
            </Row>
            <Row icon={MapPin} label="Current Location">
              {locationText(v, place)}
            </Row>
            <Row icon={Flag} label="Destination">
              {trip?.destination}
            </Row>
            <Row icon={Gauge} label="Speed">
              {fresh && loc?.speed_kph != null ? `${formatNumber(loc.speed_kph)} km/h` : null}
            </Row>
            <Row icon={Activity} label="Odometer">
              {v.odometer_km != null ? `${formatNumber(v.odometer_km)} km` : null}
            </Row>
            <Row icon={Route} label="Trip Status">
              {trip ? <StatusBadge status={trip.status} map={TRIP_STATUS} /> : null}
            </Row>
            <Row icon={Clock} label="ETA">
              {trip ? (
                <>
                  {formatTime(trip.estimated_arrival_at)} <span className="text-ink-500">({left ? `${left} left` : "overdue"})</span>
                </>
              ) : null}
            </Row>
            <Row icon={CalendarClock} label="Last Update">
              {loc ? formatDateTime(loc.recorded_at) : null}
            </Row>
          </>
        )}
        {tab === "details" && (
          <>
            <Row label="Plate Number">{v.plate_number}</Row>
            <Row label="Type">{labelOf(VEHICLE_TYPES, v.vehicle_type)}</Row>
            <Row label="Make / Model">{[v.make, v.model, v.year].filter(Boolean).join(" ")}</Row>
            <Row label="Capacity">{v.capacity_kg != null ? `${formatNumber(v.capacity_kg)} kg` : null}</Row>
            <Row label="Fuel Type">{labelOf(FUEL_TYPES, v.fuel_type)}</Row>
            <Row label="Vehicle Status">
              <StatusBadge status={v.status} map={VEHICLE_STATUS} />
            </Row>
            <Row label="Home Depot">{v.home_depot}</Row>
            <Row label="GPS Device">{v.gps_device_id}</Row>
            <Row label="Profile">
              <Link href={`/fleet/vehicles/${v.id}`} className="font-medium text-brand-600 hover:underline">
                Open vehicle profile
              </Link>
            </Row>
          </>
        )}
        {tab === "trip" &&
          (trip ? (
            <>
              <Row label="Trip">
                <Link href={`/transportation/itinerary/${trip.id}`} className="font-medium text-brand-600 hover:underline">
                  {trip.trip_number}
                </Link>
              </Row>
              <Row label="Status">
                <StatusBadge status={trip.status} map={TRIP_STATUS} />
              </Row>
              <Row label="Origin">{trip.origin}</Row>
              <Row label="Destination">{trip.destination}</Row>
              <Row label="Departure">{formatDateTime(trip.actual_departure_at ?? trip.departure_at)}</Row>
              <Row label="ETA">{formatDateTime(trip.estimated_arrival_at)}</Row>
              <Row label="Distance">{trip.distance_km != null ? `${formatNumber(trip.distance_km, 1)} km` : null}</Row>
              <Row label="Stops">{trip.stops_count}</Row>
            </>
          ) : (
            <p className="col-span-2 text-ink-500">No dispatched or in-progress trip for this vehicle.</p>
          ))}
        {tab === "driver" &&
          (driver ? (
            <>
              <Row label="Name">
                <Link href={`/fleet/drivers/${driver.id}`} className="font-medium text-brand-600 hover:underline">
                  {driver.full_name}
                </Link>
              </Row>
              <Row label="Employee Code">{driver.employee_code}</Row>
              <Row label="Phone">{driver.phone}</Row>
              <Row label="Status">
                <StatusBadge status={driver.status} map={DRIVER_STATUS} />
              </Row>
              <Row label="License">{[driver.license_number, labelOf(LICENSE_TYPES, driver.license_type)].filter(Boolean).join(" · ")}</Row>
              <Row label="License Expiry">{formatDate(driver.license_expiry)}</Row>
            </>
          ) : (
            <p className="col-span-2 text-ink-500">No driver assigned to this vehicle.</p>
          ))}
      </dl>

      <div className="grid grid-cols-2 gap-2 border-t border-ink-100 p-4">
        <button
          type="button"
          onClick={onViewOnMap}
          disabled={!loc || !mapAvailable}
          title={loc ? undefined : "No GPS position reported"}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-2 py-2 text-sm font-semibold whitespace-nowrap text-ink-800 hover:bg-ink-50 disabled:opacity-40"
        >
          <MapPin className="h-4 w-4 text-brand-600" /> View on Map
        </button>
        {driver?.phone ? (
          <a href={`sms:${driver.phone.replace(/[^\d+]/g, "")}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-2 py-2 text-sm font-semibold whitespace-nowrap text-ink-800 hover:bg-ink-50">
            <MessageSquare className="h-4 w-4 text-sky-600" /> Message Driver
          </a>
        ) : (
          <button type="button" disabled title="No driver phone number on file" className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-2 py-2 text-sm font-semibold whitespace-nowrap text-ink-800 opacity-40">
            <MessageSquare className="h-4 w-4 text-sky-600" /> Message Driver
          </button>
        )}
      </div>
    </Card>
  );
}

function Row({ icon: Icon, label, children }: { icon?: LucideIcon; label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <>
      <dt className="flex items-center gap-2 whitespace-nowrap text-ink-500">
        {Icon && <Icon className="h-4 w-4 text-ink-400" />}
        {label}
      </dt>
      <dd className="min-w-0 truncate font-medium text-ink-900">{empty ? <span className="text-ink-400">—</span> : children}</dd>
    </>
  );
}
