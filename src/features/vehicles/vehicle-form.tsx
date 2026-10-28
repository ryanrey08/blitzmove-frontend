"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { FUEL_TYPES, VEHICLE_STATUS, VEHICLE_TYPES, statusOptions } from "@/lib/constants";
import { driversService, vehiclesService } from "@/services/resources";
import type { Vehicle } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";

const year = new Date().getFullYear();
const schema = z.object({
  plate_number: z.string().trim().min(1, "Plate number is required.").max(20),
  vehicle_type: z.string().min(1, "Select a type."),
  make: z.string().trim().min(1, "Make is required.").max(60),
  model: z.string().trim().min(1, "Model is required.").max(60),
  year: z.coerce.number<string>().int().min(1980, "1980 or later.").max(year + 1, `Up to ${year + 1}.`),
  capacity_kg: z.union([z.literal(""), z.coerce.number<string>().min(0)]),
  fuel_type: z.string().min(1, "Select a fuel type."),
  vin: z.string().trim().max(50),
  status: z.string().min(1),
  assigned_driver_id: z.string(),
  notes: z.string().max(2000),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = Object.keys(schema.shape);

function defaults(v?: Vehicle | null): FormInput {
  return {
    plate_number: v?.plate_number ?? "",
    vehicle_type: v?.vehicle_type ?? "",
    make: v?.make ?? "",
    model: v?.model ?? "",
    year: String(v?.year ?? year),
    capacity_kg: v?.capacity_kg?.toString() ?? "",
    fuel_type: v?.fuel_type ?? "diesel",
    vin: v?.vin ?? "",
    status: v?.status ?? "available",
    assigned_driver_id: v?.assigned_driver_id?.toString() ?? "",
    notes: v?.notes ?? "",
  };
}

export function VehicleFormModal({ open, vehicle, onClose }: { open: boolean; vehicle?: Vehicle | null; onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const drivers = useQuery({ queryKey: ["drivers", "options"], queryFn: () => driversService.list({ per_page: 100, sort: "full_name" }), enabled: open });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), values: defaults(vehicle) });

  const mutation = useApiMutation(
    (values: FormOutput) => {
      const payload = nullable({ ...values, assigned_driver_id: values.assigned_driver_id ? Number(values.assigned_driver_id) : null });
      return vehicle ? vehiclesService.update(vehicle.id, payload) : vehiclesService.create(payload);
    },
    { invalidate: [["vehicles"], ["vehicle"], ["dashboard"], ["monitoring"]], onSuccess: onClose },
  );

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, FIELDS));
    }
  });

  const driverOptions = (drivers.data?.data ?? []).map((d) => ({
    value: String(d.id),
    label: `${d.full_name}${d.assigned_vehicle && d.assigned_vehicle.id !== vehicle?.id ? ` (on ${d.assigned_vehicle.plate_number})` : ""}`,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={vehicle ? `Edit ${vehicle.plate_number}` : "Add vehicle"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {vehicle ? "Save changes" : "Add vehicle"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plate number" htmlFor="plate_number" error={errors.plate_number?.message} required>
            <Input id="plate_number" placeholder="ABC-1234" className="uppercase" invalid={!!errors.plate_number} {...register("plate_number")} />
          </Field>
          <Field label="Vehicle type" htmlFor="vehicle_type" error={errors.vehicle_type?.message} required>
            <Select id="vehicle_type" options={VEHICLE_TYPES} placeholder="Select type" invalid={!!errors.vehicle_type} {...register("vehicle_type")} />
          </Field>
          <Field label="Make" htmlFor="make" error={errors.make?.message} required>
            <Input id="make" placeholder="Isuzu" invalid={!!errors.make} {...register("make")} />
          </Field>
          <Field label="Model" htmlFor="model" error={errors.model?.message} required>
            <Input id="model" placeholder="FVM 240" invalid={!!errors.model} {...register("model")} />
          </Field>
          <Field label="Year" htmlFor="year" error={errors.year?.message} required>
            <Input id="year" type="number" invalid={!!errors.year} {...register("year")} />
          </Field>
          <Field label="Capacity (kg)" htmlFor="capacity_kg" error={errors.capacity_kg?.message}>
            <Input id="capacity_kg" type="number" min={0} invalid={!!errors.capacity_kg} {...register("capacity_kg")} />
          </Field>
          <Field label="Fuel type" htmlFor="fuel_type" error={errors.fuel_type?.message} required>
            <Select id="fuel_type" options={FUEL_TYPES} {...register("fuel_type")} />
          </Field>
          <Field label="VIN / chassis no." htmlFor="vin" error={errors.vin?.message}>
            <Input id="vin" invalid={!!errors.vin} {...register("vin")} />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status?.message} required>
            <Select id="status" options={statusOptions(VEHICLE_STATUS)} {...register("status")} />
          </Field>
          <Field label="Assigned driver" htmlFor="assigned_driver_id" error={errors.assigned_driver_id?.message} hint="The vehicle's regular driver, if any.">
            <Select id="assigned_driver_id" options={driverOptions} placeholder="No assigned driver" {...register("assigned_driver_id")} />
          </Field>
          <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea id="notes" {...register("notes")} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
