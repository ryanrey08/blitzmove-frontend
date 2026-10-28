"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { ORDER_STATUS } from "@/lib/constants";
import { ordersService } from "@/services/resources";
import type { Order, OrderStatus } from "@/types/api";

/** Moves an order along the workflow; only transitions the API allows are offered. */
export function OrderStatusDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [reason, setReason] = useState("");
  const mutation = useApiMutation(() => ordersService.changeStatus(order!.id, status as OrderStatus, reason || undefined), {
    invalidate: [["orders"], ["order"], ["dashboard"], ["trips"]],
    onSuccess: () => close(),
  });

  const close = () => {
    setStatus("");
    setReason("");
    mutation.reset();
    onClose();
  };

  const options = (order?.allowed_transitions ?? []).map((s) => ({ value: s, label: ORDER_STATUS[s].label }));

  return (
    <Modal
      open={!!order}
      onClose={close}
      size="sm"
      title="Update order status"
      description={order ? `${order.order_number} is currently ${ORDER_STATUS[order.status].label}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!status} loading={mutation.isPending}>
            Update status
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FormError message={mutation.error?.field("status") ?? (mutation.error?.status === 422 ? mutation.error.message : null)} />
        {options.length === 0 ? (
          <p className="text-sm text-ink-600">This order has reached a final status and cannot be changed.</p>
        ) : (
          <>
            <Field label="New status" htmlFor="order-status">
              <Select id="order-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} options={options} placeholder="Select status" />
            </Field>
            {status === "cancelled" && (
              <Field label="Cancellation reason" htmlFor="order-reason" hint="Scheduled trips for this order are cancelled too.">
                <Textarea id="order-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={255} />
              </Field>
            )}
            {status === "in_transit" || status === "delivered" ? (
              <p className="text-xs text-ink-500">Tip: trips update this automatically when they start and complete in Dispatch Management.</p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
