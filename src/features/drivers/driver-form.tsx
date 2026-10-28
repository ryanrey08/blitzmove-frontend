"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { DRIVER_STATUS, LICENSE_TYPES, statusOptions } from "@/lib/constants";
import { driversService } from "@/services/resources";
import type { Driver } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";

const schema = z.object({
  full_name: z.string().trim().min(1, "Full name is required.").max(255),
  phone: z.string().trim().min(1, "Contact number is required.").max(30),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.")]),
  address: z.string().max(255),
  license_number: z.string().trim().min(1, "License number is required.").max(50),
  license_type: z.string().min(1, "Select a license type."),
  license_expiry: z.string().min(1, "Expiry date is required."),
  date_hired: z.string(),
  status: z.string().min(1),
  notes: z.string().max(2000),
});
type FormValues = z.infer<typeof schema>;
const FIELDS = Object.keys(schema.shape);

function defaults(d?: Driver | null): FormValues {
  return {
    full_name: d?.full_name ?? "",
    phone: d?.phone ?? "",
    email: d?.email ?? "",
    address: d?.address ?? "",
    license_number: d?.license_number ?? "",
    license_type: d?.license_type ?? "professional",
    license_expiry: d?.license_expiry ?? "",
    date_hired: d?.date_hired ?? "",
    status: d?.status ?? "available",
    notes: d?.notes ?? "",
  };
}

export function DriverFormModal({ open, driver, onClose }: { open: boolean; driver?: Driver | null; onClose: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), values: defaults(driver) });

  const mutation = useApiMutation((values: FormValues) => (driver ? driversService.update(driver.id, nullable(values)) : driversService.create(nullable(values))), {
    invalidate: [["drivers"], ["driver"], ["dashboard"], ["monitoring"]],
    onSuccess: onClose,
  });

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
      title={driver ? `Edit ${driver.full_name}` : "Add driver"}
      description={driver ? driver.employee_code : "An employee code is assigned automatically."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {driver ? "Save changes" : "Add driver"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <FormError message={formError} />
        </div>
        <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message} required>
          <Input id="full_name" invalid={!!errors.full_name} {...register("full_name")} />
        </Field>
        <Field label="Contact number" htmlFor="phone" error={errors.phone?.message} required>
          <Input id="phone" placeholder="0917 555 1234" invalid={!!errors.phone} {...register("phone")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field label="Date hired" htmlFor="date_hired" error={errors.date_hired?.message}>
          <Input id="date_hired" type="date" invalid={!!errors.date_hired} {...register("date_hired")} />
        </Field>
        <Field label="Address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2">
          <Input id="address" {...register("address")} />
        </Field>
        <Field label="License number" htmlFor="license_number" error={errors.license_number?.message} required>
          <Input id="license_number" placeholder="N01-23-456789" invalid={!!errors.license_number} {...register("license_number")} />
        </Field>
        <Field label="License type" htmlFor="license_type" error={errors.license_type?.message} required>
          <Select id="license_type" options={LICENSE_TYPES} {...register("license_type")} />
        </Field>
        <Field label="License expiry" htmlFor="license_expiry" error={errors.license_expiry?.message} required>
          <Input id="license_expiry" type="date" invalid={!!errors.license_expiry} {...register("license_expiry")} />
        </Field>
        <Field label="Status" htmlFor="status" error={errors.status?.message} required>
          <Select id="status" options={statusOptions(DRIVER_STATUS)} {...register("status")} />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" {...register("notes")} />
        </Field>
      </form>
    </Modal>
  );
}
