"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { STOP_ACTIVITY, statusOptions } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { ordersService } from "@/services/resources";
import type { Order, StopActivity } from "@/types/api";

export interface StopDraft {
  location_name: string;
  address: string;
  order_id: string;
  activity: StopActivity;
  estimated_arrival_at: string;
}

export const EMPTY_STOP: StopDraft = { location_name: "", address: "", order_id: "", activity: "delivery", estimated_arrival_at: "" };

/**
 * Adds or edits one row of the stops table. The origin and destination rows
 * only carry a location name; their times come from the trip schedule.
 */
export function StopEditorDialog({
  open,
  initial,
  endpoint,
  orders,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: StopDraft;
  endpoint?: "origin" | "destination";
  orders: Order[];
  onSave: (stop: StopDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setDraft(initial);
      setError(null);
    }
  }, [open, initial]);

  const set = <K extends keyof StopDraft>(key: K, value: StopDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const title = endpoint === "origin" ? "Edit origin" : endpoint === "destination" ? "Edit destination" : initial.location_name ? "Edit stop" : "Add stop";

  const save = () => {
    if (!draft.location_name.trim()) return setError("Enter a customer or location name.");
    onSave({ ...draft, location_name: draft.location_name.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{endpoint ? "Save" : initial.location_name ? "Save stop" : "Add stop"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={endpoint === "origin" ? "Origin (start location)" : endpoint === "destination" ? "Destination (final location)" : "Customer / Location"} htmlFor="stop-name" error={error ?? undefined} required>
          <Input id="stop-name" value={draft.location_name} onChange={(e) => set("location_name", e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), save())} invalid={!!error} placeholder={endpoint === "origin" ? "Manila Depot" : "Customer or site name"} autoFocus />
        </Field>
        {!endpoint && (
          <>
            <Field label="Address" htmlFor="stop-address">
              <Input id="stop-address" value={draft.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stop type" htmlFor="stop-activity" required>
                <Select id="stop-activity" value={draft.activity} onChange={(e) => set("activity", e.target.value as StopActivity)} options={statusOptions(STOP_ACTIVITY)} />
              </Field>
              <Field label="ETA" htmlFor="stop-eta" hint="Optional. Must fall within the trip window.">
                <Input id="stop-eta" type="datetime-local" value={draft.estimated_arrival_at} onChange={(e) => set("estimated_arrival_at", e.target.value)} />
              </Field>
            </div>
            <Field label="Order" htmlFor="stop-order" hint="Optional. Link the order handled at this stop.">
              <Select
                id="stop-order"
                value={draft.order_id}
                onChange={(e) => set("order_id", e.target.value)}
                options={orders.map((o) => ({ value: String(o.id), label: `${o.order_number} · ${o.customer_name}` }))}
                placeholder="No order"
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Pick schedulable orders and add each as a delivery stop. */
export function ImportOrdersDialog({ open, excludeIds, onImport, onClose }: { open: boolean; excludeIds: string[]; onImport: (orders: Order[]) => void; onClose: () => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const orders = useQuery({
    queryKey: ["orders", "schedulable"],
    queryFn: () => ordersService.list({ schedulable: 1, per_page: 100, sort: "scheduled_pickup_at" }),
    enabled: open,
  });
  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  const available = (orders.data?.data ?? []).filter((o) => !excludeIds.includes(String(o.id)));
  const toggle = (id: number) => setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import orders"
      description="Each selected order is added as a delivery stop at its delivery address."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={selected.length === 0} onClick={() => onImport(available.filter((o) => selected.includes(o.id)))}>
            Import {selected.length || ""} {selected.length === 1 ? "order" : "orders"}
          </Button>
        </>
      }
    >
      {orders.isLoading ? (
        <LoadingState />
      ) : orders.error ? (
        <ErrorState message={orders.error.message} onRetry={() => orders.refetch()} />
      ) : available.length === 0 ? (
        <EmptyState title="No orders to import" description="Only pending or scheduled orders that are not already on this trip can be imported." />
      ) : (
        <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
          {available.map((o) => (
            <li key={o.id} className="flex items-start gap-3 px-3 py-2.5">
              <Checkbox label={<span className="sr-only">Select {o.order_number}</span>} checked={selected.includes(o.id)} onChange={() => toggle(o.id)} className="mt-0.5" />
              <button type="button" onClick={() => toggle(o.id)} className="min-w-0 flex-1 text-left text-sm">
                <span className="block font-medium text-ink-900">
                  {o.order_number} · {o.customer_name}
                </span>
                <span className="block truncate text-xs text-ink-500">{o.delivery_address}</span>
                <span className="text-xs text-ink-500">
                  Deliver by {formatDateTime(o.scheduled_delivery_at)}
                  {o.weight_kg ? ` · ${formatNumber(o.weight_kg)} kg` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
