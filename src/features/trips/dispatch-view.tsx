"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, Circle, ClipboardCheck, Eye, Flag, History, Play, Send, Shuffle, Truck, Undo2, UserRound } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable } from "@/components/ui/data-table";
import { Field, Textarea } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useListParams } from "@/hooks/use-list-params";
import { DRIVER_STATUS, LICENSE_TYPES, STOP_STATUS, STOP_TYPE, TRIP_STATUS, VEHICLE_STATUS, VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatNumber, formatTime } from "@/lib/utils";
import { tripsService } from "@/services/resources";
import type { Trip, TripStatus } from "@/types/api";
import { DetailRow } from "../orders/order-detail";
import { ReassignDialog } from "./reassign-dialog";
import { TRIP_KEYS, useTrip } from "./use-trip";

function checklist(trip: Trip) {
  const departureDay = trip.departure_at.slice(0, 10);
  return [
    { label: "Vehicle and driver assigned", ok: !!trip.vehicle && !!trip.driver },
    { label: "Vehicle is available for service", ok: !!trip.vehicle && ["available", "on_trip"].includes(trip.vehicle.status) },
    { label: "Driver is active", ok: !!trip.driver && ["available", "on_trip"].includes(trip.driver.status) },
    { label: "Driver's license valid on departure date", ok: !!trip.driver && trip.driver.license_expiry >= departureDay },
    { label: "Route has origin and destination stops", ok: (trip.stops?.length ?? 0) >= 2 },
    { label: "Linked to a customer order", ok: !!trip.order, optional: true },
  ];
}

function TripDispatchPanel({ id }: { id: number }) {
  const { canOperate } = usePermissions();
  const { data, isLoading, error, refetch } = useTrip(id);
  const [notes, setNotes] = useState("");
  const [reassigning, setReassigning] = useState<Trip | null>(null);
  const [confirm, setConfirm] = useState<TripStatus | null>(null);

  const change = useApiMutation(({ status, note }: { status: TripStatus; note?: string }) => tripsService.changeStatus(id, status, note), {
    invalidate: TRIP_KEYS,
    onSuccess: () => {
      setConfirm(null);
      setNotes("");
    },
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error?.message} onRetry={() => refetch()} />;
  const trip = data.data;
  const checks = checklist(trip);
  const blocking = checks.filter((c) => !c.ok && !c.optional);
  const can = (s: TripStatus) => canOperate && trip.allowed_transitions.includes(s);

  const confirmCopy: Record<string, { title: string; message: string; label: string; tone: "danger" | "primary"; reason?: string }> = {
    in_progress: { title: "Start trip", message: "Mark the trip as departed? The vehicle, driver and order switch to on-trip / in-transit.", label: "Start trip", tone: "primary" },
    completed: { title: "Complete trip", message: "Mark all remaining stops done and the order delivered?", label: "Complete trip", tone: "primary" },
    scheduled: { title: "Recall dispatch", message: "Move this trip back to Scheduled so it can be edited?", label: "Recall", tone: "primary" },
    cancelled: { title: "Cancel trip", message: "Cancel this trip? A scheduled order returns to Pending.", label: "Cancel trip", tone: "danger", reason: "Reason (optional)" },
  };
  const c = confirm ? confirmCopy[confirm] : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Trip Details" icon={<Flag />} action={<StatusBadge status={trip.status} map={TRIP_STATUS} />} />
          <CardBody>
            <dl>
              <DetailRow label="Trip No.">{trip.trip_number}</DetailRow>
              <DetailRow label="Date">{formatDate(trip.departure_at, "MMM d, yyyy (EEEE)")}</DetailRow>
              <DetailRow label="Route">
                {trip.origin} → {trip.destination}
              </DetailRow>
              <DetailRow label="Order">{trip.order ? <Link className="text-brand-600 hover:underline" href={`/orders/${trip.order.id}`}>{trip.order.order_number}</Link> : "—"}</DetailRow>
              <DetailRow label="Departure">{formatDateTime(trip.departure_at)}</DetailRow>
              <DetailRow label="Est. arrival">{formatDateTime(trip.estimated_arrival_at)}</DetailRow>
              <DetailRow label="Distance">{trip.distance_km ? `${formatNumber(trip.distance_km, 1)} km` : "Not recorded"}</DetailRow>
              <DetailRow label="Stops">{trip.stops?.length ?? 0}</DetailRow>
              {trip.order?.weight_kg ? <DetailRow label="Load">{formatNumber(trip.order.weight_kg)} kg</DetailRow> : null}
              {trip.dispatched_at && <DetailRow label="Dispatched">{formatDateTime(trip.dispatched_at)}{trip.dispatched_by ? ` by ${trip.dispatched_by.name}` : ""}</DetailRow>}
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Driver Information" icon={<UserRound />} />
          <CardBody>
            {trip.driver && (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <Avatar name={trip.driver.full_name} size="lg" className="h-14 w-14 text-lg" />
                  <div>
                    <p className="text-lg font-semibold text-ink-900">{trip.driver.full_name}</p>
                    <StatusBadge status={trip.driver.status} map={DRIVER_STATUS} />
                  </div>
                </div>
                <dl>
                  <DetailRow label="Contact">{trip.driver.phone}</DetailRow>
                  <DetailRow label="Email">{trip.driver.email ?? "—"}</DetailRow>
                  <DetailRow label="License">
                    {trip.driver.license_number} ({labelOf(LICENSE_TYPES, trip.driver.license_type)})
                  </DetailRow>
                  <DetailRow label="License expiry">{formatDate(trip.driver.license_expiry)}</DetailRow>
                </dl>
              </>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Vehicle Information" icon={<Truck />} />
          <CardBody>
            {trip.vehicle && (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-ink-100">
                    <Truck className="h-7 w-7 text-ink-700" />
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-ink-900">{trip.vehicle.plate_number}</p>
                    <StatusBadge status={trip.vehicle.status} map={VEHICLE_STATUS} />
                  </div>
                </div>
                <dl>
                  <DetailRow label="Make / Model">
                    {trip.vehicle.make} {trip.vehicle.model}
                  </DetailRow>
                  <DetailRow label="Type">{labelOf(VEHICLE_TYPES, trip.vehicle.vehicle_type)}</DetailRow>
                  <DetailRow label="Capacity">{trip.vehicle.capacity_kg ? `${formatNumber(trip.vehicle.capacity_kg)} kg` : "—"}</DetailRow>
                  <DetailRow label="Year model">{trip.vehicle.year}</DetailRow>
                  <DetailRow label="VIN">{trip.vehicle.vin ?? "—"}</DetailRow>
                </dl>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Route Stops & Orders" icon={<Flag />} action={<Link href={`/transportation/itinerary?trip=${trip.id}`} className="text-sm font-medium text-brand-600">Edit itinerary</Link>} />
            <DataTable
              rows={trip.stops}
              rowKey={(s) => s.id}
              columns={[
                { key: "seq", header: "#", cell: (s) => s.sequence },
                { key: "type", header: "Type", cell: (s) => <StatusBadge status={s.type} map={STOP_TYPE} dot={false} /> },
                { key: "loc", header: "Location", cell: (s) => (<span><span className="block font-medium text-ink-900">{s.location_name}</span><span className="text-xs text-ink-500">{s.address}</span></span>) },
                { key: "order", header: "Order No.", cell: (s) => s.order?.order_number ?? "—" },
                { key: "eta", header: "ETA", cell: (s) => formatTime(s.estimated_arrival_at) },
                { key: "status", header: "Status", cell: (s) => <StatusBadge status={s.status} map={STOP_STATUS} /> },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="Assignment History" icon={<History />} />
            <ul className="divide-y divide-ink-100">
              {trip.assignments?.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
                  <span className="font-medium text-ink-900">{a.vehicle?.plate_number}</span>
                  <span className="text-ink-700">{a.driver?.full_name}</span>
                  <span className="text-ink-500">{a.reason}</span>
                  <span className="ml-auto text-xs text-ink-500">
                    {formatDateTime(a.assigned_at)}
                    {a.assigned_by ? ` · ${a.assigned_by.name}` : ""}
                    {a.released_at ? ` · released ${formatDateTime(a.released_at)}` : " · current"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Pre-Dispatch Checklist" icon={<ClipboardCheck />} />
            <CardBody>
              <ul className="space-y-2 text-sm">
                {checks.map((check) => (
                  <li key={check.label} className="flex items-center gap-2">
                    {check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className={cn("h-4 w-4", check.optional ? "text-ink-300" : "text-brand-600")} />}
                    <span className={cn(check.ok ? "text-ink-700" : check.optional ? "text-ink-500" : "font-medium text-brand-700")}>
                      {check.label}
                      {check.optional && !check.ok && " (optional)"}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          {canOperate && (
            <Card>
              <CardHeader title="Dispatch Options" icon={<Send />} />
              <CardBody className="space-y-3">
                {trip.status === "scheduled" && (
                  <>
                    <Field label="Message to driver" htmlFor="dispatch-notes" hint="Saved on the trip as dispatch notes. No SMS or driver-app integration is configured.">
                      <Textarea id="dispatch-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder={`Good day ${trip.driver?.full_name.split(" ")[0] ?? ""}, your trip ${trip.trip_number} is now dispatched…`} />
                    </Field>
                    <Button className="w-full" onClick={() => change.mutate({ status: "dispatched", note: notes || undefined })} loading={change.isPending && !confirm} disabled={blocking.length > 0}>
                      <Send className="h-4 w-4" /> Complete & Dispatch
                    </Button>
                    {blocking.length > 0 && <p className="text-xs text-brand-700">Resolve the checklist items in red before dispatching.</p>}
                    {change.error && !confirm && <p className="text-xs text-brand-700">{change.error.field("driver_id") ?? change.error.field("vehicle_id") ?? change.error.message}</p>}
                  </>
                )}
                {trip.dispatch_notes && trip.status !== "scheduled" && (
                  <div className="rounded-lg bg-ink-50 p-3 text-sm whitespace-pre-line text-ink-700">
                    <p className="mb-1 text-xs font-semibold text-ink-500">Message to driver</p>
                    {trip.dispatch_notes}
                  </div>
                )}
                {can("in_progress") && (
                  <Button className="w-full" onClick={() => setConfirm("in_progress")}>
                    <Play className="h-4 w-4" /> Start trip (departed)
                  </Button>
                )}
                {can("completed") && (
                  <Button className="w-full" onClick={() => setConfirm("completed")}>
                    <CheckCircle2 className="h-4 w-4" /> Complete trip
                  </Button>
                )}
                {trip.status === "scheduled" || trip.status === "dispatched" ? (
                  <Button variant="secondary" className="w-full" onClick={() => setReassigning(trip)}>
                    <Shuffle className="h-4 w-4" /> Reassign vehicle / driver
                  </Button>
                ) : null}
                {can("scheduled") && (
                  <Button variant="secondary" className="w-full" onClick={() => setConfirm("scheduled")}>
                    <Undo2 className="h-4 w-4" /> Recall to scheduled
                  </Button>
                )}
                <Link href={`/transportation/itinerary?trip=${trip.id}`} className="block">
                  <Button variant="secondary" className="w-full">
                    <Eye className="h-4 w-4" /> Preview Itinerary
                  </Button>
                </Link>
                {can("cancelled") && (
                  <Button variant="ghost" className="w-full text-brand-700 hover:bg-brand-50" onClick={() => setConfirm("cancelled")}>
                    <Ban className="h-4 w-4" /> Cancel trip
                  </Button>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <ReassignDialog trip={reassigning} onClose={() => setReassigning(null)} />
      <ConfirmDialog
        open={!!c}
        title={c?.title ?? ""}
        message={c?.message}
        confirmLabel={c?.label}
        tone={c?.tone}
        reasonLabel={c?.reason}
        loading={change.isPending}
        error={change.error?.field("status") ?? change.error?.message}
        onConfirm={(reason) => change.mutate({ status: confirm!, note: reason })}
        onClose={() => {
          change.reset();
          setConfirm(null);
        }}
      />
    </div>
  );
}

const TABS = [
  { value: "", label: "All open" },
  { value: "scheduled", label: "Scheduled" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_progress", label: "In Progress" },
];

export function DispatchView() {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<number | null>(Number(searchParams.get("trip")) || null);
  const { params, update, setPage } = useListParams({ scope: "dispatch", status: "", sort: "departure_at", per_page: 8 });
  const list = useQuery({ queryKey: ["trips", params], queryFn: () => tripsService.list(params), placeholderData: keepPreviousData });
  const summary = useQuery({ queryKey: ["trips", "summary"], queryFn: tripsService.summary });
  const count = (s: string) => summary.data?.data.find((x) => x.status === s)?.count;

  return (
    <>
      <PageHeader title="Dispatch Management" description="Review scheduled and active trips, assign resources, and dispatch to drivers." />
      <Card className="mb-6">
        <Tabs
          className="px-4 pt-2"
          value={params.status as string}
          onChange={(status) => update({ status })}
          tabs={TABS.map((t) => ({ ...t, count: t.value ? count(t.value) : undefined }))}
        />
        <div className="p-4">
          <SearchInput value={(params.search as string) ?? ""} onChange={(search) => update({ search })} placeholder="Search trip, order, driver, plate, destination…" />
        </div>
        <DataTable
          rows={list.data?.data}
          loading={list.isFetching}
          error={list.error}
          onRetry={() => list.refetch()}
          rowKey={(t) => t.id}
          selectedKey={selected}
          onRowClick={(t) => setSelected(t.id)}
          empty={{ title: "No open trips", description: "Schedule a trip in Trip Scheduling to dispatch it here." }}
          columns={[
            { key: "no", header: "Trip No.", cell: (t) => <span className="font-semibold text-ink-900">{t.trip_number}</span> },
            { key: "route", header: "Route", cell: (t) => <span className="whitespace-nowrap">{t.origin} → {t.destination}</span> },
            { key: "dep", header: "Departure", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.departure_at)}</span> },
            { key: "vehicle", header: "Vehicle", cell: (t) => t.vehicle?.plate_number },
            { key: "driver", header: "Driver", cell: (t) => t.driver?.full_name },
            { key: "order", header: "Order", cell: (t) => t.order?.order_number ?? "—" },
            { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} map={TRIP_STATUS} /> },
          ]}
        />
        <Pagination meta={list.data?.meta} onPageChange={setPage} noun="trips" />
      </Card>

      {selected ? (
        <TripDispatchPanel key={selected} id={selected} />
      ) : (
        <Card>
          <EmptyState title="Select a trip" description="Choose a trip above to review details, run the pre-dispatch checklist and dispatch it." icon={<Send className="h-6 w-6" />} />
        </Card>
      )}
    </>
  );
}
