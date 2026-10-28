"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { FUEL_TYPES } from "@/lib/constants";
import { formatCurrency, fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";
import { fuelService } from "@/services/resources";
import type { FuelRecord } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";
import { useFleetOptions } from "./use-fleet-options";

const schema = z.object({
  vehicle_id: z.string().min(1, "Select a vehicle."),
  driver_id: z.string(),
  fueled_at: z.string().min(1, "Date and time are required."),
  fuel_type: z.string().min(1),
  liters: z.coerce.number<string>().positive("Must be more than 0."),
  price_per_liter: z.coerce.number<string>().positive("Must be more than 0."),
  odometer_km: z.union([z.literal(""), z.coerce.number<string>().int().min(0)]),
  station: z.string().max(255),
  receipt_number: z.string().max(60),
  notes: z.string().max(255),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = Object.keys(schema.shape);

function defaults(r?: FuelRecord | null, vehicleId?: string): FormInput {
  return {
    vehicle_id: r ? String(r.vehicle_id) : (vehicleId ?? ""),
    driver_id: r?.driver_id ? String(r.driver_id) : "",
    fueled_at: toDateTimeLocal(r?.fueled_at ?? new Date()),
    fuel_type: r?.fuel_type ?? "diesel",
    liters: r ? String(r.liters) : "",
    price_per_liter: r ? String(r.price_per_liter) : "",
    odometer_km: r?.odometer_km?.toString() ?? "",
    station: r?.station ?? "",
    receipt_number: r?.receipt_number ?? "",
    notes: r?.notes ?? "",
  };
}

export function FuelFormModal({ open, record, defaultVehicleId, onClose }: { open: boolean; record?: FuelRecord | null; defaultVehicleId?: string; onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const { vehicles, vehicleOptions, driverOptions } = useFleetOptions(open);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), values: defaults(record, defaultVehicleId) });

  const [liters, price, vehicleId] = watch(["liters", "price_per_liter", "vehicle_id"]);
  const total = Number(liters) * Number(price);

  // Default fuel type and driver to the selected vehicle's.
  useEffect(() => {
    if (record) return;
    const vehicle = vehicles.find((v) => String(v.id) === vehicleId);
    if (vehicle) {
      setValue("fuel_type", vehicle.fuel_type);
      if (vehicle.assigned_driver_id) setValue("driver_id", String(vehicle.assigned_driver_id));
    }
  }, [vehicleId, vehicles, record, setValue]);

  const mutation = useApiMutation(
    (values: FormOutput) => {
      const payload = nullable({
        ...values,
        vehicle_id: Number(values.vehicle_id),
        driver_id: values.driver_id ? Number(values.driver_id) : "",
        fueled_at: fromDateTimeLocal(values.fueled_at),
      });
      return record ? fuelService.update(record.id, payload) : fuelService.create(payload);
    },
    { invalidate: [["fuel"], ["vehicle"]], onSuccess: onClose },
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={record ? "Edit fuel record" : "Add fuel record"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {record ? "Save changes" : "Save record"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={formError} />
        </div>
        <Field label="Vehicle" htmlFor="vehicle_id" error={errors.vehicle_id?.message} required>
          <Select id="vehicle_id" options={vehicleOptions} placeholder="Select vehicle" invalid={!!errors.vehicle_id} {...register("vehicle_id")} />
        </Field>
        <Field label="Driver" htmlFor="driver_id" error={errors.driver_id?.message}>
          <Select id="driver_id" options={driverOptions} placeholder="Not recorded" {...register("driver_id")} />
        </Field>
        <Field label="Date & time" htmlFor="fueled_at" error={errors.fueled_at?.message} required>
          <Input id="fueled_at" type="datetime-local" invalid={!!errors.fueled_at} {...register("fueled_at")} />
        </Field>
        <Field label="Fuel type" htmlFor="fuel_type" required>
          <Select id="fuel_type" options={FUEL_TYPES} {...register("fuel_type")} />
        </Field>
        <Field label="Liters" htmlFor="liters" error={errors.liters?.message} required>
          <Input id="liters" type="number" step="0.01" min={0} invalid={!!errors.liters} {...register("liters")} />
        </Field>
        <Field label="Price per liter (₱)" htmlFor="price_per_liter" error={errors.price_per_liter?.message} required>
          <Input id="price_per_liter" type="number" step="0.01" min={0} invalid={!!errors.price_per_liter} {...register("price_per_liter")} />
        </Field>
        <Field label="Odometer (km)" htmlFor="odometer_km" error={errors.odometer_km?.message}>
          <Input id="odometer_km" type="number" min={0} invalid={!!errors.odometer_km} {...register("odometer_km")} />
        </Field>
        <div className="flex flex-col justify-end rounded-lg bg-ink-50 px-4 py-2.5">
          <span className="text-xs text-ink-500">Total cost (computed by the server)</span>
          <span className="text-lg font-bold text-ink-900">{Number.isFinite(total) && total > 0 ? formatCurrency(Math.round(total * 100) / 100) : "—"}</span>
        </div>
        <Field label="Station" htmlFor="station">
          <Input id="station" {...register("station")} />
        </Field>
        <Field label="Receipt no." htmlFor="receipt_number">
          <Input id="receipt_number" {...register("receipt_number")} />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Input id="notes" {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
