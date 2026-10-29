"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Check,
  ClipboardList,
  Download,
  Fuel,
  GripVertical,
  Info,
  Lock,
  Map as MapIcon,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFieldArray, useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { usePermissions } from "@/hooks/use-current-user";
import { useDebounce } from "@/hooks/use-debounce";
import { FUEL_TYPES, STOP_ACTIVITY, TRIP_PRIORITY, TRIP_STATUS, TRIP_TYPES, VEHICLE_TYPES, labelOf, statusOptions } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatNumber, formatTime, fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";
import { ApiError } from "@/services/api-client";
import { ordersService, routingService, tripsService } from "@/services/resources";
import type { Driver, Order, Trip, TripPriority, TripType } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";
import { RouteMap, useRoutePreview, useRoutingStatus } from "./route-map";
import { EMPTY_STOP, ImportOrdersDialog, StopEditorDialog, type StopDraft } from "./trip-editor-dialogs";
import { TRIPS_PATH, isEditable } from "./trip-schedule-view";
import { TRIP_KEYS, useTrip } from "./use-trip";

const stopSchema = z.object({
  location_name: z.string().trim().min(1),
  address: z.string(),
  order_id: z.string(),
  activity: z.enum(["pickup", "delivery"]),
  estimated_arrival_at: z.string(),
});

const schema = z
  .object({
    trip_date: z.string().min(1, "Trip date is required."),
    departure_time: z.string().min(1, "Departure time is required."),
    trip_type: z.enum(["delivery", "pickup", "transfer", "return"]),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    reference_no: z.string().trim().max(100),
    order_id: z.string(),
    notes: z.string().max(2000),
    origin: z.string().trim().min(1, "Set the origin (first stop).").max(255),
    destination: z.string().trim().min(1, "Set the destination (last stop).").max(255),
    stops: z.array(stopSchema).max(50),
    estimated_arrival_at: z.string().min(1, "Estimated arrival is required."),
    vehicle_id: z.string().min(1, "Select an available vehicle."),
    driver_id: z.string().min(1, "Select an available driver."),
    co_driver_id: z.string(),
    distance_km: z.union([z.literal(""), z.coerce.number<string>().min(0)]),
  })
  .refine((v) => !v.trip_date || !v.departure_time || !v.estimated_arrival_at || new Date(v.estimated_arrival_at) > new Date(`${v.trip_date}T${v.departure_time}`), {
    path: ["estimated_arrival_at"],
    message: "Arrival must be after departure.",
  });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = [...Object.keys(schema.shape), "departure_time"];

const EMPTY: FormInput = {
  trip_date: "",
  departure_time: "08:00",
  trip_type: "delivery",
  priority: "normal",
  reference_no: "",
  order_id: "",
  notes: "",
  origin: "",
  destination: "",
  stops: [],
  estimated_arrival_at: "",
  vehicle_id: "",
  driver_id: "",
  co_driver_id: "",
  distance_km: "",
};

function fromTrip(trip: Trip): FormInput {
  const departure = parseISO(trip.departure_at);
  return {
    trip_date: format(departure, "yyyy-MM-dd"),
    departure_time: format(departure, "HH:mm"),
    trip_type: trip.trip_type,
    priority: trip.priority,
    reference_no: trip.reference_no ?? "",
    order_id: trip.order_id ? String(trip.order_id) : "",
    notes: trip.notes ?? "",
    origin: trip.origin,
    destination: trip.destination,
    stops: (trip.stops ?? [])
      .filter((s) => s.type === "stop")
      .map((s) => ({
        location_name: s.location_name,
        address: s.address ?? "",
        order_id: s.order_id ? String(s.order_id) : "",
        activity: s.activity ?? "delivery",
        estimated_arrival_at: toDateTimeLocal(s.estimated_arrival_at),
      })),
    estimated_arrival_at: toDateTimeLocal(trip.estimated_arrival_at),
    vehicle_id: String(trip.vehicle_id),
    driver_id: String(trip.driver_id),
    co_driver_id: trip.co_driver_id ? String(trip.co_driver_id) : "",
    distance_km: trip.distance_km === null ? "" : String(trip.distance_km),
  };
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

/** Create and edit page for a trip (`/transportation/trip-scheduling/create` and `/[id]/edit`). */
export function TripEditor({ tripId }: { tripId?: number }) {
  const { canOperate } = usePermissions();
  const existing = useTrip(tripId ?? null);

  if (!canOperate) {
    return <ErrorState message="You do not have permission to schedule or edit trips." />;
  }
  if (tripId) {
    if (existing.isLoading) return <LoadingState label="Loading trip…" />;
    if (existing.error || !existing.data) return <ErrorState message={existing.error?.message ?? "Trip not found."} onRetry={() => existing.refetch()} />;
    return <TripEditorForm trip={existing.data.data} />;
  }
  return <TripEditorForm />;
}

function TripEditorForm({ trip }: { trip?: Trip }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editing = !!trip;
  const locked = editing && !isEditable(trip);
  const [formError, setFormError] = useState<string | null>(null);
  const [stopDialog, setStopDialog] = useState<{ index: number | "origin" | "destination" | "new"; initial: StopDraft } | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: trip ? fromTrip(trip) : { ...EMPTY, trip_date: format(new Date(), "yyyy-MM-dd"), order_id: searchParams.get("order") ?? "" },
  });
  const stops = useFieldArray({ control, name: "stops" });
  const values = watch();

  const nextNumber = useQuery({ queryKey: ["trips", "next-number"], queryFn: tripsService.nextNumber, enabled: !editing });
  const { configured } = useRoutingStatus();
  const orders = useQuery({ queryKey: ["orders", "schedulable"], queryFn: () => ordersService.list({ schedulable: 1, per_page: 100, sort: "scheduled_pickup_at" }) });

  // Orders the page knows about: schedulable ones, plus those already on the trip being edited.
  const orderMap = useMemo(() => {
    const map = new Map<string, Order>();
    (orders.data?.data ?? []).forEach((o) => map.set(String(o.id), o));
    if (trip?.order) map.set(String(trip.order.id), trip.order);
    trip?.stops?.forEach((s) => s.order && map.set(String(s.order.id), s.order));
    return map;
  }, [orders.data, trip]);
  const orderList = [...orderMap.values()];

  // Pre-fill route and times from the selected order (new trips only).
  const orderId = values.order_id;
  useEffect(() => {
    if (editing) return;
    const order = orders.data?.data.find((o) => String(o.id) === orderId);
    if (!order) return;
    const pickup = parseISO(order.scheduled_pickup_at);
    setValue("origin", order.pickup_address.split(",").slice(-1)[0].trim() || order.pickup_address);
    setValue("destination", order.delivery_address.split(",").slice(-2).join(",").trim() || order.delivery_address);
    setValue("trip_date", format(pickup, "yyyy-MM-dd"));
    setValue("departure_time", format(pickup, "HH:mm"));
    setValue("estimated_arrival_at", toDateTimeLocal(order.scheduled_delivery_at));
  }, [orderId, orders.data, editing, setValue]);

  const departureLocal = values.trip_date && values.departure_time ? `${values.trip_date}T${values.departure_time}` : "";
  const slot = { departure: useDebounce(departureLocal, 400), arrival: useDebounce(values.estimated_arrival_at, 400) };
  const validWindow = !!slot.departure && !!slot.arrival && new Date(slot.arrival) > new Date(slot.departure);
  const availability = useQuery({
    queryKey: ["trips", "availability", slot.departure, slot.arrival, trip?.id],
    queryFn: () => tripsService.availability(fromDateTimeLocal(slot.departure), fromDateTimeLocal(slot.arrival), trip?.id),
    enabled: validWindow && !locked,
  });
  // Until availability loads, offer the trip's current assignment so the selects can show it.
  const vehicles = availability.data?.data.vehicles ?? (trip?.vehicle ? [trip.vehicle] : []);
  const drivers = availability.data?.data.drivers ?? [trip?.driver, trip?.co_driver].filter((d): d is Driver => !!d);
  const vehicle = vehicles.find((v) => String(v.id) === values.vehicle_id) ?? (trip && String(trip.vehicle_id) === values.vehicle_id ? trip.vehicle : undefined);
  const driver = drivers.find((d) => String(d.id) === values.driver_id) ?? (trip && String(trip.driver_id) === values.driver_id ? trip.driver : undefined);
  const coDriver = drivers.find((d) => String(d.id) === values.co_driver_id) ?? (trip?.co_driver && String(trip.co_driver.id) === values.co_driver_id ? trip.co_driver : undefined);

  // Clear selections that are no longer free after the window changes.
  useEffect(() => {
    // After saving, the refreshed availability no longer lists this trip's own resources; keep the form as is while redirecting.
    if (!availability.data || mutation.isSuccess) return;
    const free = (list: { id: number }[], id: string) => !id || list.some((x) => String(x.id) === id);
    if (!free(vehicles, values.vehicle_id)) setValue("vehicle_id", "");
    if (!free(drivers, values.driver_id)) setValue("driver_id", "");
    if (!free(drivers, values.co_driver_id) || values.co_driver_id === values.driver_id) setValue("co_driver_id", "");
  }, [availability.data, values.driver_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useApiMutation(
    (v: FormOutput) => {
      const payload = nullable({
        reference_no: v.reference_no,
        trip_type: v.trip_type,
        priority: v.priority,
        vehicle_id: Number(v.vehicle_id),
        driver_id: Number(v.driver_id),
        co_driver_id: v.co_driver_id ? Number(v.co_driver_id) : "",
        origin: v.origin,
        destination: v.destination,
        departure_at: fromDateTimeLocal(`${v.trip_date}T${v.departure_time}`),
        estimated_arrival_at: fromDateTimeLocal(v.estimated_arrival_at),
        distance_km: v.distance_km,
        notes: v.notes,
        stops: v.stops.map((s) =>
          nullable({ ...s, order_id: s.order_id ? Number(s.order_id) : "", estimated_arrival_at: s.estimated_arrival_at ? fromDateTimeLocal(s.estimated_arrival_at) : "" }),
        ),
      });
      return trip ? tripsService.update(trip.id, payload) : tripsService.create({ ...payload, order_id: v.order_id ? Number(v.order_id) : null });
    },
    { invalidate: [...TRIP_KEYS, ["trips", "next-number"]], onSuccess: (result) => router.push(`${TRIPS_PATH}/${result.data.id}`) },
  );

  const submit = handleSubmit(
    async (v) => {
      setFormError(null);
      try {
        await mutation.mutateAsync(v);
      } catch (error) {
        if (error instanceof ApiError && error.errors.departure_at) error.errors.departure_time = error.errors.departure_at;
        setFormError(applyApiErrors(error, setError as UseFormSetError<FormInput>, FIELDS));
      }
    },
    () => setFormError("Some details are missing or invalid. Check the highlighted fields."),
  );

  // ----- Stops ---------------------------------------------------------------
  const saveStop = (draft: StopDraft) => {
    if (!stopDialog) return;
    const { index } = stopDialog;
    if (index === "origin" || index === "destination") setValue(index, draft.location_name, { shouldValidate: true });
    else if (index === "new") stops.append(draft);
    else stops.update(index, draft);
    setStopDialog(null);
  };
  const importOrders = (picked: Order[]) => {
    const start = departureLocal ? new Date(departureLocal) : null;
    const end = values.estimated_arrival_at ? new Date(values.estimated_arrival_at) : null;
    picked.forEach((o) => {
      const eta = new Date(o.scheduled_delivery_at);
      stops.append({
        location_name: o.customer_name,
        address: o.delivery_address,
        order_id: String(o.id),
        activity: "delivery",
        // Keep the order's delivery time only when it fits the trip window, so the API accepts it.
        estimated_arrival_at: start && end && eta >= start && eta <= end ? toDateTimeLocal(o.scheduled_delivery_at) : "",
      });
    });
    setImporting(false);
  };

  // ----- Derived summary -----------------------------------------------------
  const route = [
    { key: "origin", name: values.origin, address: orderMap.get(values.order_id)?.pickup_address ?? "", activity: "pickup" as const, eta: departureLocal, order: values.order_id },
    ...values.stops.map((s, i) => ({ key: `stop-${i}`, name: s.location_name, address: s.address, activity: s.activity, eta: s.estimated_arrival_at, order: s.order_id })),
    { key: "destination", name: values.destination, address: orderMap.get(values.order_id)?.delivery_address ?? "", activity: "delivery" as const, eta: values.estimated_arrival_at, order: values.order_id },
  ];
  const orderIds = [...new Set([values.order_id, ...values.stops.map((s) => s.order_id)].filter(Boolean))];
  const weights = orderIds.map((id) => orderMap.get(id)?.weight_kg ?? null);
  const totalWeight = weights.some((w) => w !== null) ? weights.reduce<number>((sum, w) => sum + (w ?? 0), 0) : null;
  const durationMinutes = departureLocal && values.estimated_arrival_at ? Math.round((new Date(values.estimated_arrival_at).getTime() - new Date(departureLocal).getTime()) / 60000) : null;

  // ----- Route preview (routing provider) ------------------------------------
  const notify = useToast();
  const routeStops = route.map((r) => ({ label: r.name, query: r.address || r.name }));
  const preview = useRoutePreview(routeStops, configured, true);
  const routeData = preview.data;
  const sequenceKey = routeStops.map((r) => `${r.label}|${r.query}`).join(";");
  const [optimizedKey, setOptimizedKey] = useState<string | null>(null);
  const optimized = optimizedKey === sequenceKey;
  // Legs line up with the stops only when every stop was placed and the preview matches the current order.
  const legsMatch = !!routeData && routeData.unresolved.length === 0 && routeData.legs.length === route.length - 1 && !preview.isPlaceholderData;
  const driveEta = (i: number) => {
    if (!legsMatch || !departureLocal || i === 0) return null;
    const minutes = routeData!.legs.slice(0, i).reduce((sum, leg) => sum + leg.duration_minutes, 0);
    return new Date(new Date(departureLocal).getTime() + minutes * 60_000).toISOString();
  };

  // Fill the planned distance from the route unless the user typed their own.
  const [autoDistance, setAutoDistance] = useState<string | null>(null);
  useEffect(() => {
    if (!legsMatch || routeData?.distance_km == null || locked) return;
    const current = String(values.distance_km ?? "");
    if (current !== "" && current !== autoDistance) return;
    const next = String(routeData.distance_km);
    setAutoDistance(next);
    if (current !== next) setValue("distance_km", next);
  }, [routeData, legsMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const optimize = useApiMutation(() => routingService.preview(routeStops, { optimize: true, legendInset: true }).then((r) => r.data), {
    onSuccess: (result) => {
      if (result.unresolved.length) return notify(`Couldn't locate ${result.unresolved.join(", ")}. Add a fuller address, then optimize again.`, "error");
      const reordered = result.order.slice(1, -1).map((i) => values.stops[i - 1]);
      if (reordered.length !== values.stops.length || reordered.some((stop) => !stop)) return notify("The routing provider returned an unexpected stop order. Nothing was changed.", "error");
      stops.replace(reordered);
      const key = [route[0], ...reordered.map((s) => ({ name: s.location_name, address: s.address })), route[route.length - 1]]
        .map((r) => `${r.name}|${r.address || r.name}`)
        .join(";");
      setOptimizedKey(key);
      notify(result.order.join() === route.map((_, i) => i).join() ? "Stops are already in the most efficient order." : "Stops reordered for the most efficient route.");
    },
  });
  const canOptimize = configured && !locked && values.stops.length >= 2 && !!values.origin.trim() && !!values.destination.trim();

  const steps = [
    { id: "trip-info", title: "Trip Information", description: "Basic details", done: !!(values.trip_date && values.departure_time && values.trip_type) },
    { id: "trip-stops", title: "Stops & Orders", description: "Add delivery stops", done: !!(values.origin.trim() && values.destination.trim()) },
    { id: "trip-resources", title: "Vehicle & Driver", description: "Assign and schedule", done: !!(values.vehicle_id && values.driver_id && values.estimated_arrival_at) },
    { id: "trip-review", title: "Route & Review", description: "Optimize and confirm", done: false },
  ];
  steps[3].done = steps.slice(0, 3).every((s) => s.done);
  const current = steps.findIndex((s) => !s.done);

  const resourceHint = !validWindow ? "Set the trip date, departure time and arrival to see who is free." : availability.isFetching ? "Checking availability…" : undefined;

  return (
    <form onSubmit={submit} noValidate>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{editing ? `Edit Trip ${trip.trip_number}` : "Create New Trip"}</h1>
            {editing && <StatusBadge status={trip.status} map={TRIP_STATUS} />}
          </div>
          <p className="mt-1 text-sm text-ink-500 sm:text-base">{editing ? "Update the trip details, stops and assignment." : "Schedule a new delivery trip and optimize your route."}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" className="min-w-28" onClick={() => router.push(editing ? `${TRIPS_PATH}/${trip.id}` : TRIPS_PATH)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" className="min-w-40" loading={mutation.isPending} disabled={locked}>
            {editing ? "Save Changes" : "Save & Schedule"}
          </Button>
        </div>
      </div>

      {locked && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This trip is <strong>{TRIP_STATUS[trip.status].label.toLowerCase()}</strong> and can no longer be edited here. Use{" "}
            <Link href={`/transportation/dispatch/${trip.id}`} className="font-medium underline">
              Dispatch Management
            </Link>{" "}
            for trips that have been released.
          </span>
        </div>
      )}

      {/* Stepper */}
      <ol className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-ink-100 bg-white p-1.5 shadow-card lg:grid-cols-4">
        {steps.map((step, i) => {
          const active = i === (current === -1 ? steps.length - 1 : current);
          return (
            <li key={step.id}>
              <a
                href={`#${step.id}`}
                className={cn(
                  "flex h-full items-center gap-3 px-4 py-3 transition",
                  active ? "rounded-lg border border-brand-500 bg-brand-50 lg:rounded-r-none lg:[clip-path:polygon(0_0,calc(100%-14px)_0,100%_50%,calc(100%-14px)_100%,0_100%)]" : "rounded-lg hover:bg-ink-50",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    active ? "bg-brand-600 text-white" : step.done ? "bg-ink-900 text-white" : "bg-ink-200 text-white",
                  )}
                >
                  {step.done && !active ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-semibold", active ? "text-brand-700" : "text-ink-800")}>{step.title}</span>
                  <span className="block truncate text-xs text-ink-500">{step.description}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>

      <FormError message={formError} />

      <div className={cn("grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)]", formError && "mt-4")}>
        <fieldset disabled={locked} className="min-w-0 space-y-5">
          {/* 1. Trip information */}
          <Card id="trip-info" className="scroll-mt-24">
            <CardHeader title="Trip Information" icon={<ClipboardList />} />
            <CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
              <Field label="Trip No." htmlFor="trip_number" hint={editing ? undefined : "Final number is assigned on save."}>
                <div className="relative">
                  <Input id="trip_number" value={editing ? trip.trip_number : (nextNumber.data?.data.trip_number ?? (nextNumber.isError ? "Assigned on save" : "…"))} readOnly className="bg-ink-50 pr-10 font-medium" />
                  {!editing && (
                    <button
                      type="button"
                      onClick={() => nextNumber.refetch()}
                      className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-400 hover:text-brand-600"
                      aria-label="Refresh trip number"
                      title="Refresh trip number"
                    >
                      <RefreshCw className={cn("h-4 w-4", nextNumber.isFetching && "animate-spin")} />
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Trip Date" htmlFor="trip_date" error={errors.trip_date?.message} required>
                <Input id="trip_date" type="date" invalid={!!errors.trip_date} {...register("trip_date")} />
              </Field>
              <Field label="Trip Type" htmlFor="trip_type" error={errors.trip_type?.message} required>
                <Select id="trip_type" options={TRIP_TYPES} {...register("trip_type")} />
              </Field>
              <Field label="Priority" htmlFor="priority" error={errors.priority?.message}>
                <Select id="priority" options={statusOptions(TRIP_PRIORITY)} {...register("priority")} />
              </Field>
              <Field label="Reference No." htmlFor="reference_no" error={errors.reference_no?.message}>
                <Input id="reference_no" placeholder="Enter reference number (optional)" {...register("reference_no")} />
              </Field>
              <Field label="Departure Time" htmlFor="departure_time" error={errors.departure_time?.message} required>
                <Input id="departure_time" type="time" invalid={!!errors.departure_time} {...register("departure_time")} />
              </Field>
              <Field label="Order" htmlFor="order_id" error={errors.order_id?.message} hint={editing ? "The trip's order can't be changed after scheduling." : "Optional. Fills in route and times."} className="sm:col-span-2">
                <Select
                  id="order_id"
                  options={orderList.map((o) => ({ value: String(o.id), label: `${o.order_number} · ${o.customer_name}` }))}
                  placeholder="No order (empty / positioning trip)"
                  disabled={editing}
                  {...register("order_id")}
                />
              </Field>
              <Field label="Remarks" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2 xl:col-span-4">
                <Textarea id="notes" rows={2} placeholder="Enter remarks or instructions (optional)" {...register("notes")} />
              </Field>
            </CardBody>
          </Card>

          {/* 2. Stops & orders */}
          <Card id="trip-stops" className="scroll-mt-24">
            <CardHeader
              title="Stops & Orders"
              icon={<MapPin />}
              action={
                <>
                  <Button variant="secondary" size="sm" onClick={() => setStopDialog({ index: "new", initial: EMPTY_STOP })}>
                    <Plus className="h-3.5 w-3.5" /> Add Stop
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
                    <Download className="h-3.5 w-3.5" /> Import Orders
                  </Button>
                </>
              }
            />
            <div className="overflow-x-auto px-3 pt-3">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs font-semibold text-ink-600">
                  <tr>
                    <th className="w-8 py-2.5 pl-3" aria-label="Reorder" />
                    <th className="w-8 px-2 py-2.5">#</th>
                    <th className="px-3 py-2.5">Customer / Location</th>
                    <th className="px-3 py-2.5">Address</th>
                    <th className="px-3 py-2.5">Order No.</th>
                    <th className="px-3 py-2.5">Stop Type</th>
                    <th className="px-3 py-2.5">ETA</th>
                    <th className="px-3 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {route.map((row, i) => {
                    const stopIndex = i - 1;
                    const isEndpoint = row.key === "origin" || row.key === "destination";
                    const order = row.order ? orderMap.get(row.order) : undefined;
                    const missing = isEndpoint && !row.name.trim();
                    const fieldError = row.key === "origin" ? errors.origin : row.key === "destination" ? errors.destination : undefined;
                    return (
                      <tr
                        key={isEndpoint ? row.key : stops.fields[stopIndex]?.id}
                        draggable={!isEndpoint && !locked}
                        onDragStart={() => setDragIndex(stopIndex)}
                        onDragOver={(e) => !isEndpoint && dragIndex !== null && e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex !== null && !isEndpoint && dragIndex !== stopIndex) stops.move(dragIndex, stopIndex);
                          setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        className={cn(dragIndex === stopIndex && "bg-brand-50/60 opacity-60", fieldError && "bg-brand-50/40")}
                      >
                        <td className="py-3 pl-3">
                          {isEndpoint ? (
                            <Lock className="h-3.5 w-3.5 text-ink-300" aria-label={row.key === "origin" ? "Origin stays first" : "Destination stays last"} />
                          ) : (
                            <GripVertical className="h-4 w-4 cursor-grab text-ink-400" aria-label="Drag to reorder" />
                          )}
                        </td>
                        <td className="px-2 py-3 text-ink-700">{i + 1}</td>
                        <td className="px-3 py-3">
                          {missing ? (
                            <button type="button" onClick={() => setStopDialog({ index: row.key as "origin" | "destination", initial: { ...EMPTY_STOP, location_name: "" } })} className={cn("text-sm font-medium", fieldError ? "text-brand-700" : "text-ink-400 hover:text-brand-600")}>
                              {row.key === "origin" ? "Set origin…" : "Set destination…"}
                            </button>
                          ) : (
                            <span className="block font-medium text-ink-900">{row.name}</span>
                          )}
                          {isEndpoint && <span className="text-xs text-ink-500">{row.key === "origin" ? "Origin" : "Destination"}</span>}
                        </td>
                        <td className="min-w-40 max-w-60 px-3 py-3 text-xs whitespace-normal text-ink-600">{row.address || <span className="text-ink-400">—</span>}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-ink-700">{order?.order_number ?? <span className="text-ink-400">—</span>}</td>
                        <td className="px-3 py-3">
                          <StatusBadge status={row.activity} map={STOP_ACTIVITY} dot={false} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.eta ? formatTime(row.eta) : <span className="text-ink-400">—</span>}</td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setStopDialog(
                                isEndpoint
                                  ? { index: row.key as "origin" | "destination", initial: { ...EMPTY_STOP, location_name: row.name } }
                                  : { index: stopIndex, initial: values.stops[stopIndex] as StopDraft },
                              )
                            }
                            className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                            aria-label={`Edit stop ${i + 1}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {isEndpoint ? (
                            <span className="inline-block w-7" />
                          ) : (
                            <button type="button" onClick={() => stops.remove(stopIndex)} className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50 hover:text-brand-700" aria-label={`Remove stop ${i + 1}`}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 text-xs text-ink-500">
              {errors.origin || errors.destination || errors.stops ? (
                <p className="font-medium text-brand-700" role="alert">
                  {errors.origin?.message ?? errors.destination?.message ?? errors.stops?.message ?? "Check the stops above."}
                </p>
              ) : (
                <p>Drag stops to reorder them. The origin stays first and the destination last; their times come from the schedule.</p>
              )}
            </div>
          </Card>

          {/* 3. Vehicle & driver */}
          <Card id="trip-resources" className="scroll-mt-24">
            <CardHeader title="Vehicle & Driver" icon={<Truck />} description={resourceHint} />
            <CardBody className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Planned Departure" htmlFor="departure_preview" hint="From the trip date and departure time.">
                  <Input id="departure_preview" value={departureLocal ? formatDateTime(departureLocal) : "—"} readOnly className="bg-ink-50" />
                </Field>
                <Field label="Estimated Arrival" htmlFor="estimated_arrival_at" error={errors.estimated_arrival_at?.message} required>
                  <Input id="estimated_arrival_at" type="datetime-local" invalid={!!errors.estimated_arrival_at} {...register("estimated_arrival_at")} />
                </Field>
              </div>
              <div className="grid gap-5 lg:grid-cols-3">
                <div className="space-y-3">
                  <Field label="Vehicle" htmlFor="vehicle_id" error={errors.vehicle_id?.message} hint={validWindow && !availability.isFetching && !vehicle ? `${vehicles.length} available for this window` : undefined} required>
                    <Select
                      id="vehicle_id"
                      options={vehicles.map((v) => ({ value: String(v.id), label: `${v.plate_number} (${v.make} ${v.model})` }))}
                      placeholder="Select vehicle"
                      disabled={!validWindow}
                      invalid={!!errors.vehicle_id}
                      {...register("vehicle_id")}
                    />
                  </Field>
                  {vehicle && (
                    <ResourceCard
                      media={<Truck className="h-7 w-7 text-ink-600" />}
                      title={vehicle.plate_number}
                      subtitle={`${vehicle.make} ${vehicle.model} · ${labelOf(VEHICLE_TYPES, vehicle.vehicle_type)}`}
                    >
                      <Stat icon={<Truck />} label="Capacity" value={vehicle.capacity_kg ? `${formatNumber(vehicle.capacity_kg)} kg` : "—"} />
                      <Stat icon={<Fuel />} label="Fuel" value={labelOf(FUEL_TYPES, vehicle.fuel_type)} />
                    </ResourceCard>
                  )}
                </div>
                <div className="space-y-3">
                  <Field label="Driver" htmlFor="driver_id" error={errors.driver_id?.message} hint={validWindow && !availability.isFetching && !driver ? `${drivers.length} available with a valid license` : undefined} required>
                    <Select
                      id="driver_id"
                      options={drivers.map((d) => ({ value: String(d.id), label: d.full_name }))}
                      placeholder="Select driver"
                      disabled={!validWindow}
                      invalid={!!errors.driver_id}
                      {...register("driver_id")}
                    />
                  </Field>
                  {driver && <DriverCard driver={driver} />}
                </div>
                <div className="space-y-3">
                  <Field label="Co-Driver" htmlFor="co_driver_id" error={errors.co_driver_id?.message}>
                    <Select
                      id="co_driver_id"
                      options={drivers.filter((d) => String(d.id) !== values.driver_id).map((d) => ({ value: String(d.id), label: d.full_name }))}
                      placeholder="Select co-driver (optional)"
                      disabled={!validWindow}
                      {...register("co_driver_id")}
                    />
                  </Field>
                  {coDriver && <DriverCard driver={coDriver} />}
                </div>
              </div>
            </CardBody>
          </Card>
        </fieldset>

        {/* 4. Route & review */}
        <div id="trip-review" className="scroll-mt-24 space-y-5 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardHeader
              title="Route Preview"
              icon={<MapIcon />}
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  className="border-sky-300 text-sky-700 hover:bg-sky-50"
                  disabled={!canOptimize}
                  loading={optimize.isPending}
                  onClick={() => optimize.mutate(undefined)}
                  title={!configured ? "No routing provider is configured." : canOptimize ? "Reorder the stops between origin and destination for the shortest drive" : "Add at least two stops between the origin and destination."}
                >
                  <Navigation className="h-3.5 w-3.5" /> Optimize Route
                </Button>
              }
            />
            <div className="p-3">
              <RouteMap
                configured={configured}
                image={routeData?.image}
                loading={preview.isFetching}
                error={preview.error?.message}
                unresolved={routeData?.unresolved}
                emptyHint="Set the origin and destination to draw the route."
                className="min-h-96"
                overlay={
                  <ol className="w-56 space-y-3 rounded-lg bg-white/95 p-3 shadow-md">
                    {route.map((row, i) => {
                      const eta = row.eta || driveEta(i);
                      return (
                        <li key={row.key} className="flex items-start gap-2.5">
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                              i === 0 ? "bg-emerald-600" : i === route.length - 1 ? "bg-brand-600" : "bg-sky-600",
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 text-xs">
                            <span className={cn("block truncate font-medium", row.name ? "text-ink-900" : "text-ink-400")}>
                              {row.name || (i === 0 ? "Origin not set" : "Destination not set")}
                              {i === 0 && row.name ? " (Start)" : ""}
                            </span>
                            <span className="text-ink-500" title={row.eta ? undefined : eta ? "Estimated from Mapbox drive time" : undefined}>
                              {eta ? `${row.eta ? "" : "≈ "}${formatTime(eta)}` : "—"}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                }
              />
            </div>
          </Card>

          <Card id="trip-summary">
            <CardHeader title="Trip Summary" icon={<ClipboardList />} />
            <CardBody className="grid gap-x-6 sm:grid-cols-2">
              <dl className="space-y-2.5 text-sm">
                <SummaryRow label="Total Stops" value={route.length} />
                <SummaryRow label="Total Distance" value={values.distance_km !== "" && values.distance_km !== undefined ? `${formatNumber(Number(values.distance_km), 1)} km` : "—"} />
                <SummaryRow
                  label={legsMatch ? "Drive Time" : "Estimated Duration"}
                  value={legsMatch && routeData?.duration_minutes != null ? formatDuration(routeData.duration_minutes) : durationMinutes && durationMinutes > 0 ? formatDuration(durationMinutes) : "—"}
                />
                <SummaryRow label="Total Orders" value={orderIds.length} />
                <SummaryRow label="Total Weight" value={totalWeight !== null ? `${formatNumber(totalWeight)} kg` : "—"} />
                <SummaryRow label="Total Volume" value={<span className="font-normal text-ink-400">Not tracked</span>} />
              </dl>
              <dl className="mt-2.5 space-y-2.5 text-sm sm:mt-0">
                <SummaryRow label="Trip Type" value={labelOf(TRIP_TYPES, values.trip_type as TripType)} />
                <SummaryRow label="Priority" value={<StatusBadge status={values.priority as TripPriority} map={TRIP_PRIORITY} dot={false} />} />
                <SummaryRow label="Planned Departure" value={departureLocal ? <TwoLine value={departureLocal} /> : "—"} />
                <SummaryRow label="Estimated Arrival" value={values.estimated_arrival_at ? <TwoLine value={values.estimated_arrival_at} /> : "—"} />
              </dl>
              <div className="mt-4 sm:col-span-2">
                <Field label="Planned distance (km)" htmlFor="distance_km" error={errors.distance_km?.message} hint={configured ? (autoDistance !== null && String(values.distance_km) === autoDistance ? "Driving distance from Mapbox. You can override it." : "Filled from the Mapbox route when available.") : "Enter if known. Distance isn't estimated without a routing provider."}>
                  <Input id="distance_km" type="number" min={0} step="0.1" disabled={locked} {...register("distance_km")} />
                </Field>
              </div>
            </CardBody>
            {vehicle?.capacity_kg && totalWeight !== null && totalWeight > vehicle.capacity_kg && (
              <p className="mx-5 mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Total weight exceeds {vehicle.plate_number}&apos;s {formatNumber(vehicle.capacity_kg)} kg capacity.
              </p>
            )}
            <div className="mx-5 mb-5 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <span>
                {!configured
                  ? "Route not optimized: no routing provider is configured, so stops keep the order you set and distance and drive time aren't calculated."
                  : optimized
                    ? `Route has been optimized for the most efficient path.${routeData?.distance_km != null && legsMatch ? ` ${formatNumber(routeData.distance_km, 1)} km, about ${formatDuration(routeData.duration_minutes ?? 0)} of driving.` : ""}`
                    : legsMatch
                      ? `Driving route: ${formatNumber(routeData!.distance_km ?? 0, 1)} km, about ${formatDuration(routeData!.duration_minutes ?? 0)}. Use Optimize Route to find the most efficient stop order.`
                      : "Set the origin, destination and stops to see the driving route. Use Optimize Route to find the most efficient stop order."}
              </span>
            </div>
          </Card>
        </div>
      </div>

      <StopEditorDialog
        open={!!stopDialog}
        initial={stopDialog?.initial ?? EMPTY_STOP}
        endpoint={stopDialog?.index === "origin" || stopDialog?.index === "destination" ? stopDialog.index : undefined}
        orders={orderList}
        onSave={saveStop}
        onClose={() => setStopDialog(null)}
      />
      <ImportOrdersDialog open={importing} excludeIds={orderIds} onImport={importOrders} onClose={() => setImporting(false)} />
    </form>
  );
}

function ResourceCard({ media, title, subtitle, children }: { media: ReactNode; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-ink-100 p-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ink-50">{media}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-ink-900">{title}</span>
          <Badge tone="green">Available</Badge>
        </div>
        <p className="truncate text-xs text-ink-500">{subtitle}</p>
        {children && <dl className="mt-1.5 space-y-0.5 text-xs">{children}</dl>}
      </div>
    </div>
  );
}

function DriverCard({ driver }: { driver: Driver }) {
  return (
    <ResourceCard media={<Avatar name={driver.full_name} />} title={driver.full_name} subtitle={driver.phone}>
      <Stat label="License" value={`exp. ${formatDate(driver.license_expiry)}`} />
    </ResourceCard>
  );
}

function Stat({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {icon && <span className="text-ink-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
      <dt className="text-ink-500">{label}</dt>
      <dd className="truncate font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function TwoLine({ value }: { value: string }) {
  return (
    <span className="block leading-tight">
      {formatTime(value)}
      <span className="block">{formatDate(value)}</span>
    </span>
  );
}
