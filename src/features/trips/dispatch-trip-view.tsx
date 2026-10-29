"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  Info,
  Map as MapIcon,
  MapPin,
  Package,
  Pencil,
  Phone,
  Printer,
  Route,
  Send,
  ShieldCheck,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { DRIVER_STATUS, FUEL_TYPES, LICENSE_TYPES, STOP_TYPE, TRIP_PRIORITY, TRIP_TYPES, VEHICLE_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatNumber, formatTime, fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";
import { tripsService } from "@/services/resources";
import type { Trip } from "@/types/api";
import { checklist } from "./dispatch-view";
import { RouteMap, useRoutePreview, useRoutingStatus } from "./route-map";
import { TRIPS_PATH } from "./trip-schedule-view";
import { TRIP_KEYS, useTrip } from "./use-trip";

const DISPATCH_PATH = "/transportation/dispatch";
const MESSAGE_LIMIT = 500;

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} hr${h > 1 ? "s" : ""}${m ? ` ${m} min${m > 1 ? "s" : ""}` : ""}` : `${m} mins`;
}

function routeLabel(trip: Trip) {
  const names = (trip.stops ?? []).map((s) => s.location_name);
  return (names.length ? names : [trip.origin, trip.destination]).join(" → ");
}

function defaultMessage(trip: Trip, durationMinutes: number | null) {
  const first = trip.driver?.full_name.split(" ")[0] ?? "";
  return [
    `Good day ${first},`,
    `Please see your trip ${trip.trip_number} for ${formatDate(trip.departure_at, "MMM d, yyyy")}, departing ${formatTime(trip.departure_at)}.`,
    `Route: ${routeLabel(trip)}`,
    `Total Stops: ${trip.stops?.length ?? 0}${durationMinutes ? ` | Estimated Duration: ${formatDuration(durationMinutes)}` : ""}`,
    "Please follow the itinerary and ensure all deliveries are completed. Thank you.",
    "- BlitzMove Logistics Operations",
  ]
    .join("\n")
    .slice(0, MESSAGE_LIMIT);
}

/** `/transportation/dispatch/create`: pick a scheduled trip, review it, and release it to the driver. */
export function DispatchTripView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canOperate } = usePermissions();
  const tripId = Number(searchParams.get("trip")) || null;

  const eligible = useQuery({
    queryKey: ["trips", "dispatchable"],
    queryFn: () => tripsService.list({ status: "scheduled", sort: "departure_at", per_page: 100 }),
  });
  const selected = useTrip(tripId);
  const trip = selected.data?.data;

  const select = (id: string) => router.replace(id ? `${DISPATCH_PATH}/create?trip=${id}` : `${DISPATCH_PATH}/create`, { scroll: false });

  if (!canOperate) return <ErrorState message="You do not have permission to dispatch trips." />;

  // A trip already dispatched (e.g. by someone else) stays visible but can't be sent again.
  const options = (eligible.data?.data ?? []).map((t) => ({ value: String(t.id), label: `${t.trip_number} · ${t.origin} → ${t.destination} · ${formatDateTime(t.departure_at)}` }));
  if (trip && !options.some((o) => o.value === String(trip.id))) options.unshift({ value: String(trip.id), label: `${trip.trip_number} · ${trip.origin} → ${trip.destination}` });

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Dispatch Trip</h1>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Dispatch the trip to the assigned driver and vehicle.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-500">
            <Link href={DISPATCH_PATH} className="hover:text-ink-900">
              Dispatch Management
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-ink-900">Dispatch Trip</span>
          </nav>
          <div className="flex gap-2 sm:ml-4">
            <Button variant="secondary" size="lg" onClick={() => router.push(DISPATCH_PATH)}>
              Cancel
            </Button>
            <Button size="lg" form="dispatch-form" type="submit" disabled={!trip || trip.status !== "scheduled"} className="min-w-44">
              <Send className="h-4 w-4" /> Dispatch Trip
            </Button>
          </div>
        </div>
      </div>

      <Card className="mb-5">
        <CardBody className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
          <Field label="Trip Schedule" htmlFor="trip-select" required className="flex-1" hint={eligible.data ? `${eligible.data.meta.total} scheduled trip${eligible.data.meta.total === 1 ? "" : "s"} ready to dispatch` : undefined}>
            <Select id="trip-select" value={tripId ? String(tripId) : ""} onChange={(e) => select(e.target.value)} options={options} placeholder={eligible.isLoading ? "Loading trips…" : "Select a scheduled trip"} disabled={eligible.isLoading} />
          </Field>
          {trip && (
            <Link href={`${TRIPS_PATH}/${trip.id}`} className="text-sm font-medium text-brand-600 hover:underline sm:pb-8">
              View trip
            </Link>
          )}
        </CardBody>
      </Card>

      {eligible.error ? (
        <ErrorState message={eligible.error.message} onRetry={() => eligible.refetch()} />
      ) : !tripId ? (
        <Card>
          <EmptyState
            title={eligible.data && eligible.data.meta.total === 0 ? "No trips waiting for dispatch" : "Select a trip to dispatch"}
            description={eligible.data && eligible.data.meta.total === 0 ? "Schedule a trip in Trip Scheduling first." : "Only scheduled trips can be dispatched. Their details, stops and assignment appear here for review."}
            icon={<Send className="h-6 w-6" />}
            action={
              eligible.data && eligible.data.meta.total === 0 ? (
                <Button size="sm" onClick={() => router.push(`${TRIPS_PATH}/create`)}>
                  Add New Trip
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : selected.isLoading ? (
        <LoadingState label="Loading trip…" />
      ) : selected.error || !trip ? (
        <ErrorState message={selected.error?.message ?? "Trip not found."} onRetry={() => selected.refetch()} />
      ) : (
        <DispatchForm key={trip.id} trip={trip} />
      )}
    </>
  );
}

function DispatchForm({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { configured } = useRoutingStatus();
  const preview = useRoutePreview(
    (trip.stops ?? []).map((s) => ({ label: s.location_name, query: s.address || s.location_name })),
    configured,
  );
  const route = preview.data;
  const routeOk = !!route && route.unresolved.length === 0;

  const stops = useMemo(() => trip.stops ?? [], [trip.stops]);
  const orders = useMemo(() => {
    const map = new Map<number, NonNullable<Trip["order"]>>();
    if (trip.order) map.set(trip.order.id, trip.order);
    stops.forEach((s) => s.order && map.set(s.order.id, s.order));
    return [...map.values()];
  }, [trip.order, stops]);
  const totalWeight = orders.some((o) => o.weight_kg) ? orders.reduce((sum, o) => sum + (o.weight_kg ?? 0), 0) : null;
  const scheduleMinutes = Math.round((new Date(trip.estimated_arrival_at).getTime() - new Date(trip.departure_at).getTime()) / 60000);
  const durationMinutes = (routeOk ? route.duration_minutes : null) ?? scheduleMinutes;
  const distanceKm = trip.distance_km ?? (routeOk ? route.distance_km : null);
  const customers = [...new Set(orders.map((o) => o.customer_name))];

  // ----- Form state ----------------------------------------------------------
  const [message, setMessage] = useState(() => trip.dispatch_notes ?? defaultMessage(trip, scheduleMinutes));
  const [dispatchedAt, setDispatchedAt] = useState(() => toDateTimeLocal(new Date()));
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [vehicleId, setVehicleId] = useState(String(trip.vehicle_id));
  const [driverId, setDriverId] = useState(String(trip.driver_id));
  const [confirming, setConfirming] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("details");

  // Refresh the message once the routed drive time is known, unless it was edited.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && !trip.dispatch_notes && routeOk && route.duration_minutes) setMessage(defaultMessage(trip, route.duration_minutes));
  }, [routeOk]); // eslint-disable-line react-hooks/exhaustive-deps

  const availability = useQuery({
    queryKey: ["trips", "availability", trip.id],
    queryFn: () => tripsService.availability(trip.departure_at, trip.estimated_arrival_at, trip.id),
    enabled: editingAssignment,
  });
  const vehicles = availability.data?.data.vehicles ?? (trip.vehicle ? [trip.vehicle] : []);
  const drivers = availability.data?.data.drivers ?? (trip.driver ? [trip.driver] : []);
  const vehicle = vehicles.find((v) => String(v.id) === vehicleId) ?? trip.vehicle;
  const driver = drivers.find((d) => String(d.id) === driverId) ?? trip.driver;
  const reassigned = vehicleId !== String(trip.vehicle_id) || driverId !== String(trip.driver_id);

  const checks = checklist({ ...trip, vehicle, driver });
  const blocking = checks.filter((c) => !c.ok && !c.optional);
  const dispatchable = trip.status === "scheduled";

  const dispatch = useApiMutation(
    () =>
      tripsService.dispatch(trip.id, {
        notes: message.trim() || null,
        dispatched_at: dispatchedAt ? fromDateTimeLocal(dispatchedAt) : null,
        ...(reassigned ? { vehicle_id: Number(vehicleId), driver_id: Number(driverId) } : {}),
      }),
    {
      invalidate: TRIP_KEYS,
      successMessage: `Trip ${trip.trip_number} dispatched to ${driver?.full_name ?? "the driver"}.`,
      onSuccess: () => router.push(`${DISPATCH_PATH}?trip=${trip.id}`),
    },
  );

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!dispatchedAt) errors.dispatched_at = "Dispatch date and time is required.";
    else if (new Date(dispatchedAt).getTime() > Date.now() + 5 * 60_000) errors.dispatched_at = "The dispatch time cannot be in the future.";
    if (!vehicleId) errors.vehicle_id = "Select a vehicle.";
    if (!driverId) errors.driver_id = "Select a driver.";
    if (message.length > MESSAGE_LIMIT) errors.notes = `Keep the message under ${MESSAGE_LIMIT} characters.`;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!dispatchable) return setFormError(`This trip is ${trip.status.replace("_", " ")} and can't be dispatched again.`);
    if (blocking.length) return setFormError("Resolve the pre-dispatch checks before dispatching.");
    if (validate()) setConfirming(true);
  };

  const confirm = async () => {
    try {
      await dispatch.mutateAsync(undefined);
    } catch (error) {
      const api = error as { errors?: Record<string, string[]>; message?: string };
      setFieldErrors(Object.fromEntries(Object.entries(api.errors ?? {}).map(([k, v]) => [k, v[0]])));
      setFormError(api.message ?? "The trip could not be dispatched.");
      setConfirming(false);
    }
  };

  const scrollTo = (id: string) => {
    setTab(id);
    document.getElementById(`dispatch-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <form id="dispatch-form" onSubmit={submit} noValidate>
      {/* Summary strip */}
      <Card className="mb-5">
        <dl className="grid grid-cols-2 divide-ink-100 sm:grid-cols-4 xl:grid-cols-[auto_auto_minmax(0,2fr)_repeat(4,auto)] xl:divide-x">
          <Summary icon={<CalendarDays />} label="Trip No." value={trip.trip_number} />
          <Summary icon={<CalendarDays />} label="Date" value={formatDate(trip.departure_at)} sub={formatDate(trip.departure_at, "EEEE")} />
          <Summary icon={<Route />} label="Route" value={<span className="line-clamp-2 text-sm font-medium whitespace-normal">{routeLabel(trip)}</span>} className="col-span-2 sm:col-span-2 xl:col-span-1" />
          <Summary icon={<MapPin />} label="Total Stops" value={stops.length} />
          <Summary icon={<Package />} label="Total Orders" value={orders.length} />
          <Summary icon={<Route />} label="Total Distance" value={distanceKm != null ? `${formatNumber(distanceKm, distanceKm % 1 ? 1 : 0)} km` : "—"} />
          <Summary icon={<Clock />} label="Estimated Duration" value={durationMinutes > 0 ? formatDuration(durationMinutes) : "—"} />
        </dl>
      </Card>

      {formError && (
        <div className="mb-5">
          <FormError message={formError} />
        </div>
      )}
      {!dispatchable && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {trip.trip_number} is already <strong>{trip.status.replace("_", " ")}</strong>
            {trip.dispatched_at ? ` (dispatched ${formatDateTime(trip.dispatched_at)}${trip.dispatched_by ? ` by ${trip.dispatched_by.name}` : ""})` : ""}. It can&apos;t be dispatched again.
          </span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(380px,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Trip details with section tabs */}
          <Card id="dispatch-details" className="scroll-mt-24">
            <div className="flex overflow-x-auto border-b border-ink-100 px-3" role="tablist">
              {[
                ["details", "Trip Details"],
                ["stops", "Stops & Orders"],
                ["assignment", "Driver & Vehicle"],
                ["route", "Route & Itinerary"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => scrollTo(id)}
                  className={cn("-mb-px border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap", tab === id ? "border-brand-600 text-brand-600" : "border-transparent text-ink-600 hover:text-ink-900")}
                >
                  {label}
                </button>
              ))}
            </div>
            <CardBody className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:divide-x lg:divide-ink-100">
              <dl className="space-y-2 text-sm">
                <Row label="Trip No." value={trip.trip_number} />
                <Row label="Trip Type" value={labelOf(TRIP_TYPES, trip.trip_type)} />
                <Row label="Priority" value={TRIP_PRIORITY[trip.priority]?.label} />
                <Row label="Order Ref." value={trip.order ? <Link href={`/orders/${trip.order.id}`} className="text-brand-600 hover:underline">{trip.order.order_number}</Link> : "—"} />
                <Row label="Origin" value={trip.origin} />
                <Row label="Destination" value={trip.destination} />
                <Row label="Scheduled Departure" value={formatDate(trip.departure_at, "MMM d, yyyy h:mm a (EEEE)")} />
                <Row label="Est. Arrival" value={formatDateTime(trip.estimated_arrival_at)} />
                <Row label="Total Weight" value={totalWeight != null ? `${formatNumber(totalWeight)} kg` : "—"} />
                <Row label="Total Volume" value={<span className="text-ink-400">Not tracked</span>} />
                <Row
                  label="Status"
                  value={
                    dispatchable ? (
                      <Badge tone="blue">For Dispatch</Badge>
                    ) : (
                      <Badge tone={trip.status === "dispatched" ? "orange" : "gray"}>{trip.status === "dispatched" ? "Dispatched" : trip.status.replace("_", " ")}</Badge>
                    )
                  }
                />
              </dl>
              <div className="space-y-5 text-sm lg:pl-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-ink-500">Customer</p>
                    <p className="mt-1 font-medium text-ink-900">{customers.length > 1 ? "Multiple (see stops)" : (customers[0] ?? "—")}</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => router.push(`${TRIPS_PATH}/${trip.id}/edit`)} disabled={!dispatchable}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
                <div>
                  <p className="text-ink-500">Created By</p>
                  <p className="mt-1 flex items-center gap-2 font-medium text-ink-900">
                    <UserRound className="h-4 w-4 text-ink-500" /> {trip.created_by?.name ?? "—"}
                  </p>
                  <p className="ml-6 text-xs text-ink-500">{formatDateTime(trip.created_at)}</p>
                </div>
                <div>
                  <p className="text-ink-500">Remarks</p>
                  <p className="mt-1 min-h-16 rounded-lg border border-ink-100 px-3 py-2 whitespace-pre-line text-ink-700">{trip.notes || <span className="text-ink-400">No remarks</span>}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Stops */}
          <Card id="dispatch-stops" className="scroll-mt-24">
            <CardHeader
              title={`Stops & Orders (${stops.length})`}
              icon={<MapPin />}
              action={
                <Button variant="secondary" size="sm" className="border-sky-300 text-sky-700 hover:bg-sky-50" onClick={() => router.push(`${TRIPS_PATH}/${trip.id}/edit#trip-stops`)} disabled={!dispatchable}>
                  <Pencil className="h-3.5 w-3.5" /> Edit Stops
                </Button>
              }
            />
            <div className="overflow-x-auto px-3 pb-3">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                  <tr>
                    <th className="px-3 py-2.5">#</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Customer / Location</th>
                    <th className="px-3 py-2.5">Address</th>
                    <th className="px-3 py-2.5">Order No.</th>
                    <th className="px-3 py-2.5">ETA</th>
                    <th className="px-3 py-2.5">Load Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {stops.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2.5 text-ink-700">{s.sequence}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={s.type} map={STOP_TYPE} dot={false} />
                      </td>
                      <td className="px-3 py-2.5 font-medium text-ink-900">{s.location_name}</td>
                      <td className="max-w-56 px-3 py-2.5 text-xs text-ink-600">{s.address ?? "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{s.order?.order_number ?? "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{s.estimated_arrival_at ? formatTime(s.estimated_arrival_at) : "—"}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-ink-600">
                        {s.order ? `${formatNumber(s.order.quantity)} pcs${s.order.weight_kg ? ` (${formatNumber(s.order.weight_kg)} kg)` : ""}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Driver & vehicle */}
          <Card id="dispatch-assignment" className="scroll-mt-24">
            <CardHeader
              title="Driver & Vehicle Assignment"
              icon={<Truck />}
              action={
                dispatchable && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (editingAssignment) {
                        setVehicleId(String(trip.vehicle_id));
                        setDriverId(String(trip.driver_id));
                      }
                      setEditingAssignment((v) => !v);
                    }}
                  >
                    {editingAssignment ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {editingAssignment ? "Keep current" : "Edit"}
                  </Button>
                )
              }
            />
            <CardBody className="grid gap-5 md:grid-cols-2">
              <div className="rounded-lg border border-ink-100 p-4">
                <p className="mb-3 text-sm font-semibold text-ink-900">Driver</p>
                {editingAssignment && (
                  <Field label="Driver" htmlFor="dispatch-driver" error={fieldErrors.driver_id} className="mb-3" hint={availability.isFetching ? "Checking availability…" : "Drivers free for this trip's window."}>
                    <Select id="dispatch-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)} options={drivers.map((d) => ({ value: String(d.id), label: d.full_name }))} />
                  </Field>
                )}
                {driver && (
                  <div className="flex gap-3">
                    <Avatar name={driver.full_name} size="lg" className="h-16 w-16 text-xl" />
                    <div className="min-w-0 space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink-900">{driver.full_name}</span>
                        <StatusBadge status={driver.status} map={DRIVER_STATUS} dot={false} />
                      </div>
                      <p className="text-ink-500">{labelOf(LICENSE_TYPES, driver.license_type)} Driver</p>
                      <p className="flex items-center gap-1.5 text-ink-700">
                        <Phone className="h-3.5 w-3.5 text-ink-400" /> {driver.phone}
                      </p>
                      <p className="flex items-center gap-1.5 text-ink-700">
                        <ShieldCheck className="h-3.5 w-3.5 text-ink-400" /> {driver.license_number} · exp. {formatDate(driver.license_expiry)}
                      </p>
                    </div>
                  </div>
                )}
                {fieldErrors.driver_id && !editingAssignment && <p className="mt-2 text-xs font-medium text-brand-700">{fieldErrors.driver_id}</p>}
              </div>
              <div className="rounded-lg border border-ink-100 p-4">
                <p className="mb-3 text-sm font-semibold text-ink-900">Vehicle</p>
                {editingAssignment && (
                  <Field label="Vehicle" htmlFor="dispatch-vehicle" error={fieldErrors.vehicle_id} className="mb-3" hint={availability.isFetching ? "Checking availability…" : "Vehicles free for this trip's window."}>
                    <Select id="dispatch-vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} options={vehicles.map((v) => ({ value: String(v.id), label: `${v.plate_number} (${v.make} ${v.model})` }))} />
                  </Field>
                )}
                {vehicle && (
                  <div className="flex gap-3">
                    <span className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg bg-ink-50">
                      <Truck className="h-9 w-9 text-ink-600" />
                    </span>
                    <div className="min-w-0 space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink-900">{vehicle.plate_number}</span>
                        <StatusBadge status={vehicle.status} map={VEHICLE_STATUS} dot={false} />
                      </div>
                      <p className="text-ink-700">
                        {vehicle.make} {vehicle.model}
                      </p>
                      <p className="text-ink-500">{labelOf(VEHICLE_TYPES, vehicle.vehicle_type)}</p>
                      <p className="text-ink-500">
                        {labelOf(FUEL_TYPES, vehicle.fuel_type)}
                        {vehicle.capacity_kg ? ` · ${formatNumber(vehicle.capacity_kg)} kg capacity` : ""}
                      </p>
                    </div>
                  </div>
                )}
                {fieldErrors.vehicle_id && !editingAssignment && <p className="mt-2 text-xs font-medium text-brand-700">{fieldErrors.vehicle_id}</p>}
              </div>
              {reassigned && (
                <p className="text-xs text-ink-500 md:col-span-2">The new assignment is saved together with the dispatch, and the change is recorded in the assignment history.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          {/* Route map */}
          <Card id="dispatch-route" className="scroll-mt-24">
            <CardHeader
              title="Route Map"
              icon={<MapIcon />}
              action={
                <Button variant="secondary" size="sm" className="border-sky-300 text-sky-700 hover:bg-sky-50" onClick={() => router.push(`/transportation/route-optimization?trip=${trip.id}`)}>
                  View Full Map
                </Button>
              }
            />
            <div className="p-3">
              <RouteMap
                configured={configured}
                image={route?.image}
                loading={preview.isFetching}
                error={preview.error?.message}
                unresolved={route?.unresolved}
                emptyHint="Add addresses to the stops to draw the route."
                className="min-h-72"
              />
              <div className="mt-2 flex flex-wrap gap-4 px-1 text-xs text-ink-600">
                <Legend color="bg-emerald-600" label="Start" />
                <Legend color="bg-sky-600" label="Stop" />
                <Legend color="bg-brand-600" label="Destination" />
              </div>
            </div>
          </Card>

          {/* Dispatch options */}
          <Card>
            <CardHeader title="Dispatch Options" icon={<Send />} />
            <CardBody className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-semibold text-ink-900">Send Via</p>
                <div className="space-y-1.5">
                  <Checkbox label="Send to Driver App (Push Notification)" checked={false} disabled />
                  <Checkbox label="Send via SMS (Trip Summary Link)" checked={false} disabled />
                  <Checkbox label="Send via Email (Trip Details)" checked={false} disabled />
                </div>
                <p className="mt-1.5 text-xs text-ink-500">No driver app, SMS or email service is configured yet. The message is saved on the trip as dispatch notes.</p>
              </div>
              <Field label="Dispatch Date & Time" htmlFor="dispatched_at" error={fieldErrors.dispatched_at} required>
                <Input id="dispatched_at" type="datetime-local" value={dispatchedAt} max={toDateTimeLocal(new Date())} onChange={(e) => setDispatchedAt(e.target.value)} invalid={!!fieldErrors.dispatched_at} disabled={!dispatchable} />
              </Field>
              <Field label="Message to Driver" htmlFor="dispatch-message" error={fieldErrors.notes}>
                <Textarea
                  id="dispatch-message"
                  rows={8}
                  value={message}
                  maxLength={MESSAGE_LIMIT}
                  onChange={(e) => {
                    setTouched(true);
                    setMessage(e.target.value);
                  }}
                  disabled={!dispatchable}
                />
                <p className="mt-1 text-right text-xs text-ink-500">
                  {message.length}/{MESSAGE_LIMIT}
                </p>
              </Field>

              <ul className="space-y-1.5 rounded-lg bg-ink-50 p-3 text-xs">
                {checks.map((check) => (
                  <li key={check.label} className="flex items-center gap-2">
                    {check.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className={cn("h-3.5 w-3.5", check.optional ? "text-ink-300" : "text-brand-600")} />}
                    <span className={cn(check.ok ? "text-ink-700" : check.optional ? "text-ink-500" : "font-medium text-brand-700")}>
                      {check.label}
                      {check.optional && !check.ok && " (optional)"}
                    </span>
                  </li>
                ))}
              </ul>

              <Button type="submit" size="lg" className="w-full" disabled={!dispatchable || blocking.length > 0} loading={dispatch.isPending}>
                <Send className="h-4 w-4" /> Dispatch Trip
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print Trip Sheet
                </Button>
                <Button variant="secondary" onClick={() => router.push(`/transportation/itinerary?trip=${trip.id}`)}>
                  <Eye className="h-4 w-4" /> Preview Itinerary
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Dispatch trip"
        tone="primary"
        confirmLabel="Dispatch Trip"
        loading={dispatch.isPending}
        message={
          <>
            Dispatch <strong>{trip.trip_number}</strong> ({routeLabel(trip)}) to <strong>{driver?.full_name}</strong> with <strong>{vehicle?.plate_number}</strong>
            {dispatchedAt ? <> at {format(new Date(dispatchedAt), "MMM d, yyyy h:mm a")}</> : null}?
            {reassigned && " The vehicle/driver change is saved with the dispatch."}
          </>
        }
        onConfirm={confirm}
        onClose={() => setConfirming(false)}
      />
    </form>
  );
}

function Summary({ icon, label, value, sub, className }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 px-4 py-3.5", className)}>
      <span className="mt-0.5 text-ink-800 [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-500">{label}</dt>
        <dd className="font-semibold whitespace-nowrap text-ink-900">{value}</dd>
        {sub && <dd className="text-xs text-ink-500">{sub}</dd>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} /> {label}
    </span>
  );
}
