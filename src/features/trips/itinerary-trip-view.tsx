"use client";

import {
  ArrowLeft,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Fuel,
  ListChecks,
  MapPin,
  MapPinned,
  MoreVertical,
  Navigation,
  Package,
  Pencil,
  Plus,
  Printer,
  Route,
  Send,
  SkipForward,
  Trash2,
  Truck,
  Weight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dropdown } from "@/components/ui/dropdown";
import { Field, FormError, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { STOP_STATUS, TRIP_STATUS } from "@/lib/constants";
import { exportCsv } from "@/lib/export";
import { cn, formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { stopsService, tripsService } from "@/services/resources";
import type { StopStatus, Trip, TripStop } from "@/types/api";
import { RouteMap, useRoutePreview, useRoutingStatus } from "./route-map";
import { StopDialog } from "./stop-dialog";
import { TRIP_KEYS, useTrip } from "./use-trip";

export const ITINERARY_PATH = "/transportation/itinerary";

const MARKER: Record<TripStop["type"], string> = { pickup: "bg-emerald-600", stop: "bg-sky-600", dropoff: "bg-brand-600" };

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} hr${h > 1 ? "s" : ""}${m ? ` ${m} min${m > 1 ? "s" : ""}` : ""}` : `${m} mins`;
}

/** Google Maps needs no API key for these links; they open in a new tab. */
const mapsDirections = (stops: TripStop[]) => {
  const place = (s: TripStop) => s.address || s.location_name;
  const params = new URLSearchParams({ api: "1", travelmode: "driving", origin: place(stops[0]), destination: place(stops[stops.length - 1]) });
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).map(place).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
};
const mapsPlace = (stop: TripStop) => `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: stop.address || stop.location_name })}`;

/** Stop progress is only recorded while the trip is in progress (ItineraryService::updateStop). */
function progressMoves(trip: Trip, stop: TripStop): { status: StopStatus; label: string; icon: ReactNode }[] {
  if (trip.status !== "in_progress") return [];
  if (stop.status === "pending")
    return [
      { status: "arrived", label: "Mark arrived", icon: <MapPin /> },
      { status: "completed", label: "Mark completed", icon: <CheckCircle2 /> },
      ...(stop.type === "stop" ? [{ status: "skipped" as StopStatus, label: "Skip stop", icon: <SkipForward /> }] : []),
    ];
  if (stop.status === "arrived") return [{ status: "completed", label: "Mark completed", icon: <CheckCircle2 /> }];
  return [];
}

/** `/transportation/itinerary/[id]`: one trip's route, stop timeline and notes before (or during) the run. */
export function ItineraryTripView({ tripId }: { tripId: number }) {
  const { data, isLoading, error, refetch } = useTrip(tripId);
  const trip = data?.data;

  if (isLoading) return <LoadingState label="Loading itinerary…" />;
  if (error || !trip) return <ErrorState message={error?.message ?? "Trip not found."} onRetry={() => refetch()} />;
  return <ItineraryPreview trip={trip} />;
}

function ItineraryPreview({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { canOperate } = usePermissions();
  const { configured } = useRoutingStatus();
  const [editingStop, setEditingStop] = useState<TripStop | null | undefined>(undefined);
  const [removing, setRemoving] = useState<TripStop | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);

  const stops = trip.stops ?? [];
  const editable = canOperate && !["completed", "cancelled"].includes(trip.status);
  const preview = useRoutePreview(
    stops.map((s) => ({ label: s.location_name, query: s.address || s.location_name })),
    configured && stops.length >= 2,
    true,
  );
  const route = preview.data;
  const routeOk = !!route && route.unresolved.length === 0;

  const progress = useApiMutation(({ stop, status }: { stop: TripStop; status: StopStatus }) => stopsService.update(trip.id, stop.id, { status }), {
    invalidate: [...TRIP_KEYS, ["stops"]],
  });
  const remove = useApiMutation(() => stopsService.remove(trip.id, removing!.id), { invalidate: [...TRIP_KEYS, ["stops"]], onSuccess: () => setRemoving(null) });

  // Totals from the trip's own data; the drive estimate only when the routing provider placed every stop.
  const orders = [...new Map([trip.order, ...stops.map((s) => s.order)].filter((o): o is NonNullable<typeof o> => !!o).map((o) => [o.id, o])).values()];
  const totalWeight = orders.some((o) => o.weight_kg) ? orders.reduce((sum, o) => sum + (o.weight_kg ?? 0), 0) : null;
  const scheduleMinutes = Math.round((new Date(trip.estimated_arrival_at).getTime() - new Date(trip.departure_at).getTime()) / 60000);
  const durationMinutes = (routeOk ? route.duration_minutes : null) ?? scheduleMinutes;
  const distanceKm = trip.distance_km ?? (routeOk ? route.distance_km : null);
  const routeText = (stops.length ? stops.map((s) => s.location_name) : [trip.origin, trip.destination]).join(" → ");

  const runExport = () =>
    exportCsv(
      `itinerary-${trip.trip_number}`,
      ["#", "Type", "Location", "Address", "ETA", "Actual Arrival", "Status", "Order", "Customer", "Contact", "Cargo", "Quantity", "Weight (kg)"],
      stops.map((s) => [
        s.sequence,
        s.type === "pickup" ? "Start" : s.type === "dropoff" ? "Destination" : "Stop",
        s.location_name,
        s.address,
        s.estimated_arrival_at ? formatDateTime(s.estimated_arrival_at) : "",
        s.actual_arrival_at ? formatDateTime(s.actual_arrival_at) : "",
        STOP_STATUS[s.status].label,
        s.order?.order_number,
        s.order?.customer_name,
        s.order?.customer_contact,
        s.order?.cargo_description,
        s.order?.quantity,
        s.order?.weight_kg,
      ]),
    );

  return (
    <>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Preview Itinerary</h1>
            <StatusBadge status={trip.status} map={TRIP_STATUS} dot={false} />
          </div>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">Review the route, stops, schedule, and order details{trip.status === "scheduled" ? " before dispatch" : ""}.</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" size="lg" onClick={() => router.push(ITINERARY_PATH)}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="secondary" size="lg" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Dropdown
            trigger={({ toggle }) => (
              <Button variant="secondary" size="lg" onClick={toggle}>
                Export <ChevronDown className="h-4 w-4" />
              </Button>
            )}
            items={[
              { label: "Stops as CSV", icon: <Download />, onSelect: runExport },
              { label: "Print / Save as PDF", icon: <Printer />, onSelect: () => window.print() },
            ]}
          />
          {canOperate && trip.status === "scheduled" ? (
            <Button size="lg" className="min-w-40" onClick={() => router.push(`/transportation/dispatch/${trip.id}`)}>
              <Send className="h-4 w-4" /> Send to Driver
            </Button>
          ) : (
            <Button size="lg" className="min-w-40" disabled title={trip.dispatched_at ? `Dispatched ${formatDateTime(trip.dispatched_at)}` : "Only scheduled trips can be dispatched"}>
              <Send className="h-4 w-4" /> {trip.dispatched_at ? "Sent to Driver" : "Send to Driver"}
            </Button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <Card className="mb-5">
        <dl className="grid grid-cols-2 divide-ink-100 sm:grid-cols-3 xl:grid-cols-[auto_auto_minmax(0,2fr)_repeat(3,auto)] xl:divide-x">
          <Summary icon={<ListChecks />} label="Trip No." value={trip.trip_number} />
          <Summary icon={<CalendarDays />} label="Date" value={formatDate(trip.departure_at)} sub={formatDate(trip.departure_at, "EEEE")} />
          <Summary icon={<Route />} label="Route" value={<span className="line-clamp-2 text-sm font-medium whitespace-normal">{routeText}</span>} className="col-span-2 sm:col-span-1" />
          <Summary icon={<MapPin />} label="Total Stops" value={stops.length} />
          <Summary icon={<Route />} label="Total Distance" value={distanceKm != null ? `${formatNumber(distanceKm, distanceKm % 1 ? 1 : 0)} km` : "—"} />
          <Summary icon={<Clock />} label="Estimated Duration" value={durationMinutes > 0 ? formatDuration(durationMinutes) : "—"} />
        </dl>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Route map */}
        <Card className="xl:self-start">
          <CardHeader
            title="Route Map"
            icon={<MapPinned />}
            action={
              stops.length >= 2 && (
                <a href={mapsDirections(stops)} target="_blank" rel="noopener noreferrer" className="print:hidden">
                  <Button size="sm" variant="secondary" className="border-sky-300 text-sky-700 hover:bg-sky-50">
                    <ExternalLink className="h-3.5 w-3.5" /> View in Google Maps
                  </Button>
                </a>
              )
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
              className="min-h-[26rem]"
              overlay={
                <div className="absolute bottom-3 left-3 space-y-1.5 rounded-lg bg-white/95 px-3 py-2 text-xs text-ink-700 shadow-md">
                  <Legend color="bg-emerald-600" label="Start" />
                  <Legend color="bg-sky-600" label="Delivery Stop" />
                  <Legend color="bg-brand-600" label="Destination" />
                </div>
              }
            />
          </div>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader
            title="Itinerary Timeline"
            icon={<ListChecks />}
            action={
              editable && (
                <Button size="sm" variant="secondary" onClick={() => setEditingStop(null)} className="print:hidden">
                  <Plus className="h-3.5 w-3.5" /> Add Stop
                </Button>
              )
            }
          />
          <ol className="divide-y divide-ink-100">
            {stops.map((stop, index) => {
              const last = index === stops.length - 1;
              const moves = canOperate ? progressMoves(trip, stop) : [];
              const loadLabel = stop.type === "pickup" ? "Load Items" : "Deliver";
              return (
                <li key={stop.id} className="relative flex gap-3 px-4 py-3.5 sm:gap-4">
                  {!last && <span className="absolute top-12 bottom-0 left-[2.15rem] w-px bg-ink-200 sm:left-[2.4rem]" aria-hidden />}
                  <span className={cn("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", MARKER[stop.type])}>
                    {stop.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : stop.sequence}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-ink-900">{stop.estimated_arrival_at ? formatTime(stop.estimated_arrival_at) : "No ETA"}</span>
                        {stop.status !== "pending" ? (
                          <StatusBadge status={stop.status} map={STOP_STATUS} dot={false} />
                        ) : stop.type === "pickup" ? (
                          <Badge tone="green">Start</Badge>
                        ) : stop.type === "dropoff" ? (
                          <Badge tone="red">Destination</Badge>
                        ) : (
                          <Badge tone="blue">ETA</Badge>
                        )}
                        {stop.actual_arrival_at && <span className="text-xs text-ink-500">arrived {formatTime(stop.actual_arrival_at)}</span>}
                      </p>
                      <p className="mt-0.5 font-semibold text-ink-900">{stop.location_name}</p>
                      {stop.address && (
                        <p className="flex items-start gap-1.5 text-sm text-ink-600">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" /> {stop.address}
                        </p>
                      )}
                      {stop.order && (
                        <p className="flex items-start gap-1.5 text-sm text-ink-700">
                          {stop.type === "pickup" ? <Box className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" /> : <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />}
                          {loadLabel}: {stop.order.cargo_description} · {formatNumber(stop.order.quantity)} pcs{stop.order.weight_kg ? ` (${formatNumber(stop.order.weight_kg)} kg)` : ""}
                        </p>
                      )}
                      {stop.notes && <p className="mt-0.5 text-xs text-ink-500">{stop.notes}</p>}
                      {/* What the map provider matched, so a wrong pin (e.g. a same-named town elsewhere) is easy to spot. */}
                      {route?.points[index]?.matched && (
                        <p className="mt-0.5 text-[11px] text-ink-400 print:hidden">Map location: {route.points[index].matched}</p>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <div className={cn("min-w-0 flex-1 rounded-lg px-3 py-2 text-xs", stop.type === "pickup" ? "bg-emerald-50" : "bg-sky-50/70")}>
                        {stop.order ? (
                          <>
                            <p className="text-ink-500">Order No.</p>
                            <Link href={`/orders/${stop.order.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                              {stop.order.order_number}
                            </Link>
                            <p className="mt-1 text-ink-500">Customer</p>
                            <p className="truncate font-medium text-ink-900">{stop.order.customer_name}</p>
                            <p className="text-ink-700">{stop.order.customer_contact}</p>
                          </>
                        ) : (
                          <p className="py-2 text-ink-400">No order at this stop</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 print:hidden">
                        <a href={mapsPlace(stop)} target="_blank" rel="noopener noreferrer" title="Navigate in Google Maps" aria-label={`Navigate to ${stop.location_name}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-700 hover:bg-ink-50">
                          <Navigation className="h-4 w-4" />
                        </a>
                        {stop.order && (
                          <Link href={`/orders/${stop.order.id}`} title="Order details" aria-label={`Order ${stop.order.order_number}`} className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-700 hover:bg-ink-50">
                            <FileText className="h-4 w-4" />
                          </Link>
                        )}
                        {(moves.length > 0 || editable) && (
                          <Dropdown
                            trigger={({ toggle }) => (
                              <button onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 text-ink-700 hover:bg-ink-50" aria-label={`More actions for ${stop.location_name}`}>
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            )}
                            items={[
                              ...moves.map((m) => ({ label: m.label, icon: m.icon, onSelect: () => progress.mutate({ stop, status: m.status }), disabled: progress.isPending })),
                              ...(editable ? [{ label: "Edit stop", icon: <Pencil />, onSelect: () => setEditingStop(stop) }] : []),
                              ...(editable && stop.type === "stop" ? [{ label: "Remove stop", icon: <Trash2 />, danger: true, onSelect: () => setRemoving(stop) }] : []),
                            ]}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
            {stops.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-500">This trip has no stops yet.</li>}
          </ol>
          {trip.status === "in_progress" && canOperate && <p className="border-t border-ink-100 px-5 py-2.5 text-xs text-ink-500 print:hidden">Use ⋮ on a stop to record arrival, completion or a skipped stop.</p>}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Route summary */}
        <Card>
          <CardHeader title="Route Summary" icon={<Route />} />
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 2xl:grid-cols-6">
            <Metric icon={<Route />} value={distanceKm != null ? `${formatNumber(distanceKm, distanceKm % 1 ? 1 : 0)} km` : "—"} label="Total Distance" />
            <Metric icon={<Clock />} value={durationMinutes > 0 ? formatDuration(durationMinutes) : "—"} label={routeOk ? "Drive Time (Mapbox)" : "Estimated Duration"} />
            <Metric icon={<Weight />} value={totalWeight != null ? `${formatNumber(totalWeight)} kg` : "—"} label="Total Weight" />
            <Metric icon={<Package />} value={orders.length} label="Total Orders" />
            <Metric icon={<Box />} value="—" label="Total Volume" sub="Not tracked" />
            <Metric icon={<Fuel />} value="—" label="Estimated Fuel" sub="Needs fuel economy data" />
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader
            title="Notes / Instructions"
            icon={<FileText />}
            action={
              canOperate &&
              trip.status === "scheduled" && (
                <Button size="sm" variant="secondary" onClick={() => setEditingNotes(true)} className="print:hidden">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )
            }
          />
          <CardBody className="space-y-3 text-sm">
            <div className="min-h-24 rounded-lg border border-ink-100 px-4 py-3 whitespace-pre-line text-ink-700">{trip.notes || <span className="text-ink-400">No notes for this trip.</span>}</div>
            {trip.dispatch_notes && (
              <div className="rounded-lg bg-ink-50 px-4 py-3 whitespace-pre-line text-ink-700">
                <p className="mb-1 text-xs font-semibold text-ink-500">Message sent to driver</p>
                {trip.dispatch_notes}
              </div>
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
              <Truck className="h-3.5 w-3.5" /> {trip.vehicle?.plate_number ?? "—"} · {trip.driver?.full_name ?? "—"}
              {trip.driver?.phone && <span>· {trip.driver.phone}</span>}
            </p>
          </CardBody>
        </Card>
      </div>

      <StopDialog tripId={trip.id} open={editingStop !== undefined} stop={editingStop ?? null} onClose={() => setEditingStop(undefined)} />
      <NotesDialog trip={trip} open={editingNotes} onClose={() => setEditingNotes(false)} />
      <ConfirmDialog
        open={!!removing}
        title="Remove stop"
        message={`Remove “${removing?.location_name}” from the itinerary?`}
        confirmLabel="Remove"
        loading={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate(undefined)}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}

/** Trip notes can be changed while the trip is scheduled (TripService::update). */
function NotesDialog({ trip, open, onClose }: { trip: Trip; open: boolean; onClose: () => void }) {
  const [notes, setNotes] = useState(trip.notes ?? "");
  const save = useApiMutation(() => tripsService.update(trip.id, { notes: notes.trim() || null }), { invalidate: TRIP_KEYS, onSuccess: onClose });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notes / Instructions"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate(undefined)} loading={save.isPending}>
            Save notes
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={save.error?.message} />
        <Field label="Instructions for this trip" htmlFor="trip-notes" hint="One instruction per line works well for printing.">
          <Textarea id="trip-notes" rows={6} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
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

function Metric({ icon, value, label, sub }: { icon: ReactNode; value: ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-ink-100 px-2 py-3 text-center">
      <span className="text-ink-800 [&>svg]:h-6 [&>svg]:w-6">{icon}</span>
      <span className="font-semibold text-ink-900">{value}</span>
      <span className="text-xs text-ink-500">{label}</span>
      {sub && <span className="text-[11px] text-ink-400">{sub}</span>}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("h-3 w-3 rounded-full", color)} /> {label}
    </span>
  );
}
