"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/utils";
import { ordersService } from "@/services/resources";
import type { Order } from "@/types/api";
import { applyApiErrors, nullable } from "../shared";

export const PAYMENT_TERMS = ["COD", "Net 7", "Net 15", "Net 30", "Net 60"];

const schema = z
  .object({
    customer_name: z.string().trim().min(1, "Customer name is required.").max(255),
    customer_contact: z.string().trim().min(1, "Contact is required.").max(60),
    pickup_address: z.string().trim().min(1, "Pickup address is required.").max(255),
    delivery_address: z.string().trim().min(1, "Delivery address is required.").max(255),
    scheduled_pickup_at: z.string().min(1, "Pickup time is required."),
    scheduled_delivery_at: z.string().min(1, "Delivery time is required."),
    cargo_description: z.string().trim().min(1, "Describe the cargo.").max(255),
    quantity: z.coerce.number<string>().int("Whole numbers only.").min(1, "At least 1."),
    weight_kg: z.union([z.literal(""), z.coerce.number<string>().min(0, "Cannot be negative.")]),
    amount: z.union([z.literal(""), z.coerce.number<string>().min(0, "Cannot be negative.")]),
    payment_terms: z.string().trim().max(50),
    delivery_instructions: z.string().max(2000),
  })
  .refine((v) => !v.scheduled_pickup_at || !v.scheduled_delivery_at || new Date(v.scheduled_delivery_at) > new Date(v.scheduled_pickup_at), {
    path: ["scheduled_delivery_at"],
    message: "Delivery must be after pickup.",
  });

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;
const FIELDS = Object.keys(schema.shape);

function defaults(order?: Order | null): FormInput {
  return {
    customer_name: order?.customer_name ?? "",
    customer_contact: order?.customer_contact ?? "",
    pickup_address: order?.pickup_address ?? "",
    delivery_address: order?.delivery_address ?? "",
    scheduled_pickup_at: toDateTimeLocal(order?.scheduled_pickup_at),
    scheduled_delivery_at: toDateTimeLocal(order?.scheduled_delivery_at),
    cargo_description: order?.cargo_description ?? "",
    quantity: String(order?.quantity ?? 1),
    weight_kg: order?.weight_kg?.toString() ?? "",
    amount: order?.amount?.toString() ?? "",
    payment_terms: order?.payment_terms ?? "",
    delivery_instructions: order?.delivery_instructions ?? "",
  };
}

export function OrderFormModal({ open, order, onClose, onSaved }: { open: boolean; order?: Order | null; onClose: () => void; onSaved?: (o: Order) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), values: defaults(order) });

  const mutation = useApiMutation(
    (values: FormOutput) => {
      const payload = nullable({
        ...values,
        scheduled_pickup_at: fromDateTimeLocal(values.scheduled_pickup_at),
        scheduled_delivery_at: fromDateTimeLocal(values.scheduled_delivery_at),
      });
      return order ? ordersService.update(order.id, payload) : ordersService.create(payload);
    },
    {
      invalidate: [["orders"], ["dashboard"]],
      onSuccess: (result) => {
        onSaved?.(result.data);
        onClose();
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={order ? `Edit ${order.order_number}` : "Create order"}
      description="Customer, pickup and delivery details."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending}>
            {order ? "Save changes" : "Create order"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <FormError message={formError} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer name" htmlFor="customer_name" error={errors.customer_name?.message} required>
            <Input id="customer_name" invalid={!!errors.customer_name} {...register("customer_name")} />
          </Field>
          <Field label="Customer contact" htmlFor="customer_contact" error={errors.customer_contact?.message} required>
            <Input id="customer_contact" placeholder="0917 123 4567" invalid={!!errors.customer_contact} {...register("customer_contact")} />
          </Field>
          <Field label="Pickup address" htmlFor="pickup_address" error={errors.pickup_address?.message} required className="sm:col-span-2">
            <Input id="pickup_address" invalid={!!errors.pickup_address} {...register("pickup_address")} />
          </Field>
          <Field label="Delivery address" htmlFor="delivery_address" error={errors.delivery_address?.message} required className="sm:col-span-2">
            <Input id="delivery_address" invalid={!!errors.delivery_address} {...register("delivery_address")} />
          </Field>
          <Field label="Scheduled pickup" htmlFor="scheduled_pickup_at" error={errors.scheduled_pickup_at?.message} required>
            <Input id="scheduled_pickup_at" type="datetime-local" invalid={!!errors.scheduled_pickup_at} {...register("scheduled_pickup_at")} />
          </Field>
          <Field label="Scheduled delivery" htmlFor="scheduled_delivery_at" error={errors.scheduled_delivery_at?.message} required>
            <Input id="scheduled_delivery_at" type="datetime-local" invalid={!!errors.scheduled_delivery_at} {...register("scheduled_delivery_at")} />
          </Field>
          <Field label="Cargo / item description" htmlFor="cargo_description" error={errors.cargo_description?.message} required className="sm:col-span-2">
            <Input id="cargo_description" invalid={!!errors.cargo_description} {...register("cargo_description")} />
          </Field>
          <Field label="Quantity" htmlFor="quantity" error={errors.quantity?.message} required>
            <Input id="quantity" type="number" min={1} invalid={!!errors.quantity} {...register("quantity")} />
          </Field>
          <Field label="Weight (kg)" htmlFor="weight_kg" error={errors.weight_kg?.message}>
            <Input id="weight_kg" type="number" min={0} step="0.01" invalid={!!errors.weight_kg} {...register("weight_kg")} />
          </Field>
          <Field label="Order amount (₱)" htmlFor="amount" error={errors.amount?.message}>
            <Input id="amount" type="number" min={0} step="0.01" invalid={!!errors.amount} {...register("amount")} />
          </Field>
          <Field label="Payment terms" htmlFor="payment_terms" error={errors.payment_terms?.message}>
            <Input id="payment_terms" list="payment-terms" placeholder="e.g. Net 30" {...register("payment_terms")} />
            <datalist id="payment-terms">
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Delivery instructions" htmlFor="delivery_instructions" error={errors.delivery_instructions?.message} className="sm:col-span-2">
            <Textarea id="delivery_instructions" {...register("delivery_instructions")} />
          </Field>
        </div>
        <p className="text-xs text-ink-500">Vehicle and driver are assigned when the order is scheduled on a trip.</p>
      </form>
    </Modal>
  );
}
