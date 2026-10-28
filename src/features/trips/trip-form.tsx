"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useDebounce } from "@/hooks/use-debounce";
import { VEHICLE_TYPES, labelOf } from "@/lib/constants";
import { formatNumber, fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";
import { ordersService, tripsService } from "@/services/resources";
import type { Trip } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";

const schema = z
  .object({
    order_id: z.string(),
    origin: z.string().trim().min(1, "Origin is required.").max(255),
    destination: z.string().trim().min(1, "Destination is required.").max(255),
    departure_at: z.string().min(1, "Departure is required."),
    estimated_arrival_at: z.string().min(1, "Estimated arrival is required."),
    vehicle_id: z.string().min(1, "Select an available vehicle."),
    driver_id: z.string().min(1, "Select an available driver."),
    distance_km: z.union([z.literal(""), z.coerce.number<string>().min(0)]),
    notes: z.string().max(2000),
    stops: z.array(z.object({ location_name: z.string().trim().min(1, "Name the stop."), address: z.string(), estimated_arrival_at: z.string() })),
  })
  .refine((v) => !v.departure_at || !v.estimated_arrival_at || new Date(v.estimated_arrival_at) > new Date(v.departure_at), {
    path: ["estimated_arrival_at"],
    message: "Arrival must be after departure.",
  });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = Object.keys(schema.shape);

const EMPTY: FormInput = {
  order_id: "",
  origin: "",
  destination: "",
  departure_at: "",
  estimated_arrival_at: "",
  vehicle_id: "",
  driver_id: "",
  distance_km: "",
  notes: "",
  stops: [],
};

/** Creates a trip. Vehicle and driver lists only offer resources free for the chosen window. */
export function TripScheduleForm({ initialOrderId, onScheduled }: { initialOrderId?: string; onScheduled?: (trip: Trip) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: { ...EMPTY, order_id: initialOrderId ?? "" } });
  const stops = useFieldArray({ control, name: "stops" });

  const orders = useQuery({ queryKey: ["orders", "schedulable"], queryFn: () => ordersService.list({ schedulable: 1, per_page: 100, sort: "scheduled_pickup_at" }) });
  const [orderId, departure, arrival, vehicleId, driverId] = watch(["order_id", "departure_at", "estimated_arrival_at", "vehicle_id", "driver_id"]);

  // Pre-fill route and times from the selected order.
  useEffect(() => {
    const order = orders.data?.data.find((o) => String(o.id) === orderId);
    if (!order) return;
    setValue("origin", order.pickup_address.split(",").slice(-1)[0].trim() || order.pickup_address);
    setValue("destination", order.delivery_address.split(",").slice(-2).join(",").trim() || order.delivery_address);
    setValue("departure_at", toDateTimeLocal(order.scheduled_pickup_at));
    setValue("estimated_arrival_at", toDateTimeLocal(order.scheduled_delivery_at));
  }, [orderId, orders.data, setValue]);

  const slot = { departure: useDebounce(departure, 400), arrival: useDebounce(arrival, 400) };
  const validWindow = !!slot.departure && !!slot.arrival && new Date(slot.arrival) > new Date(slot.departure);
  const availability = useQuery({
    queryKey: ["trips", "availability", slot.departure, slot.arrival],
    queryFn: () => tripsService.availability(fromDateTimeLocal(slot.departure), fromDateTimeLocal(slot.arrival)),
    enabled: validWindow,
  });
  const vehicles = availability.data?.data.vehicles ?? [];
  const drivers = availability.data?.data.drivers ?? [];

  // Clear selections that are no longer available after the window changes.
  useEffect(() => {
    if (!availability.data) return;
    if (vehicleId && !vehicles.some((v) => String(v.id) === vehicleId)) setValue("vehicle_id", "");
    if (driverId && !drivers.some((d) => String(d.id) === driverId)) setValue("driver_id", "");
  }, [availability.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useApiMutation(
    (values: FormOutput) =>
      tripsService.create(
        nullable({
          ...values,
          order_id: values.order_id ? Number(values.order_id) : "",
          vehicle_id: Number(values.vehicle_id),
          driver_id: Number(values.driver_id),
          departure_at: fromDateTimeLocal(values.departure_at),
          estimated_arrival_at: fromDateTimeLocal(values.estimated_arrival_at),
          stops: values.stops.map((s) => nullable({ ...s, estimated_arrival_at: s.estimated_arrival_at ? fromDateTimeLocal(s.estimated_arrival_at) : "" })),
        }),
      ),
    {
      invalidate: [["trips"], ["orders"], ["dashboard"], ["monitoring"]],
      onSuccess: (result) => {
        reset(EMPTY);
        onScheduled?.(result.data);
      },
    },
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
    }
  });

  const orderOptions = (orders.data?.data ?? []).map((o) => ({ value: String(o.id), label: `${o.order_number} · ${o.customer_name}` }));
  const vehicleOptions = vehicles.map((v) => ({
    value: String(v.id),
    label: `${v.plate_number} · ${v.make} ${v.model} · ${labelOf(VEHICLE_TYPES, v.vehicle_type)}${v.capacity_kg ? ` · ${formatNumber(v.capacity_kg)} kg` : ""}`,
  }));
  const driverOptions = drivers.map((d) => ({ value: String(d.id), label: `${d.full_name} · ${d.license_number}` }));
  const resourceHint = !validWindow
    ? "Set departure and arrival to see who is free."
    : availability.isFetching
      ? "Checking availability…"
      : undefined;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormError message={formError} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Order" htmlFor="order_id" error={errors.order_id?.message} hint="Optional. Pending or scheduled orders only." className="md:col-span-2">
          <Select id="order_id" options={orderOptions} placeholder="No order (empty / positioning trip)" {...register("order_id")} />
        </Field>
        <Field label="Origin" htmlFor="origin" error={errors.origin?.message} required>
          <Input id="origin" placeholder="Manila Depot" invalid={!!errors.origin} {...register("origin")} />
        </Field>
        <Field label="Destination" htmlFor="destination" error={errors.destination?.message} required>
          <Input id="destination" placeholder="Batangas City" invalid={!!errors.destination} {...register("destination")} />
        </Field>
        <Field label="Departure" htmlFor="departure_at" error={errors.departure_at?.message} required>
          <Input id="departure_at" type="datetime-local" invalid={!!errors.departure_at} {...register("departure_at")} />
        </Field>
        <Field label="Estimated arrival" htmlFor="estimated_arrival_at" error={errors.estimated_arrival_at?.message} required>
          <Input id="estimated_arrival_at" type="datetime-local" invalid={!!errors.estimated_arrival_at} {...register("estimated_arrival_at")} />
        </Field>
        <Field label="Vehicle" htmlFor="vehicle_id" error={errors.vehicle_id?.message} hint={resourceHint ?? `${vehicles.length} available`} required>
          <Select id="vehicle_id" options={vehicleOptions} placeholder="Select vehicle" disabled={!validWindow} invalid={!!errors.vehicle_id} {...register("vehicle_id")} />
        </Field>
        <Field label="Driver" htmlFor="driver_id" error={errors.driver_id?.message} hint={resourceHint ?? `${drivers.length} available with a valid license`} required>
          <Select id="driver_id" options={driverOptions} placeholder="Select driver" disabled={!validWindow} invalid={!!errors.driver_id} {...register("driver_id")} />
        </Field>
        <Field label="Planned distance (km)" htmlFor="distance_km" error={errors.distance_km?.message} hint="Enter if known; it is not estimated automatically.">
          <Input id="distance_km" type="number" min={0} step="0.1" {...register("distance_km")} />
        </Field>
        <Field label="Notes" htmlFor="notes">
          <Input id="notes" {...register("notes")} />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">Intermediate stops</h3>
          <Button variant="secondary" size="sm" onClick={() => stops.append({ location_name: "", address: "", estimated_arrival_at: "" })}>
            <Plus className="h-3.5 w-3.5" /> Add stop
          </Button>
        </div>
        {stops.fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ink-200 px-4 py-3 text-sm text-ink-500">Direct trip from origin to destination. Add stops for drops or checkpoints along the way.</p>
        ) : (
          <ol className="space-y-2">
            {stops.fields.map((field, index) => (
              <li key={field.id} className="grid items-start gap-2 rounded-lg border border-ink-100 p-3 sm:grid-cols-[2rem_1fr_1fr_12rem_2.5rem]">
                <span className="mt-2 flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">{index + 1}</span>
                <div>
                  <Input placeholder="Stop name" aria-label={`Stop ${index + 1} name`} invalid={!!errors.stops?.[index]?.location_name} {...register(`stops.${index}.location_name`)} />
                  {errors.stops?.[index]?.location_name && <p className="mt-1 text-xs text-brand-700">{errors.stops[index]?.location_name?.message}</p>}
                </div>
                <Input placeholder="Address (optional)" aria-label={`Stop ${index + 1} address`} {...register(`stops.${index}.address`)} />
                <Input type="datetime-local" aria-label={`Stop ${index + 1} ETA`} {...register(`stops.${index}.estimated_arrival_at`)} />
                <button type="button" onClick={() => stops.remove(index)} className="mt-1 rounded-md p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-700" aria-label={`Remove stop ${index + 1}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-ink-100 pt-4">
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Availability and license validity are re-checked by the server when you save.
        </p>
        <Button type="submit" loading={mutation.isPending}>
          Schedule trip
        </Button>
      </div>
    </form>
  );
}
